const RRF_K = 60;

const DEFAULT_WEIGHTS = [0.5, 0.3, 0.2] as const;

/**
 * Reciprocal Rank Fusion — merges N ranked result lists into a single
 * list ordered by combined RRF score.
 *
 * Formula: score = Σ w_i * 1/(k + rank_i)
 */
export function reciprocalRankFusion<T>(
  rankedLists: T[][],
  getKey: (item: T) => string,
  weights?: number[]
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

  return [...scoreMap.values()].sort((a, b) => b.score - a.score);
}
