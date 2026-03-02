import { RECENCY_HALF_LIFE_DAYS } from '../../config/constants';

const RRF_K = 60;
const RECENCY_RRF_WEIGHT = 0.1;

const DEFAULT_WEIGHTS = [0.5, 0.3, 0.2] as const;

interface RrfOptions<T> {
  /** Extract the source content date for recency boosting. Return null for items without a meaningful date. */
  getSourceDate?: (item: T) => Date | null;
}

/**
 * Reciprocal Rank Fusion — merges N ranked result lists into a single
 * list ordered by combined RRF score.
 *
 * Formula: score = Σ w_i * 1/(k + rank_i) + recency_bonus
 */
export function reciprocalRankFusion<T>(
  rankedLists: T[][],
  getKey: (item: T) => string,
  weights?: number[],
  options?: RrfOptions<T>
): Array<{ item: T; score: number }> {
  const w = weights ?? DEFAULT_WEIGHTS.slice(0, rankedLists.length);
  const scoreMap = new Map<string, { item: T; score: number }>();

  for (let listIdx = 0; listIdx < rankedLists.length; listIdx++) {
    const list = rankedLists[listIdx];
    const weight = w[listIdx] ?? 1 / rankedLists.length;

    for (let rank = 0; rank < list.length; rank++) {
      const item = list[rank];
      const key = getKey(item);
      const rrfScore = weight * (1 / (RRF_K + rank + 1));
      const existing = scoreMap.get(key);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(key, { item, score: rrfScore });
      }
    }
  }

  // Apply recency bonus if a date getter is provided
  if (options?.getSourceDate) {
    const now = Date.now();
    const decayRate = Math.LN2 / RECENCY_HALF_LIFE_DAYS;

    for (const entry of scoreMap.values()) {
      const sourceDate = options.getSourceDate(entry.item);
      if (sourceDate) {
        const ageDays = Math.max(0, (now - sourceDate.getTime()) / 86_400_000);
        entry.score += RECENCY_RRF_WEIGHT * Math.exp(-ageDays * decayRate);
      } else {
        entry.score += RECENCY_RRF_WEIGHT * 0.5;
      }
    }
  }

  return [...scoreMap.values()].sort((a, b) => b.score - a.score);
}
