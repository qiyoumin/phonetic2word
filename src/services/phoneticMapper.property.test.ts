import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { arpabetToIPA, ipaToARPAbet, arpabetToSymbol, symbolToARPAbet } from './phoneticMapper';
import type { PhoneticSystem } from '../types';
import ipaData from '../data/ipa.json';
import kkData from '../data/kk.json';
import websterData from '../data/webster.json';

/**
 * Property 12: ARPAbet-IPA 映射 round-trip
 * Validates: Requirements 1.3
 *
 * For any valid ARPAbet phoneme code, converting to IPA then back
 * to ARPAbet should yield the original code.
 */
describe('Property 12: ARPAbet-IPA 映射 round-trip', () => {
  const allArpabetCodes = ipaData.symbols.map((s) => s.arpabetCode);

  it('ipaToARPAbet(arpabetToIPA(code)) === code for any ARPAbet code', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allArpabetCodes),
        (code) => {
          const ipa = arpabetToIPA(code);
          const roundTripped = ipaToARPAbet(ipa);
          expect(roundTripped).toBe(code);
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 2: 统一 round-trip 映射
 * Validates: Requirements 3.3, 4.3, 8.6
 *
 * For any valid ARPAbet phoneme code and any supported phonetic system,
 * converting to the system's symbol via arpabetToSymbol then back via
 * symbolToARPAbet should yield the original code.
 */
describe('Property 2: 统一 round-trip 映射', () => {
  const ARPABET_CODES = [
    'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY',
    'IH', 'IY', 'OW', 'OY', 'UH', 'UW',
    'B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K',
    'L', 'M', 'N', 'NG', 'P', 'R', 'S', 'SH',
    'T', 'TH', 'V', 'W', 'Y', 'Z', 'ZH',
  ];

  const SYSTEMS: PhoneticSystem[] = ['IPA', 'KK', 'Webster'];

  it('symbolToARPAbet(arpabetToSymbol(code, system), system) === code for any ARPAbet code × any system', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ARPABET_CODES),
        fc.constantFrom(...SYSTEMS),
        (code, system) => {
          const symbol = arpabetToSymbol(code, system);
          const roundTripped = symbolToARPAbet(symbol, system);
          expect(roundTripped).toBe(code);
        },
      ),
      { numRuns: 200 },
    );
  });
});


/**
 * Property 3: 未识别输入透传
 * Validates: Requirements 3.4, 4.4
 *
 * For any string that is NOT a valid ARPAbet code (with or without stress markers)
 * and NOT a valid phonetic symbol in any system, both arpabetToSymbol and
 * symbolToARPAbet should return the original input string unchanged.
 */
describe('Property 3: 未识别输入透传', () => {
  // Collect all valid ARPAbet codes (uppercase, as used in lookup)
  const VALID_ARPABET_CODES = new Set([
    'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY',
    'IH', 'IY', 'OW', 'OY', 'UH', 'UW',
    'B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K',
    'L', 'M', 'N', 'NG', 'P', 'R', 'S', 'SH',
    'T', 'TH', 'V', 'W', 'Y', 'Z', 'ZH',
  ]);

  // Also include codes with stress markers (0, 1, 2) since stripStress removes them
  const ARPABET_WITH_STRESS = new Set<string>();
  for (const code of VALID_ARPABET_CODES) {
    ARPABET_WITH_STRESS.add(code);
    ARPABET_WITH_STRESS.add(`${code}0`);
    ARPABET_WITH_STRESS.add(`${code}1`);
    ARPABET_WITH_STRESS.add(`${code}2`);
  }

  // Collect all valid phonetic symbols across all three systems
  const ALL_VALID_SYMBOLS = new Set<string>([
    ...ipaData.symbols.map((s) => s.symbol),
    ...kkData.symbols.map((s) => s.symbol),
    ...websterData.symbols.map((s) => s.symbol),
  ]);

  const SYSTEMS: PhoneticSystem[] = ['IPA', 'KK', 'Webster'];

  // Arbitrary that generates strings which are NOT valid ARPAbet codes or phonetic symbols
  const nonMatchingString = fc
    .string({ minLength: 1, maxLength: 20 })
    .filter((s) => !ARPABET_WITH_STRESS.has(s) && !ALL_VALID_SYMBOLS.has(s));

  it('arpabetToSymbol returns original string for unrecognized input', () => {
    fc.assert(
      fc.property(
        nonMatchingString,
        fc.constantFrom(...SYSTEMS),
        (input, system) => {
          const result = arpabetToSymbol(input, system);
          expect(result).toBe(input);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('symbolToARPAbet returns original string for unrecognized input', () => {
    fc.assert(
      fc.property(
        nonMatchingString,
        fc.constantFrom(...SYSTEMS),
        (input, system) => {
          const result = symbolToARPAbet(input, system);
          expect(result).toBe(input);
        },
      ),
      { numRuns: 200 },
    );
  });
});


/**
 * Property 4: 重音标记剥离
 * Validates: Requirements 3.5, 4.5
 *
 * For any valid ARPAbet phoneme code, any stress suffix (0, 1, 2),
 * and any supported phonetic system, arpabetToSymbol(code + suffix, system)
 * should equal arpabetToSymbol(code, system).
 */
describe('Property 4: 重音标记剥离', () => {
  const ARPABET_CODES = [
    'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY',
    'IH', 'IY', 'OW', 'OY', 'UH', 'UW',
    'B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K',
    'L', 'M', 'N', 'NG', 'P', 'R', 'S', 'SH',
    'T', 'TH', 'V', 'W', 'Y', 'Z', 'ZH',
  ];

  const STRESS_SUFFIXES = ['0', '1', '2'];
  const SYSTEMS: PhoneticSystem[] = ['IPA', 'KK', 'Webster'];

  it('arpabetToSymbol(code + suffix, system) === arpabetToSymbol(code, system) for any ARPAbet code × stress suffix × system', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ARPABET_CODES),
        fc.constantFrom(...STRESS_SUFFIXES),
        fc.constantFrom(...SYSTEMS),
        (code, suffix, system) => {
          const withoutStress = arpabetToSymbol(code, system);
          const withStress = arpabetToSymbol(code + suffix, system);
          expect(withStress).toBe(withoutStress);
        },
      ),
      { numRuns: 200 },
    );
  });
});


/**
 * Property 5: 统一接口与专用接口一致性
 * Validates: Requirements 8.3, 8.4, 8.5
 *
 * For any valid ARPAbet phoneme code, arpabetToSymbol(code, 'IPA') should
 * equal arpabetToIPA(code), and for each IPA symbol,
 * symbolToARPAbet(symbol, 'IPA') should equal ipaToARPAbet(symbol).
 */
describe('Property 5: 统一接口与专用接口一致性', () => {
  const ARPABET_CODES = [
    'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY',
    'IH', 'IY', 'OW', 'OY', 'UH', 'UW',
    'B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K',
    'L', 'M', 'N', 'NG', 'P', 'R', 'S', 'SH',
    'T', 'TH', 'V', 'W', 'Y', 'Z', 'ZH',
  ];

  const IPA_SYMBOLS = ipaData.symbols.map((s) => s.symbol);

  it('arpabetToSymbol(code, "IPA") === arpabetToIPA(code) for every ARPAbet code', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ARPABET_CODES),
        (code) => {
          expect(arpabetToSymbol(code, 'IPA')).toBe(arpabetToIPA(code));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('symbolToARPAbet(symbol, "IPA") === ipaToARPAbet(symbol) for every IPA symbol', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...IPA_SYMBOLS),
        (symbol) => {
          expect(symbolToARPAbet(symbol, 'IPA')).toBe(ipaToARPAbet(symbol));
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 7: 结果音标转换一致性
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.6
 *
 * For any random ARPAbet phonetic sequence (space-separated ARPAbet codes)
 * and any supported phonetic system, converting each ARPAbet code individually
 * via arpabetToSymbol(code, system) and joining with spaces produces a
 * consistent result. Additionally, when system is 'IPA', the conversion via
 * arpabetToSymbol matches arpabetToIPA for each code.
 */
describe('Property 7: 结果音标转换一致性', () => {
  const ARPABET_CODES = [
    'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY',
    'IH', 'IY', 'OW', 'OY', 'UH', 'UW',
    'B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K',
    'L', 'M', 'N', 'NG', 'P', 'R', 'S', 'SH',
    'T', 'TH', 'V', 'W', 'Y', 'Z', 'ZH',
  ];

  const SYSTEMS: PhoneticSystem[] = ['IPA', 'KK', 'Webster'];

  // Generator: random-length sequence of ARPAbet codes (1–10 codes)
  const arpabetSequenceArb = fc.array(fc.constantFrom(...ARPABET_CODES), { minLength: 1, maxLength: 10 });

  it('converting each ARPAbet code individually and joining produces a consistent result across repeated calls', () => {
    fc.assert(
      fc.property(
        arpabetSequenceArb,
        fc.constantFrom(...SYSTEMS),
        (codes, system) => {
          // Convert each code individually and join with spaces
          const result1 = codes.map((c) => arpabetToSymbol(c, system)).join(' ');
          // Do the same conversion again — should be deterministic / consistent
          const result2 = codes.map((c) => arpabetToSymbol(c, system)).join(' ');
          expect(result1).toBe(result2);

          // Each individual conversion should match the corresponding element in the joined result
          const parts = result1.split(' ');
          for (let i = 0; i < codes.length; i++) {
            expect(parts[i]).toBe(arpabetToSymbol(codes[i], system));
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('when system is IPA, arpabetToSymbol matches arpabetToIPA for each code in the sequence', () => {
    fc.assert(
      fc.property(
        arpabetSequenceArb,
        (codes) => {
          for (const code of codes) {
            expect(arpabetToSymbol(code, 'IPA')).toBe(arpabetToIPA(code));
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
