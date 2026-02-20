import { Inject, Injectable, Logger } from '@nestjs/common';

import { type BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { DbId } from '@grabdy/common';
import { AiCallerType, AiRequestType, RERANK_MODEL } from '@grabdy/contracts';
import { z } from 'zod';

import { RERANK_MAX_DOC_LENGTH } from '../../config/constants';
import { BEDROCK_CLIENT } from '../agent/providers/bedrock.provider';
import { AiUsageService } from '../ai/ai-usage.service';

interface RerankInput {
  id: string;
  content: string;
  vectorScore: number;
}

interface RerankWeights {
  semantic: number;
  vector: number;
  position: number;
}

const DEFAULT_WEIGHTS: RerankWeights = {
  semantic: 0.5,
  vector: 0.3,
  position: 0.2,
};

/** Cohere Rerank timeout — purpose-built model, should be fast. */
const RERANK_TIMEOUT_MS = 2000;

const cohereRerankResponseSchema = z.object({
  results: z.array(
    z.object({
      index: z.number(),
      relevance_score: z.number(),
    })
  ),
});

@Injectable()
export class RerankService {
  private readonly logger = new Logger(RerankService.name);

  constructor(
    @Inject(BEDROCK_CLIENT) private bedrockClient: BedrockRuntimeClient,
    private aiUsageService: AiUsageService
  ) {}

  /**
   * Rerank search results using Cohere Rerank v3.5 on Bedrock.
   * Returns `null` on failure so callers can fall back to un-reranked results.
   */
  async rerank(
    query: string,
    results: RerankInput[],
    orgId: DbId<'Org'>,
    options?: { weights?: Partial<RerankWeights>; userId?: DbId<'User'> | null }
  ): Promise<Array<{ id: string; score: number }> | null> {
    if (results.length === 0) return [];
    if (results.length === 1) return [{ id: results[0].id, score: results[0].vectorScore }];

    const weights: RerankWeights = { ...DEFAULT_WEIGHTS, ...options?.weights };
    const start = Date.now();

    try {
      const documents = results.map((r) => r.content.slice(0, RERANK_MAX_DOC_LENGTH));

      const command = new InvokeModelCommand({
        modelId: 'cohere.rerank-v3-5:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          api_version: 2,
          query,
          documents,
          top_n: results.length,
        }),
      });

      const timeout = rejectAfter(RERANK_TIMEOUT_MS);
      const response = await Promise.race([this.bedrockClient.send(command), timeout.promise]);
      timeout.clear();

      const durationMs = Date.now() - start;

      if (!response.body) {
        this.logger.warn('Rerank returned empty response body');
        return null;
      }

      const responseBody = cohereRerankResponseSchema.parse(
        JSON.parse(new TextDecoder().decode(response.body))
      );

      // Log rerank usage (fire-and-forget) — Cohere charges per search unit, log document count
      this.aiUsageService
        .logUsage(
          RERANK_MODEL,
          documents.length,
          0,
          AiCallerType.SYSTEM,
          AiRequestType.RERANK,
          { orgId, userId: options?.userId, source: 'SYSTEM' },
          { durationMs }
        )
        .catch((err) => this.logger.error(`Rerank usage logging failed: ${err}`));

      // Build score map
      const semanticScores = new Map<number, number>();
      for (const r of responseBody.results) {
        if (Number.isInteger(r.index) && r.index >= 0 && r.index < results.length) {
          semanticScores.set(r.index, Math.max(0, Math.min(1, r.relevance_score)));
        }
      }

      // If Cohere returned scores for fewer than half the chunks, something is wrong
      if (semanticScores.size < results.length / 2) {
        this.logger.warn(
          `Rerank returned ${semanticScores.size}/${results.length} valid scores — falling back`
        );
        return null;
      }

      // Combine scores: semantic + vector + position
      const total = results.length;
      const scored = results.map((r, i) => {
        const semantic = semanticScores.get(i) ?? 0;
        const positionScore = 1 - i / total;
        const combined =
          weights.semantic * semantic +
          weights.vector * r.vectorScore +
          weights.position * positionScore;

        return { id: r.id, score: combined };
      });

      scored.sort((a, b) => b.score - a.score);

      return scored;
    } catch (error) {
      const durationMs = Date.now() - start;
      this.logger.warn(`Rerank failed after ${durationMs}ms, falling back: ${error}`);
      return null;
    }
  }
}

/** Returns a promise that rejects after `ms` milliseconds. Clears the timer if the returned abort is called. */
function rejectAfter(ms: number): { promise: Promise<never>; clear: () => void } {
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`Rerank timed out after ${ms}ms`)), ms);
  });
  return { promise, clear: () => clearTimeout(timer) };
}
