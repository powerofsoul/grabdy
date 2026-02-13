import { Injectable } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import type { CanvasState } from '@grabdy/contracts';
import type { ToolsInput } from '@mastra/core/agent';

import { AiCallerType, AiRequestType } from '../../../db/enums';
import { AiUsageService } from '../../ai/ai-usage.service';
import { DataAgent } from '../data-agent';
import { CanvasTools } from '../tools/canvas-tools';
import { RagSearchTool } from '../tools/rag-search.tool';

import { AgentMemoryService } from './memory.service';

const CARD_GAP = 20;
const DEFAULT_CARD_W = 400;
const DEFAULT_CARD_H = 300;

function summarizeCanvas(state: CanvasState): string {
  if (state.cards.length === 0) return '';

  const lines: string[] = ['## Current canvas state'];

  for (const card of state.cards) {
    const meta = card.metadata;
    let line = `- Card "${card.id}" at (${card.position.x},${card.position.y}) ${card.width}x${card.height}`;
    if (card.title) line += ` "${card.title}"`;
    line += ` [${card.component.type}]`;

    if (meta) {
      if (meta.locked) line += ' LOCKED';
      if (meta.tags && meta.tags.length > 0) line += ` tags:[${meta.tags.join(',')}]`;
      if (meta.aiNotes) line += ` notes:"${meta.aiNotes}"`;
      if (meta.createdBy !== 'ai' && typeof meta.createdBy === 'object') {
        line += ` (by ${meta.createdBy.name})`;
      }
    }

    lines.push(line);
  }

  const occupied = state.cards.map((c) => ({
    x1: c.position.x,
    y1: c.position.y,
    x2: c.position.x + c.width,
    y2: c.position.y + c.height,
  }));

  const maxX = Math.max(...occupied.map((o) => o.x2));
  const maxY = Math.max(...occupied.map((o) => o.y2));

  // Build candidate positions from edges of existing cards + canvas boundary
  const candidateXs = new Set([0]);
  const candidateYs = new Set([0]);
  for (const o of occupied) {
    candidateXs.add(o.x2 + CARD_GAP);
    candidateYs.add(o.y2 + CARD_GAP);
  }
  // Also try just past all cards
  candidateXs.add(maxX + CARD_GAP);
  candidateYs.add(maxY + CARD_GAP);

  const suggestions: Array<{ x: number; y: number }> = [];
  const sortedXs = [...candidateXs].sort((a, b) => a - b);
  const sortedYs = [...candidateYs].sort((a, b) => a - b);

  for (const x of sortedXs) {
    for (const y of sortedYs) {
      const overlaps = occupied.some(
        (o) =>
          x < o.x2 + CARD_GAP &&
          x + DEFAULT_CARD_W + CARD_GAP > o.x1 &&
          y < o.y2 + CARD_GAP &&
          y + DEFAULT_CARD_H + CARD_GAP > o.y1
      );
      if (!overlaps) {
        suggestions.push({ x, y });
        if (suggestions.length >= 3) break;
      }
    }
    if (suggestions.length >= 3) break;
  }

  // Fallback: place to the right or below all cards
  if (suggestions.length === 0) {
    suggestions.push({ x: maxX + CARD_GAP, y: 0 }, { x: 0, y: maxY + CARD_GAP });
  }

  lines.push(
    `\nNext free positions (use these): ${suggestions.map((p) => `(${p.x}, ${p.y})`).join(', ')}`
  );

  return lines.join('\n');
}

@Injectable()
export class AgentFactory {
  constructor(
    private memoryService: AgentMemoryService,
    private ragSearchTool: RagSearchTool,
    private canvasTools: CanvasTools,
    private aiUsageService: AiUsageService
  ) {}

  createDataAgent(opts: {
    orgId: DbId<'Org'>;
    collectionIds?: DbId<'Collection'>[];
    userId?: DbId<'User'>;
    threadId?: DbId<'ChatThread'>;
    canvasState?: CanvasState;
    callerType?: AiCallerType;
    enableCanvas?: boolean;
    defaultTopK?: number;
  }): DataAgent {
    const { orgId, collectionIds, userId, threadId, canvasState, callerType, enableCanvas = true, defaultTopK } = opts;
    const ragTool = this.ragSearchTool.create(orgId, collectionIds, defaultTopK);

    const tools: ToolsInput = {
      'rag-search': ragTool,
    };

    if (enableCanvas && threadId) {
      const canvasToolSet = this.canvasTools.create(threadId, orgId);
      Object.assign(tools, canvasToolSet);
    }

    const canvasContext = enableCanvas && canvasState ? summarizeCanvas(canvasState) : undefined;

    return new DataAgent(
      tools,
      this.memoryService.getMemory(),
      this.aiUsageService,
      {
        callerType: callerType ?? AiCallerType.MEMBER,
        requestType: AiRequestType.CHAT,
        context: { orgId, userId },
      },
      canvasContext,
      enableCanvas
    );
  }
}
