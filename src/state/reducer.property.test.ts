import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { appReducer, initialState } from './reducer';
import type { AppState, PhoneticSystem } from '../types';

// Generator for a random PhoneticSymbol
const phoneticSymbolArb = fc.record({
  symbol: fc.stringOf(fc.char(), { minLength: 1, maxLength: 5 }),
  arpabetCode: fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
    minLength: 1,
    maxLength: 3,
  }),
  index: fc.nat({ max: 100 }),
});

// Generator for a non-empty array of PhoneticSymbol
const nonEmptySequenceArb = fc.array(phoneticSymbolArb, { minLength: 1, maxLength: 19 });

// Generator for a PhoneticSystem
const phoneticSystemArb = fc.constantFrom<PhoneticSystem>('IPA', 'KK', 'Webster');

/**
 * Property 1: 切换体系清空序列
 * Validates: Requirements 1.4
 *
 * For any phonetic system and any non-empty sequence,
 * SWITCH_SYSTEM results in an empty sequence.
 */
describe('Property 1: 切换体系清空序列', () => {
  it('SWITCH_SYSTEM always results in empty sequence', () => {
    fc.assert(
      fc.property(
        phoneticSystemArb,
        nonEmptySequenceArb,
        (targetSystem, sequence) => {
          const state: AppState = {
            ...initialState,
            sequence,
          };
          const result = appReducer(state, {
            type: 'SWITCH_SYSTEM',
            payload: targetSystem,
          });
          expect(result.sequence).toEqual([]);
          expect(result.currentSystem).toBe(targetSystem);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 2: 符号追加保持顺序
 * Validates: Requirements 2.2, 2.3
 *
 * For any sequence (length < 20) and any symbol, APPEND_SYMBOL results in
 * length+1, last element is the new symbol, and original order is preserved.
 */
describe('Property 2: 符号追加保持顺序', () => {
  it('APPEND_SYMBOL increases length by 1, appends to end, preserves order', () => {
    fc.assert(
      fc.property(
        fc.array(phoneticSymbolArb, { minLength: 0, maxLength: 19 }),
        phoneticSymbolArb,
        (sequence, newSymbol) => {
          const state: AppState = {
            ...initialState,
            sequence,
          };
          const result = appReducer(state, {
            type: 'APPEND_SYMBOL',
            payload: newSymbol,
          });

          // Length should increase by 1
          expect(result.sequence).toHaveLength(sequence.length + 1);

          // Last element should be the new symbol
          expect(result.sequence[result.sequence.length - 1]).toEqual(newSymbol);

          // Original elements should preserve order
          for (let i = 0; i < sequence.length; i++) {
            expect(result.sequence[i]).toEqual(sequence[i]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 3: 序列符号移除
 * Validates: Requirements 2.4, 2.5
 *
 * For any non-empty sequence and valid index, REMOVE_SYMBOL results in
 * length-1 and relative order preserved.
 * CLEAR_SEQUENCE results in length 0.
 */
describe('Property 3: 序列符号移除', () => {
  it('REMOVE_SYMBOL decreases length by 1 and preserves relative order', () => {
    fc.assert(
      fc.property(
        nonEmptySequenceArb.chain((seq) =>
          fc.tuple(fc.constant(seq), fc.integer({ min: 0, max: seq.length - 1 })),
        ),
        ([sequence, removeIndex]) => {
          const state: AppState = {
            ...initialState,
            sequence,
          };
          const result = appReducer(state, {
            type: 'REMOVE_SYMBOL',
            payload: removeIndex,
          });

          // Length should decrease by 1
          expect(result.sequence).toHaveLength(sequence.length - 1);

          // Relative order should be preserved (all elements except the removed one)
          const expected = [...sequence.slice(0, removeIndex), ...sequence.slice(removeIndex + 1)];
          expect(result.sequence).toEqual(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('CLEAR_SEQUENCE results in length 0', () => {
    fc.assert(
      fc.property(
        nonEmptySequenceArb,
        (sequence) => {
          const state: AppState = {
            ...initialState,
            sequence,
          };
          const result = appReducer(state, { type: 'CLEAR_SEQUENCE' });
          expect(result.sequence).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// --- Generators for DESELECT_WORD property tests ---

const wordResultArb = fc.record({
  word: fc.string({ minLength: 1, maxLength: 10 }),
  phonetic: fc.string({ minLength: 1, maxLength: 10 }),
  arpabet: fc.string({ minLength: 1, maxLength: 20 }),
  partOfSpeech: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 3 }),
  briefDefinition: fc.string({ minLength: 1, maxLength: 30 }),
});

const fuzzyWordResultArb = fc.record({
  word: fc.string({ minLength: 1, maxLength: 10 }),
  phonetic: fc.string({ minLength: 1, maxLength: 10 }),
  arpabet: fc.string({ minLength: 1, maxLength: 20 }),
  partOfSpeech: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 3 }),
  briefDefinition: fc.string({ minLength: 1, maxLength: 30 }),
  similarity: fc.double({ min: 0, max: 1, noNaN: true }),
  diffIndices: fc.array(fc.nat({ max: 20 }), { maxLength: 5 }),
});

const definitionArb = fc.record({
  definition: fc.string({ minLength: 1, maxLength: 30 }),
});

const meaningArb = fc.record({
  partOfSpeech: fc.string({ minLength: 1, maxLength: 10 }),
  definitions: fc.array(definitionArb, { minLength: 1, maxLength: 3 }),
});

const wordDetailArb = fc.record({
  word: fc.string({ minLength: 1, maxLength: 10 }),
  phonetic: fc.string({ minLength: 1, maxLength: 10 }),
  meanings: fc.array(meaningArb, { minLength: 1, maxLength: 3 }),
});

const searchStatusArb = fc.constantFrom<AppState['searchStatus']>('idle', 'loading', 'success', 'empty', 'error');

/**
 * Feature: search-result-navigation-and-history-scroll, Property 1: DESELECT_WORD 保留搜索结果
 * Validates: Requirements 1.2, 1.3
 *
 * For any AppState where selectedWord is not null and searchStatus is 'success',
 * dispatching DESELECT_WORD should set selectedWord to null while preserving
 * results, fuzzyResults, and searchStatus.
 */
describe('Property: DESELECT_WORD 保留搜索结果', () => {
  it('DESELECT_WORD sets selectedWord to null and preserves search results', () => {
    fc.assert(
      fc.property(
        wordDetailArb,
        fc.array(wordResultArb, { minLength: 1, maxLength: 5 }),
        fc.array(fuzzyWordResultArb, { minLength: 0, maxLength: 5 }),
        phoneticSystemArb,
        fc.array(phoneticSymbolArb, { minLength: 0, maxLength: 10 }),
        (selectedWord, results, fuzzyResults, system, sequence) => {
          const state: AppState = {
            currentSystem: system,
            sequence,
            searchStatus: 'success',
            results,
            fuzzyResults,
            selectedWord,
            error: null,
          };

          const result = appReducer(state, { type: 'DESELECT_WORD' });

          expect(result.selectedWord).toBeNull();
          expect(result.results).toEqual(results);
          expect(result.fuzzyResults).toEqual(fuzzyResults);
          expect(result.searchStatus).toBe('success');
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: search-result-navigation-and-history-scroll, Property 2: 选中-取消选中-再选中往返一致性
 * Validates: Requirements 1.6
 *
 * For any initial AppState and any two different WordDetail objects,
 * SELECT_WORD(word1) -> DESELECT_WORD -> SELECT_WORD(word2) should result in
 * selectedWord === word2, with results and fuzzyResults unchanged.
 */
describe('Property: 选中-取消选中-再选中往返一致性', () => {
  it('SELECT -> DESELECT -> SELECT roundtrip preserves results and sets correct selectedWord', () => {
    fc.assert(
      fc.property(
        fc.array(wordResultArb, { minLength: 0, maxLength: 5 }),
        fc.array(fuzzyWordResultArb, { minLength: 0, maxLength: 5 }),
        wordDetailArb,
        wordDetailArb,
        phoneticSystemArb,
        searchStatusArb,
        (results, fuzzyResults, word1, word2, system, searchStatus) => {
          const state: AppState = {
            currentSystem: system,
            sequence: [],
            searchStatus,
            results,
            fuzzyResults,
            selectedWord: null,
            error: null,
          };

          const afterSelect1 = appReducer(state, { type: 'SELECT_WORD', payload: word1 });
          const afterDeselect = appReducer(afterSelect1, { type: 'DESELECT_WORD' });
          const afterSelect2 = appReducer(afterDeselect, { type: 'SELECT_WORD', payload: word2 });

          expect(afterSelect2.selectedWord).toEqual(word2);
          expect(afterSelect2.results).toEqual(results);
          expect(afterSelect2.fuzzyResults).toEqual(fuzzyResults);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: search-result-navigation-and-history-scroll, Property 3: SEARCH_START 清除选中状态
 * Validates: Requirements 1.7
 *
 * For any AppState where selectedWord is not null,
 * dispatching SEARCH_START should set selectedWord to null.
 */
describe('Property: SEARCH_START 清除选中状态', () => {
  it('SEARCH_START clears selectedWord to null', () => {
    fc.assert(
      fc.property(
        wordDetailArb,
        phoneticSystemArb,
        fc.array(phoneticSymbolArb, { minLength: 0, maxLength: 10 }),
        searchStatusArb,
        (selectedWord, system, sequence, searchStatus) => {
          const state: AppState = {
            currentSystem: system,
            sequence,
            searchStatus,
            results: [],
            fuzzyResults: [],
            selectedWord,
            error: null,
          };

          const result = appReducer(state, { type: 'SEARCH_START' });

          expect(result.selectedWord).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: kk-webster-phonetic-support, Property 6: 体系切换状态重置
 * Validates: Requirements 7.1, 7.2
 *
 * For any AppState (with non-empty sequence, non-idle searchStatus, non-empty results)
 * and any target PhoneticSystem, dispatching SWITCH_SYSTEM should reset:
 * - sequence to empty array
 * - searchStatus to 'idle'
 * - results to empty array
 * - fuzzyResults to empty array
 */
describe('Property 6: 体系切换状态重置', () => {
  it('SWITCH_SYSTEM resets sequence, searchStatus, results, and fuzzyResults', () => {
    const appStateArb = fc.record({
      currentSystem: phoneticSystemArb,
      sequence: fc.array(phoneticSymbolArb, { minLength: 1, maxLength: 10 }),
      searchStatus: fc.constantFrom<AppState['searchStatus']>('loading', 'success', 'empty', 'error'),
      results: fc.array(wordResultArb, { minLength: 1, maxLength: 5 }),
      fuzzyResults: fc.array(fuzzyWordResultArb, { minLength: 1, maxLength: 5 }),
      selectedWord: fc.oneof(fc.constant(null), wordDetailArb),
      error: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 20 })),
    });

    fc.assert(
      fc.property(
        appStateArb,
        phoneticSystemArb,
        (state, targetSystem) => {
          const result = appReducer(state, {
            type: 'SWITCH_SYSTEM',
            payload: targetSystem,
          });

          expect(result.sequence).toEqual([]);
          expect(result.searchStatus).toBe('idle');
          expect(result.results).toEqual([]);
          expect(result.fuzzyResults).toEqual([]);
        },
      ),
      { numRuns: 100 },
    );
  });
});
