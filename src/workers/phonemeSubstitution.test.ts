import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  CLOSE_PAIRS,
  getSubstituteCandidates,
  isCloseSubstitute,
} from './phonemeSubstitution';

describe('getSubstituteCandidates', () => {
  it('P 的候选应包含 B（清浊对立）', () => {
    expect(getSubstituteCandidates('P')).toContain('B');
  });

  it('B 的候选应包含 P（清浊对立，反向）', () => {
    expect(getSubstituteCandidates('B')).toContain('P');
  });

  it('未知音素应返回空数组', () => {
    expect(getSubstituteCandidates('UNKNOWN')).toEqual([]);
  });
});

describe('isCloseSubstitute', () => {
  it('P 和 B 是近似替换', () => {
    expect(isCloseSubstitute('P', 'B')).toBe(true);
  });

  it('B 和 P 是近似替换（对称性）', () => {
    expect(isCloseSubstitute('B', 'P')).toBe(true);
  });

  it('P 和 Z 不是近似替换', () => {
    expect(isCloseSubstitute('P', 'Z')).toBe(false);
  });

  it('S 和 SH 是近似替换（同方式）', () => {
    expect(isCloseSubstitute('S', 'SH')).toBe(true);
  });

  it('IY 和 IH 是近似替换（元音长度）', () => {
    expect(isCloseSubstitute('IY', 'IH')).toBe(true);
  });
});

/**
 * Property: CLOSE_PAIRS 对称性
 * 验证所有配对都是双向的——如果 (a, b) 在 CLOSE_PAIRS 中，
 * 则 isCloseSubstitute(a, b) 和 isCloseSubstitute(b, a) 都为 true。
 */
describe('Property: CLOSE_PAIRS 对称性', () => {
  it('所有 CLOSE_PAIRS 中的配对都应该是双向的', () => {
    const arbPair = fc.constantFrom(...CLOSE_PAIRS);

    fc.assert(
      fc.property(arbPair, ([a, b]) => {
        expect(isCloseSubstitute(a, b)).toBe(true);
        expect(isCloseSubstitute(b, a)).toBe(true);
        expect(getSubstituteCandidates(a)).toContain(b);
        expect(getSubstituteCandidates(b)).toContain(a);
      }),
      { numRuns: 100 },
    );
  });
});
