/** Quality rank A=best (0) … E=worst (4). Unknown quality gets 5 (treated as worst). */
export const qualityRank: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };

/** Songs score 0 (preferred); everything else scores 1. */
export const typeScore = (type: string): number =>
  type.toLowerCase().includes('song') ? 0 : 1;
