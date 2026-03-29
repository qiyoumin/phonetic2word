import { describe, it, expect } from 'vitest';
import { appReducer, initialState } from './reducer';
import type { AppState, PhoneticSymbol } from '../types';

function makeSymbol(index: number): PhoneticSymbol {
  return { symbol: 'b', arpabetCode: 'B', index };
}

describe('reducer 性能测试', () => {
  it('APPEND_SYMBOL: 连续追加 20 个符号应在 5ms 内完成', () => {
    let state: AppState = { ...initialState };

    const start = performance.now();
    for (let i = 0; i < 20; i++) {
      state = appReducer(state, { type: 'APPEND_SYMBOL', payload: makeSymbol(i) });
    }
    const elapsed = performance.now() - start;

    expect(state.sequence).toHaveLength(20);
    expect(elapsed).toBeLessThan(5);
  });

  it('REMOVE_SYMBOL: 从 20 个符号逐个移除应在 5ms 内完成', () => {
    let state: AppState = { ...initialState };
    for (let i = 0; i < 20; i++) {
      state = appReducer(state, { type: 'APPEND_SYMBOL', payload: makeSymbol(i) });
    }

    const start = performance.now();
    for (let i = 19; i >= 0; i--) {
      state = appReducer(state, { type: 'REMOVE_SYMBOL', payload: i });
    }
    const elapsed = performance.now() - start;

    expect(state.sequence).toHaveLength(0);
    expect(elapsed).toBeLessThan(5);
  });

  it('SWITCH_SYSTEM: 1000 次体系切换应在 10ms 内完成', () => {
    const systems = ['IPA', 'KK', 'Webster'] as const;
    let state: AppState = { ...initialState };

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      state = appReducer(state, { type: 'SWITCH_SYSTEM', payload: systems[i % 3] });
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10);
  });

  it('SEARCH_SUCCESS: 处理大结果集（100 个结果）应在 5ms 内完成', () => {
    const results = Array.from({ length: 100 }, (_, i) => ({
      word: `word${i}`,
      phonetic: `phonetic${i}`,
      arpabet: `B IH D`,
      partOfSpeech: ['noun'],
      briefDefinition: `definition ${i}`,
    }));

    let state: AppState = { ...initialState, searchStatus: 'loading' };

    const start = performance.now();
    state = appReducer(state, {
      type: 'SEARCH_SUCCESS',
      payload: { results, fuzzyResults: [] },
    });
    const elapsed = performance.now() - start;

    expect(state.results).toHaveLength(100);
    expect(elapsed).toBeLessThan(5);
  });
});
