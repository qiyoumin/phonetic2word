import { describe, it, expect } from 'vitest';
import {
  getSubstitutionWeight,
  weightedEditDistance,
  computeSimilarity,
  computeDiffIndices,
} from './editDistance';

describe('getSubstitutionWeight', () => {
  it('returns 0 for identical phonemes', () => {
    expect(getSubstitutionWeight('P', 'P')).toBe(0);
    expect(getSubstitutionWeight('IY', 'IY')).toBe(0);
  });

  it('returns 0.3 for voicing pairs', () => {
    expect(getSubstitutionWeight('P', 'B')).toBe(0.3);
    expect(getSubstitutionWeight('B', 'P')).toBe(0.3);
    expect(getSubstitutionWeight('T', 'D')).toBe(0.3);
    expect(getSubstitutionWeight('K', 'G')).toBe(0.3);
    expect(getSubstitutionWeight('F', 'V')).toBe(0.3);
    expect(getSubstitutionWeight('S', 'Z')).toBe(0.3);
    expect(getSubstitutionWeight('TH', 'DH')).toBe(0.3);
    expect(getSubstitutionWeight('SH', 'ZH')).toBe(0.3);
    expect(getSubstitutionWeight('CH', 'JH')).toBe(0.3);
  });

  it('returns 0.5 for same manner of articulation pairs', () => {
    expect(getSubstitutionWeight('S', 'SH')).toBe(0.5);
    expect(getSubstitutionWeight('SH', 'S')).toBe(0.5);
    expect(getSubstitutionWeight('Z', 'ZH')).toBe(0.5);
    expect(getSubstitutionWeight('ZH', 'Z')).toBe(0.5);
  });

  it('returns 0.4 for vowel length pairs', () => {
    expect(getSubstitutionWeight('IY', 'IH')).toBe(0.4);
    expect(getSubstitutionWeight('IH', 'IY')).toBe(0.4);
    expect(getSubstitutionWeight('UW', 'UH')).toBe(0.4);
    expect(getSubstitutionWeight('AA', 'AH')).toBe(0.4);
    expect(getSubstitutionWeight('AO', 'AH')).toBe(0.4);
  });

  it('returns 1.0 for unrelated phonemes', () => {
    expect(getSubstitutionWeight('P', 'IY')).toBe(1.0);
    expect(getSubstitutionWeight('B', 'AE')).toBe(1.0);
    expect(getSubstitutionWeight('M', 'N')).toBe(1.0);
  });
});

describe('weightedEditDistance', () => {
  it('returns 0 for identical sequences', () => {
    expect(weightedEditDistance(['B', 'AE', 'T'], ['B', 'AE', 'T'])).toBe(0);
  });

  it('returns 0 for two empty sequences', () => {
    expect(weightedEditDistance([], [])).toBe(0);
  });

  it('returns length for empty vs non-empty', () => {
    expect(weightedEditDistance([], ['B', 'AE', 'T'])).toBe(3);
    expect(weightedEditDistance(['B', 'AE', 'T'], [])).toBe(3);
  });

  it('uses voicing pair weight for single substitution (P→B)', () => {
    // "P AE T" vs "B AE T" — only P→B differs, weight 0.3
    expect(weightedEditDistance(['P', 'AE', 'T'], ['B', 'AE', 'T'])).toBeCloseTo(0.3);
  });

  it('uses vowel length weight for IY→IH substitution', () => {
    // "B IY T" vs "B IH T" — only IY→IH differs, weight 0.4
    expect(weightedEditDistance(['B', 'IY', 'T'], ['B', 'IH', 'T'])).toBeCloseTo(0.4);
  });

  it('uses manner weight for S→SH substitution', () => {
    // "S IY" vs "SH IY" — only S→SH differs, weight 0.5
    expect(weightedEditDistance(['S', 'IY'], ['SH', 'IY'])).toBeCloseTo(0.5);
  });

  it('uses default weight 1.0 for unrelated substitution', () => {
    // "M AE T" vs "N AE T" — M→N, weight 1.0
    expect(weightedEditDistance(['M', 'AE', 'T'], ['N', 'AE', 'T'])).toBeCloseTo(1.0);
  });

  it('handles insertion cost', () => {
    // "B AE" vs "B AE T" — one insertion
    expect(weightedEditDistance(['B', 'AE'], ['B', 'AE', 'T'])).toBe(1);
  });

  it('handles deletion cost', () => {
    // "B AE T" vs "B AE" — one deletion
    expect(weightedEditDistance(['B', 'AE', 'T'], ['B', 'AE'])).toBe(1);
  });
});

describe('computeSimilarity', () => {
  it('returns 1.0 for identical sequences', () => {
    expect(computeSimilarity(['B', 'AE', 'T'], ['B', 'AE', 'T'])).toBe(1.0);
  });

  it('returns 1.0 for two empty sequences', () => {
    expect(computeSimilarity([], [])).toBe(1.0);
  });

  it('computes correct similarity for voicing pair difference', () => {
    // "P AE T" vs "B AE T": distance = 0.3, maxLen = 3
    // similarity = 1 - 0.3/3 = 0.9
    expect(computeSimilarity(['P', 'AE', 'T'], ['B', 'AE', 'T'])).toBeCloseTo(0.9);
  });

  it('returns 0 for completely different single-phoneme sequences', () => {
    // "P" vs "IY": distance = 1.0, maxLen = 1
    // similarity = 1 - 1/1 = 0
    expect(computeSimilarity(['P'], ['IY'])).toBeCloseTo(0);
  });
});

describe('computeDiffIndices', () => {
  it('returns empty array for identical sequences', () => {
    expect(computeDiffIndices(['B', 'AE', 'T'], ['B', 'AE', 'T'])).toEqual([]);
  });

  it('marks substitution position', () => {
    // query: P AE T, candidate: B AE T — position 0 differs
    expect(computeDiffIndices(['P', 'AE', 'T'], ['B', 'AE', 'T'])).toEqual([0]);
  });

  it('marks insertion position in candidate', () => {
    // query: B AE, candidate: B AE T — position 2 is inserted
    expect(computeDiffIndices(['B', 'AE'], ['B', 'AE', 'T'])).toEqual([2]);
  });

  it('marks multiple differences', () => {
    // query: P IY, candidate: B IH — positions 0 and 1 differ
    const diffs = computeDiffIndices(['P', 'IY'], ['B', 'IH']);
    expect(diffs).toEqual([0, 1]);
  });

  it('returns empty for two empty sequences', () => {
    expect(computeDiffIndices([], [])).toEqual([]);
  });
});
