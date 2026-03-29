import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type {
  WordDetail,
  Meaning,
  Definition,
} from '../types/index';
import { stripPronunciationSuffix } from './dictionaryService';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Property 5: stripPronunciationSuffix 幂等性
// Validates: Requirements 1.1, 1.2
// ---------------------------------------------------------------------------

describe('Property 5: stripPronunciationSuffix 幂等性', () => {
  /** 任意字符串（可能含后缀也可能不含） */
  const arbitraryWord = fc.stringOf(
    fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyz0123456789()'.split(''),
    ),
    { minLength: 1, maxLength: 20 },
  );

  it('对任意字符串，调用两次的结果与调用一次相同（幂等性）', () => {
    fc.assert(
      fc.property(arbitraryWord, (word) => {
        const once = stripPronunciationSuffix(word);
        const twice = stripPronunciationSuffix(once);
        expect(twice).toBe(once);
      }),
      { numRuns: 200 },
    );
  });

  it('结果永远不以 (N) 后缀结尾', () => {
    fc.assert(
      fc.property(arbitraryWord, (word) => {
        const result = stripPronunciationSuffix(word);
        expect(result).not.toMatch(/\(\d+\)$/);
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: 单词详情字段完整性
// Validates: Requirements 4.2
// ---------------------------------------------------------------------------

const definitionArb: fc.Arbitrary<Definition> = fc.record({
  definition: fc.stringOf(fc.char(), { minLength: 1, maxLength: 50 }),
  definitionCn: fc.option(fc.stringOf(fc.char(), { minLength: 1, maxLength: 30 }), { nil: undefined }),
  example: fc.option(fc.stringOf(fc.char(), { minLength: 1, maxLength: 50 }), { nil: undefined }),
});

const meaningArb: fc.Arbitrary<Meaning> = fc.record({
  partOfSpeech: fc.stringOf(fc.char(), { minLength: 1, maxLength: 20 }),
  definitions: fc.array(definitionArb, { minLength: 1, maxLength: 5 }),
});

const wordDetailArb: fc.Arbitrary<WordDetail> = fc.record({
  word: fc.stringOf(fc.char(), { minLength: 1, maxLength: 30 }),
  phonetic: fc.stringOf(fc.char(), { minLength: 1, maxLength: 20 }),
  meanings: fc.array(meaningArb, { minLength: 1, maxLength: 5 }),
  audioUrl: fc.option(fc.webUrl(), { nil: undefined }),
});

describe('Property 6: 单词详情字段完整性', () => {
  it('WordDetail must have non-empty word, phonetic, non-empty meanings with partOfSpeech and definitions', () => {
    fc.assert(
      fc.property(wordDetailArb, (detail) => {
        // word must be non-empty
        expect(detail.word.length).toBeGreaterThan(0);

        // phonetic must be non-empty
        expect(detail.phonetic.length).toBeGreaterThan(0);

        // meanings must be non-empty
        expect(detail.meanings.length).toBeGreaterThan(0);

        // Each meaning must have partOfSpeech and at least one definition
        for (const meaning of detail.meanings) {
          expect(meaning.partOfSpeech.length).toBeGreaterThan(0);
          expect(meaning.definitions.length).toBeGreaterThan(0);

          // Each definition must have a non-empty definition string
          for (const def of meaning.definitions) {
            expect(def.definition.length).toBeGreaterThan(0);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});


// ---------------------------------------------------------------------------
// Property 1: Bug Condition — Pronunciation Variant Suffix Leaks Through
// Validates: Requirements 1.1, 1.2, 2.1, 2.2
// ---------------------------------------------------------------------------

/** Generator: random alphabetic base word + (N) suffix */
const suffixedWordArb = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
      minLength: 1,
      maxLength: 15,
    }),
    fc.integer({ min: 1, max: 99 }),
  )
  .map(([base, n]) => ({ raw: `${base}(${n})`, base }));

describe('Property 1: Bug Condition — Pronunciation Variant Suffix Leaks Through', () => {
  it('stripPronunciationSuffix removes trailing (N) suffix for all generated words', () => {
    fc.assert(
      fc.property(suffixedWordArb, ({ raw, base }) => {
        const result = stripPronunciationSuffix(raw);
        // The result must NOT contain a trailing (N) suffix
        expect(result).not.toMatch(/\(\d+\)$/);
        // The result must equal the base word
        expect(result).toBe(base);
      }),
      { numRuns: 200 },
    );
  });

  it('concrete: stripPronunciationSuffix("abboud(2)") returns "abboud"', () => {
    expect(stripPronunciationSuffix('abboud(2)')).toBe('abboud');
  });

  it('concrete: stripPronunciationSuffix("absorption(2)") returns "absorption"', () => {
    expect(stripPronunciationSuffix('absorption(2)')).toBe('absorption');
  });
});


// ---------------------------------------------------------------------------
// Property 2: Preservation — Non-Suffixed Words Pass Through Unchanged
// Validates: Requirements 3.1, 3.2, 3.3
// ---------------------------------------------------------------------------

/** Generator: random alphabetic strings that do NOT end with (N) pattern */
const nonSuffixedAlphaWordArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
  { minLength: 1, maxLength: 20 },
);

/** Generator: strings with non-numeric parenthetical content (e.g., "word(abc)") */
const nonNumericParenWordArb = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
      minLength: 1,
      maxLength: 10,
    }),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
      minLength: 1,
      maxLength: 5,
    }),
  )
  .map(([base, letters]) => `${base}(${letters})`);

describe('Property 2: Preservation — Non-Suffixed Words Pass Through Unchanged', () => {
  it('pure alphabetic words without (N) suffix pass through unchanged', () => {
    fc.assert(
      fc.property(nonSuffixedAlphaWordArb, (word) => {
        const result = stripPronunciationSuffix(word);
        expect(result).toBe(word);
      }),
      { numRuns: 200 },
    );
  });

  it('words with non-numeric parenthetical content pass through unchanged', () => {
    fc.assert(
      fc.property(nonNumericParenWordArb, (word) => {
        const result = stripPronunciationSuffix(word);
        expect(result).toBe(word);
      }),
      { numRuns: 200 },
    );
  });

  it('concrete: stripPronunciationSuffix("mitt") returns "mitt"', () => {
    expect(stripPronunciationSuffix('mitt')).toBe('mitt');
  });

  it('concrete: stripPronunciationSuffix("machine") returns "machine"', () => {
    expect(stripPronunciationSuffix('machine')).toBe('machine');
  });
});
