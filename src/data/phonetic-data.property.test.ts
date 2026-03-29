import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import ipaData from './ipa.json';
import kkData from './kk.json';
import websterData from './webster.json';

/**
 * Property 1: 音标数据文件完整性
 * Validates: Requirements 1.1, 1.4, 2.1, 2.4
 *
 * For any supported phonetic system (IPA, KK, Webster), its data file must
 * contain exactly 39 symbols (15 vowels + 24 consonants), every symbol must
 * have non-empty symbol, arpabetCode, category, and example fields, and the
 * set of arpabetCode values must exactly match the standard CMU Dict 39 phonemes.
 */

const STANDARD_VOWELS = [
  'AA', 'AE', 'AH', 'AO', 'AW', 'AY',
  'EH', 'ER', 'EY', 'IH', 'IY',
  'OW', 'OY', 'UH', 'UW',
] as const;

const STANDARD_CONSONANTS = [
  'B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH',
  'K', 'L', 'M', 'N', 'NG', 'P', 'R', 'S',
  'SH', 'T', 'TH', 'V', 'W', 'Y', 'Z', 'ZH',
] as const;

const STANDARD_ARPABET = new Set([...STANDARD_VOWELS, ...STANDARD_CONSONANTS]);

const ALL_SYSTEMS = [
  { name: 'IPA', data: ipaData },
  { name: 'KK', data: kkData },
  { name: 'Webster', data: websterData },
] as const;

describe('Property 1: 音标数据文件完整性', () => {
  const systemArb = fc.constantFrom(...ALL_SYSTEMS);

  it('each system has exactly 39 symbols total', () => {
    fc.assert(
      fc.property(systemArb, ({ name, data }) => {
        expect(data.symbols, `${name} should have 39 symbols`).toHaveLength(39);
      }),
      { numRuns: 100 },
    );
  });

  it('each system has exactly 15 vowels and 24 consonants', () => {
    fc.assert(
      fc.property(systemArb, ({ name, data }) => {
        const vowels = data.symbols.filter(s => s.category === 'vowel');
        const consonants = data.symbols.filter(s => s.category === 'consonant');
        expect(vowels, `${name} should have 15 vowels`).toHaveLength(15);
        expect(consonants, `${name} should have 24 consonants`).toHaveLength(24);
      }),
      { numRuns: 100 },
    );
  });

  it('every symbol has non-empty required fields (symbol, arpabetCode, category, example)', () => {
    fc.assert(
      fc.property(
        systemArb.chain(sys =>
          fc.integer({ min: 0, max: sys.data.symbols.length - 1 }).map(idx => ({
            systemName: sys.name,
            sym: sys.data.symbols[idx],
          })),
        ),
        ({ systemName, sym }) => {
          expect(typeof sym.symbol, `${systemName}: symbol should be string`).toBe('string');
          expect(sym.symbol.length, `${systemName}: symbol should be non-empty`).toBeGreaterThan(0);

          expect(typeof sym.arpabetCode, `${systemName}: arpabetCode should be string`).toBe('string');
          expect(sym.arpabetCode.length, `${systemName}: arpabetCode should be non-empty`).toBeGreaterThan(0);

          expect(['vowel', 'consonant'], `${systemName}: category should be vowel or consonant`).toContain(sym.category);

          expect(typeof sym.example, `${systemName}: example should be string`).toBe('string');
          expect(sym.example.length, `${systemName}: example should be non-empty`).toBeGreaterThan(0);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('each system arpabetCode set exactly matches the standard CMU Dict 39 phonemes', () => {
    fc.assert(
      fc.property(systemArb, ({ name, data }) => {
        const codes = new Set(data.symbols.map(s => s.arpabetCode));
        expect(codes.size, `${name}: should have 39 unique arpabetCodes`).toBe(39);
        for (const code of STANDARD_ARPABET) {
          expect(codes.has(code), `${name}: missing arpabetCode ${code}`).toBe(true);
        }
        for (const code of codes) {
          expect(STANDARD_ARPABET.has(code as any), `${name}: unexpected arpabetCode ${code}`).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 8: 体系内符号唯一性
 * Validates: Requirements 1.1, 2.1, 3.2, 4.2
 *
 * For any supported phonetic system (IPA, KK, Webster), all `symbol` field
 * values within that system's data file must be unique (no duplicates).
 * This ensures the reverse mapping `symbolToARPAbet` is unambiguous.
 */
describe('Property 8: 体系内符号唯一性', () => {
  const systemArb = fc.constantFrom(...ALL_SYSTEMS);

  it('all symbol values within each system are unique', () => {
    fc.assert(
      fc.property(systemArb, ({ name, data }) => {
        const symbols = data.symbols.map(s => s.symbol);
        const uniqueSymbols = new Set(symbols);
        expect(uniqueSymbols.size, `${name}: symbol values should be unique`).toBe(symbols.length);
      }),
      { numRuns: 100 },
    );
  });
});
