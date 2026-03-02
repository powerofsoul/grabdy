import { Injectable, Logger } from '@nestjs/common';

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { DbId } from '@grabdy/common';
import {
  type AiCallerType,
  AiCallerType as AiCallerTypeEnum,
  type AiRequestSource,
  type AiRequestType,
  AiRequestType as AiRequestTypeEnum,
  EMBEDDING_MODEL,
  type ModelKey,
  RERANK_MODEL,
} from '@grabdy/contracts';
import { embed, generateObject, generateText } from 'ai';
import { z } from 'zod';

import { RECENCY_HALF_LIFE_DAYS, RERANK_MAX_DOC_LENGTH } from '../../config/constants';

import { AiUsageService, type UsageContext } from './ai-usage.service';

/** Shared tracking context required by all AI calls. */
export interface AiCallContext {
  orgId: DbId<'Org'>;
  userId?: DbId<'User'> | null;
  source: AiRequestSource;
  callerType?: AiCallerType;
  description?: string;
}

type GenerateTextParams = Parameters<typeof generateText>[0];
type EmbedParams = Parameters<typeof embed>[0];

interface StructuredObjectParams {
  model: GenerateTextParams['model'];
  system?: string;
  messages: GenerateTextParams extends { messages?: infer M } ? NonNullable<M> : never;
  temperature?: number;
}

interface RerankInput {
  id: string;
  content: string;
  vectorScore: number;
  createdAt?: Date;
}

interface RerankWeights {
  semantic: number;
  vector: number;
  position: number;
  recency: number;
}

const DEFAULT_RERANK_WEIGHTS: RerankWeights = {
  semantic: 0.45,
  vector: 0.25,
  position: 0.15,
  recency: 0.15,
};

const RERANK_TIMEOUT_MS = 2000;

const cohereRerankResponseSchema = z.object({
  results: z.array(
    z.object({
      index: z.number(),
      relevance_score: z.number(),
    })
  ),
});

/**
 * Centralized AI service wrapping AI SDK functions and Bedrock calls.
 * Every call requires an orgId via AiCallContext, and usage is logged automatically.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly bedrockClient = new BedrockRuntimeClient({});

  constructor(private readonly aiUsageService: AiUsageService) {}

  // ---- Text generation ------------------------------------------------

  async generateText(
    params: GenerateTextParams,
    model: ModelKey,
    requestType: AiRequestType,
    ctx: AiCallContext
  ): Promise<Awaited<ReturnType<typeof generateText>>> {
    const start = Date.now();
    const result = await generateText(params);
    const durationMs = Date.now() - start;

    this.logUsage(
      model,
      result.usage.inputTokens ?? 0,
      result.usage.outputTokens ?? 0,
      requestType,
      ctx,
      {
        durationMs,
        finishReason: result.finishReason,
      }
    );

    return result;
  }

  // ---- Structured object generation ------------------------------------

  async generateStructuredObject<T extends z.ZodType>(
    schema: T,
    params: StructuredObjectParams,
    model: ModelKey,
    requestType: AiRequestType,
    ctx: AiCallContext
  ): Promise<z.infer<T>> {
    const start = Date.now();

    const result = await generateObject({
      model: params.model,
      schema,
      mode: 'json',
      system: params.system,
      messages: params.messages,
      temperature: params.temperature,
    });

    const durationMs = Date.now() - start;

    this.logUsage(
      model,
      result.usage.inputTokens ?? 0,
      result.usage.outputTokens ?? 0,
      requestType,
      ctx,
      {
        durationMs,
        finishReason: result.finishReason,
      }
    );

    return schema.parse(result.object);
  }

  // ---- Embeddings -----------------------------------------------------

  async embed(params: EmbedParams, ctx: AiCallContext): Promise<Awaited<ReturnType<typeof embed>>> {
    const result = await embed(params);

    this.logUsage(EMBEDDING_MODEL, result.usage.tokens, 0, AiRequestTypeEnum.EMBEDDING, {
      ...ctx,
      description: ctx.description ?? 'Embed query',
    });

    return result;
  }

  // ---- Rerank ---------------------------------------------------------

  /**
   * Rerank search results using Cohere Rerank v3.5 on Bedrock.
   * Returns `null` on failure so callers can fall back to un-reranked results.
   */
  async rerank(
    query: string,
    results: RerankInput[],
    ctx: AiCallContext
  ): Promise<Array<{ id: string; score: number }> | null> {
    if (results.length === 0) return [];
    if (results.length === 1) return [{ id: results[0].id, score: results[0].vectorScore }];

    const weights: RerankWeights = { ...DEFAULT_RERANK_WEIGHTS };
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

      this.logUsage(
        RERANK_MODEL,
        documents.length,
        0,
        AiRequestTypeEnum.RERANK,
        {
          ...ctx,
          description: ctx.description ?? 'Rerank search results',
        },
        {
          durationMs,
        }
      );

      // Build score map
      const semanticScores = new Map<number, number>();
      for (const r of responseBody.results) {
        if (Number.isInteger(r.index) && r.index >= 0 && r.index < results.length) {
          semanticScores.set(r.index, Math.max(0, Math.min(1, r.relevance_score)));
        }
      }

      if (semanticScores.size < results.length / 2) {
        this.logger.warn(
          `Rerank returned ${semanticScores.size}/${results.length} valid scores, falling back`
        );
        return null;
      }

      // Combine scores: semantic + vector + position + recency
      const total = results.length;
      const now = Date.now();
      const decayRate = Math.LN2 / RECENCY_HALF_LIFE_DAYS;

      const scored = results.map((r, i) => {
        const semantic = semanticScores.get(i) ?? 0;
        const positionScore = 1 - i / total;
        const recencyScore = r.createdAt
          ? Math.min(
              1,
              Math.exp(-(Math.max(0, now - r.createdAt.getTime()) / 86_400_000) * decayRate)
            )
          : 0.5; // neutral score when no timestamp
        const combined =
          weights.semantic * semantic +
          weights.vector * r.vectorScore +
          weights.position * positionScore +
          weights.recency * recencyScore;

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

  // ---- Private --------------------------------------------------------

  private logUsage(
    model: ModelKey,
    inputTokens: number,
    outputTokens: number,
    requestType: AiRequestType,
    ctx: AiCallContext,
    extras?: { durationMs?: number; streaming?: boolean; finishReason?: string }
  ): void {
    const usageCtx: UsageContext = {
      orgId: ctx.orgId,
      userId: ctx.userId,
      source: ctx.source,
    };

    this.aiUsageService
      .logUsage(
        model,
        inputTokens,
        outputTokens,
        ctx.callerType ?? AiCallerTypeEnum.SYSTEM,
        requestType,
        usageCtx,
        { ...extras, description: ctx.description }
      )
      .catch((err) => this.logger.error(`AI usage logging failed: ${err}`));
  }
}

function rejectAfter(ms: number): { promise: Promise<never>; clear: () => void } {
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`Rerank timed out after ${ms}ms`)), ms);
  });
  return { promise, clear: () => clearTimeout(timer) };
}
