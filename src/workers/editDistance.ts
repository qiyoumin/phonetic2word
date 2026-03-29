/**
 * Weighted edit distance algorithm based on phonetic features.
 * Operates on ARPAbet phoneme codes (stress-stripped).
 */

// --- Voicing pairs (weight 0.3) ---
const VOICING_PAIRS: [string, string][] = [
  ['P', 'B'],
  ['T', 'D'],
  ['K', 'G'],
  ['F', 'V'],
  ['S', 'Z'],
  ['TH', 'DH'],
  ['SH', 'ZH'],
  ['CH', 'JH'],
];

// --- Same manner of articulation (weight 0.5) ---
const MANNER_PAIRS: [string, string][] = [
  ['S', 'SH'],
  ['Z', 'ZH'],
];

// --- Vowel length pairs (weight 0.4) ---
const VOWEL_LENGTH_PAIRS: [string, string][] = [
  ['IY', 'IH'],
  ['UW', 'UH'],
  ['AA', 'AH'],
  ['AO', 'AH'],
];

// Build a fast lookup map for substitution weights
const substitutionWeights = new Map<string, number>();

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

for (const [a, b] of VOICING_PAIRS) {
  substitutionWeights.set(pairKey(a, b), 0.3);
}
for (const [a, b] of MANNER_PAIRS) {
  // Only set if not already set with a lower weight
  const key = pairKey(a, b);
  if (!substitutionWeights.has(key)) {
    substitutionWeights.set(key, 0.5);
  }
}
for (const [a, b] of VOWEL_LENGTH_PAIRS) {
  const key = pairKey(a, b);
  if (!substitutionWeights.has(key)) {
    substitutionWeights.set(key, 0.4);
  }
}

const INSERTION_WEIGHT = 1.0;
const DELETION_WEIGHT = 1.0;
const DEFAULT_SUBSTITUTION_WEIGHT = 1.0;

/**
 * Get the substitution weight for two ARPAbet phonemes.
 */
export function getSubstitutionWeight(a: string, b: string): number {
  if (a === b) return 0;
  return substitutionWeights.get(pairKey(a, b)) ?? DEFAULT_SUBSTITUTION_WEIGHT;
}

/**
 * Compute the weighted edit distance between two ARPAbet phoneme sequences.
 * Uses dynamic programming (Wagner-Fischer algorithm) with phonetic feature weights.
 */
export function weightedEditDistance(seq1: string[], seq2: string[]): number {
  const m = seq1.length;
  const n = seq2.length;

  // dp[i][j] = weighted edit distance between seq1[0..i-1] and seq2[0..j-1]
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = new Array(n + 1);
  }

  // Base cases
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i * DELETION_WEIGHT;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j * INSERTION_WEIGHT;
  }

  // Fill DP table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const subCost = getSubstitutionWeight(seq1[i - 1], seq2[j - 1]);
      dp[i][j] = Math.min(
        dp[i - 1][j] + DELETION_WEIGHT,
        dp[i][j - 1] + INSERTION_WEIGHT,
        dp[i - 1][j - 1] + subCost,
      );
    }
  }

  return dp[m][n];
}

/**
 * Compute similarity between two ARPAbet phoneme sequences.
 * similarity = 1 - weightedDistance / max(len1, len2)
 * Returns 1.0 for two empty sequences.
 */
export function computeSimilarity(seq1: string[], seq2: string[]): number {
  const maxLen = Math.max(seq1.length, seq2.length);
  if (maxLen === 0) return 1.0;
  const dist = weightedEditDistance(seq1, seq2);
  return 1 - dist / maxLen;
}

/**
 * Compute diffIndices: positions where the candidate sequence differs from the query.
 * Uses the DP backtrack to find alignment, then marks positions where phonemes differ.
 * Returns indices into the candidate sequence that differ from the query.
 */
export function computeDiffIndices(query: string[], candidate: string[]): number[] {
  const m = query.length;
  const n = candidate.length;

  // Build DP table
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = new Array(n + 1);
  }
  for (let i = 0; i <= m; i++) dp[i][0] = i * DELETION_WEIGHT;
  for (let j = 0; j <= n; j++) dp[0][j] = j * INSERTION_WEIGHT;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const subCost = getSubstitutionWeight(query[i - 1], candidate[j - 1]);
      dp[i][j] = Math.min(
        dp[i - 1][j] + DELETION_WEIGHT,
        dp[i][j - 1] + INSERTION_WEIGHT,
        dp[i - 1][j - 1] + subCost,
      );
    }
  }

  // Backtrack to find alignment
  const diffs: number[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const subCost = getSubstitutionWeight(query[i - 1], candidate[j - 1]);
      if (dp[i][j] === dp[i - 1][j - 1] + subCost) {
        // Substitution or match
        if (query[i - 1] !== candidate[j - 1]) {
          diffs.push(j - 1);
        }
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && dp[i][j] === dp[i - 1][j] + DELETION_WEIGHT) {
      // Deletion from query (no corresponding candidate position)
      i--;
      continue;
    }
    if (j > 0 && dp[i][j] === dp[i][j - 1] + INSERTION_WEIGHT) {
      // Insertion in candidate
      diffs.push(j - 1);
      j--;
      continue;
    }
    // Fallback (shouldn't happen with correct DP)
    break;
  }

  return diffs.sort((a, b) => a - b);
}
