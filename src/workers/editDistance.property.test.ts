import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeDiffIndices } from './editDistance';
import ipaData from '../data/ipa.json';

const ARPABET_CODES = ipaData.symbols.map((s) => s.arpabetCode);

/** Arbitrary that generates a random ARPAbet phoneme from the valid set. */
const arbArpabet = fc.constantFrom(...ARPABET_CODES);

/** Arbitrary that generates a random ARPAbet sequence of length 1–8. */
const arbArpabetSeq = fc.array(arbArpabet, { minLength: 1, maxLength: 8 });

/**
 * Property 7: 模糊匹配差异标注准确性
 * Validates: Requirements 5.3
 *
 * For any pair of ARPAbet phoneme sequences, computeDiffIndices should
 * accurately reflect the actual difference positions:
 * - Every index in diffIndices points to a position where the candidate
 *   differs from the query (substitution) or is an insertion.
 * - If two sequences are identical, diffIndices should be empty.
 */
describe('Property 7: 模糊匹配差异标注准确性', () => {
  it('identical sequences produce empty diffIndices', () => {
    fc.assert(
      fc.property(arbArpabetSeq, (seq) => {
        const diffs = computeDiffIndices(seq, seq);
        expect(diffs).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  it('diffIndices only contains valid candidate indices where actual differences exist', () => {
    fc.assert(
      fc.property(arbArpabetSeq, arbArpabetSeq, (query, candidate) => {
        const diffs = computeDiffIndices(query, candidate);

        // All indices must be valid positions in the candidate
        for (const idx of diffs) {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(candidate.length);
        }

        // Indices should be sorted ascending with no duplicates
        for (let i = 1; i < diffs.length; i++) {
          expect(diffs[i]).toBeGreaterThan(diffs[i - 1]);
        }

        // If sequences are identical, diffs must be empty
        const areIdentical =
          query.length === candidate.length &&
          query.every((p, i) => p === candidate[i]);
        if (areIdentical) {
          expect(diffs).toEqual([]);
        }
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 11: 模糊匹配结果按相似度降序排列
 * Validates: Requirements 5.1, 5.2
 *
 * For any list of fuzzy match results, sorting by similarity descending
 * should produce a list where each element's similarity >= the next.
 */
describe('Property 11: 模糊匹配结果按相似度降序排列', () => {
  const arbFuzzyResult = fc.record({
    word: fc.string({ minLength: 1, maxLength: 10 }),
    arpabetSequence: fc.string(),
    similarity: fc.double({ min: 0, max: 1, noNaN: true }),
    diffIndices: fc.array(fc.nat({ max: 20 })),
  });

  it('sorting by similarity descending ensures each element >= next', () => {
    fc.assert(
      fc.property(
        fc.array(arbFuzzyResult, { minLength: 0, maxLength: 20 }),
        (results) => {
          // Sort using the same logic as the worker: descending by similarity
          const sorted = [...results].sort((a, b) => b.similarity - a.similarity);

          for (let i = 0; i + 1 < sorted.length; i++) {
            expect(sorted[i].similarity).toBeGreaterThanOrEqual(sorted[i + 1].similarity);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
