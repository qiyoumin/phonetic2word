import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import ipaData from '../data/ipa.json';

/**
 * Property 4: 音标数据完整性
 * Validates: Requirements 2.1, 2.6
 *
 * For any phonetic symbol in the IPA data, it must belong to either
 * vowel or consonant category, contain a non-empty example, and
 * a non-empty arpabetCode.
 */
describe('Property 4: 音标数据完整性', () => {
  const symbols = ipaData.symbols;

  it('every symbol belongs to vowel or consonant, has non-empty example and arpabetCode', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: symbols.length - 1 }),
        (index) => {
          const sym = symbols[index];

          // Must belong to vowel or consonant
          expect(['vowel', 'consonant']).toContain(sym.category);

          // Must have non-empty example
          expect(sym.example).toBeTruthy();
          expect(sym.example.length).toBeGreaterThan(0);

          // Must have non-empty arpabetCode
          expect(sym.arpabetCode).toBeTruthy();
          expect(sym.arpabetCode.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
