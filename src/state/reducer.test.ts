import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appReducer, MAX_SEQUENCE_LENGTH, loadSavedSystem } from './reducer';
import type { AppState, PhoneticSymbol, WordDetail } from '../types';

// Mock localStorage for node test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

const makeSymbol = (symbol: string, arpabetCode: string, index: number): PhoneticSymbol => ({
  symbol,
  arpabetCode,
  index,
});

describe('appReducer', () => {
  // initialState is computed at module load; re-derive a clean baseline
  const baseState: AppState = {
    currentSystem: 'IPA',
    sequence: [],
    searchStatus: 'idle',
    results: [],
    fuzzyResults: [],
    selectedWord: null,
    detailLoading: false,
    error: null,
  };

  beforeEach(() => {
    localStorageMock.clear();
  });

  it('has correct initial state shape', () => {
    expect(baseState.sequence).toEqual([]);
    expect(baseState.searchStatus).toBe('idle');
  });

  describe('SWITCH_SYSTEM', () => {
    it('switches system and clears sequence', () => {
      const stateWithSequence: AppState = {
        ...baseState,
        sequence: [makeSymbol('b', 'B', 0)],
      };
      const result = appReducer(stateWithSequence, { type: 'SWITCH_SYSTEM', payload: 'KK' });
      expect(result.currentSystem).toBe('KK');
      expect(result.sequence).toEqual([]);
    });

    it('resets search state on system switch', () => {
      const stateWithResults: AppState = {
        ...baseState,
        searchStatus: 'success',
        results: [{ word: 'test', phonetic: 'tɛst', arpabet: 'T EH S T', partOfSpeech: ['noun'], briefDefinition: 'a test' }],
      };
      const result = appReducer(stateWithResults, { type: 'SWITCH_SYSTEM', payload: 'KK' });
      expect(result.searchStatus).toBe('idle');
      expect(result.results).toEqual([]);
    });
  });

  describe('APPEND_SYMBOL', () => {
    it('appends symbol to sequence', () => {
      const sym = makeSymbol('b', 'B', 0);
      const result = appReducer(baseState, { type: 'APPEND_SYMBOL', payload: sym });
      expect(result.sequence).toHaveLength(1);
      expect(result.sequence[0]).toEqual(sym);
    });

    it('does not exceed max sequence length', () => {
      const fullSequence = Array.from({ length: MAX_SEQUENCE_LENGTH }, (_, i) =>
        makeSymbol('b', 'B', i)
      );
      const state: AppState = { ...baseState, sequence: fullSequence };
      const result = appReducer(state, { type: 'APPEND_SYMBOL', payload: makeSymbol('p', 'P', 20) });
      expect(result.sequence).toHaveLength(MAX_SEQUENCE_LENGTH);
    });
  });

  describe('REMOVE_SYMBOL', () => {
    it('removes symbol by index', () => {
      const state: AppState = {
        ...baseState,
        sequence: [makeSymbol('b', 'B', 0), makeSymbol('æ', 'AE', 1), makeSymbol('t', 'T', 2)],
      };
      const result = appReducer(state, { type: 'REMOVE_SYMBOL', payload: 1 });
      expect(result.sequence).toHaveLength(2);
      expect(result.sequence[0].symbol).toBe('b');
      expect(result.sequence[1].symbol).toBe('t');
    });
  });

  describe('CLEAR_SEQUENCE', () => {
    it('clears the sequence', () => {
      const state: AppState = {
        ...baseState,
        sequence: [makeSymbol('b', 'B', 0)],
      };
      const result = appReducer(state, { type: 'CLEAR_SEQUENCE' });
      expect(result.sequence).toEqual([]);
    });
  });

  describe('FILL_SEQUENCE', () => {
    it('fills system and sequence from history', () => {
      const seq = [makeSymbol('b', 'B', 0), makeSymbol('æ', 'AE', 1)];
      const result = appReducer(baseState, {
        type: 'FILL_SEQUENCE',
        payload: { system: 'KK', sequence: seq },
      });
      expect(result.currentSystem).toBe('KK');
      expect(result.sequence).toEqual(seq);
    });
  });

  describe('SEARCH_START', () => {
    it('sets loading status and clears previous results', () => {
      const result = appReducer(baseState, { type: 'SEARCH_START' });
      expect(result.searchStatus).toBe('loading');
      expect(result.results).toEqual([]);
      expect(result.fuzzyResults).toEqual([]);
      expect(result.selectedWord).toBeNull();
      expect(result.error).toBeNull();
    });
  });

  describe('SEARCH_SUCCESS', () => {
    it('sets success status with results', () => {
      const results = [{ word: 'bat', phonetic: 'bæt', arpabet: 'B AE T', partOfSpeech: ['noun'], briefDefinition: 'a bat' }];
      const result = appReducer(baseState, {
        type: 'SEARCH_SUCCESS',
        payload: { results, fuzzyResults: [] },
      });
      expect(result.searchStatus).toBe('success');
      expect(result.results).toEqual(results);
    });
  });

  describe('SEARCH_EMPTY', () => {
    it('sets empty status', () => {
      const result = appReducer(baseState, { type: 'SEARCH_EMPTY' });
      expect(result.searchStatus).toBe('empty');
      expect(result.results).toEqual([]);
    });
  });

  describe('SEARCH_ERROR', () => {
    it('sets error status with message', () => {
      const result = appReducer(baseState, { type: 'SEARCH_ERROR', payload: 'Network error' });
      expect(result.searchStatus).toBe('error');
      expect(result.error).toBe('Network error');
    });
  });

  describe('SELECT_WORD', () => {
    it('sets selected word detail', () => {
      const detail: WordDetail = {
        word: 'bat',
        phonetic: 'bæt',
        meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'a bat' }] }],
      };
      const result = appReducer(baseState, { type: 'SELECT_WORD', payload: detail });
      expect(result.selectedWord).toEqual(detail);
    });

    it('clears detailLoading when word is selected', () => {
      const state: AppState = { ...baseState, detailLoading: true };
      const detail: WordDetail = {
        word: 'bat',
        phonetic: 'bæt',
        meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'a bat' }] }],
      };
      const result = appReducer(state, { type: 'SELECT_WORD', payload: detail });
      expect(result.detailLoading).toBe(false);
      expect(result.selectedWord).toEqual(detail);
    });
  });

  describe('SELECT_WORD_START', () => {
    it('sets detailLoading to true', () => {
      const result = appReducer(baseState, { type: 'SELECT_WORD_START' });
      expect(result.detailLoading).toBe(true);
    });

    it('preserves other state fields', () => {
      const state: AppState = {
        ...baseState,
        searchStatus: 'success',
        results: [{ word: 'bat', phonetic: 'bæt', arpabet: 'B AE T', partOfSpeech: ['noun'], briefDefinition: 'a bat' }],
      };
      const result = appReducer(state, { type: 'SELECT_WORD_START' });
      expect(result.detailLoading).toBe(true);
      expect(result.searchStatus).toBe('success');
      expect(result.results).toEqual(state.results);
    });
  });

  describe('SELECT_WORD_ERROR', () => {
    it('clears detailLoading on error', () => {
      const state: AppState = { ...baseState, detailLoading: true };
      const result = appReducer(state, { type: 'SELECT_WORD_ERROR' });
      expect(result.detailLoading).toBe(false);
    });
  });

  describe('DESELECT_WORD', () => {
    it('sets selectedWord to null', () => {
      const detail: WordDetail = {
        word: 'bat',
        phonetic: 'bæt',
        meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'a bat' }] }],
      };
      const state: AppState = { ...baseState, selectedWord: detail };
      const result = appReducer(state, { type: 'DESELECT_WORD' });
      expect(result.selectedWord).toBeNull();
    });

    it('preserves search results when deselecting', () => {
      const results = [{ word: 'bat', phonetic: 'bæt', arpabet: 'B AE T', partOfSpeech: ['noun'], briefDefinition: 'a bat' }];
      const detail: WordDetail = {
        word: 'bat',
        phonetic: 'bæt',
        meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'a bat' }] }],
      };
      const state: AppState = {
        ...baseState,
        searchStatus: 'success',
        results,
        selectedWord: detail,
      };
      const result = appReducer(state, { type: 'DESELECT_WORD' });
      expect(result.results).toEqual(results);
      expect(result.searchStatus).toBe('success');
    });
  });

  describe('localStorage persistence', () => {
    it('loadSavedSystem loads saved system from localStorage', () => {
      localStorageMock.setItem('phonetic-system', 'KK');
      expect(loadSavedSystem()).toBe('KK');
      localStorageMock.setItem('phonetic-system', 'Webster');
      expect(loadSavedSystem()).toBe('Webster');
    });

    it('ignores invalid values in localStorage and defaults to IPA', () => {
      localStorageMock.setItem('phonetic-system', 'INVALID');
      expect(loadSavedSystem()).toBe('IPA');
    });

    it('defaults to IPA when localStorage is empty', () => {
      expect(loadSavedSystem()).toBe('IPA');
    });

    it('reducer is a pure function — SWITCH_SYSTEM does not write to localStorage', () => {
      appReducer(baseState, { type: 'SWITCH_SYSTEM', payload: 'KK' });
      // saveSystem 已移到 useEffect，reducer 不再有副作用
      expect(localStorageMock.getItem('phonetic-system')).toBeNull();
    });

    it('reducer is a pure function — FILL_SEQUENCE does not write to localStorage', () => {
      const seq = [makeSymbol('b', 'B', 0)];
      appReducer(baseState, {
        type: 'FILL_SEQUENCE',
        payload: { system: 'Webster', sequence: seq },
      });
      expect(localStorageMock.getItem('phonetic-system')).toBeNull();
    });
  });
});
