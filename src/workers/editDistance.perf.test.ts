import { describe, it, expect } from 'vitest';
import { weightedEditDistance, computeSimilarity, computeDiffIndices } from './editDistance';

const ARPABET_CODES = [
  'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY',
  'IH', 'IY', 'OW', 'OY', 'UH', 'UW',
  'B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K',
  'L', 'M', 'N', 'NG', 'P', 'R', 'S', 'SH',
  'T', 'TH', 'V', 'W', 'Y', 'Z', 'ZH',
];

function randomSeq(len: number): string[] {
  return Array.from({ length: len }, () =>
    ARPABET_CODES[Math.floor(Math.random() * ARPABET_CODES.length)],
  );
}

describe('editDistance 性能测试', () => {
  it('weightedEditDistance: 1000 次长度 10 的序列对比应在 50ms 内完成', () => {
    const pairs = Array.from({ length: 1000 }, () => [randomSeq(10), randomSeq(10)] as const);

    const start = performance.now();
    for (const [a, b] of pairs) {
      weightedEditDistance(a, b);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  });

  it('computeSimilarity: 1000 次长度 10 的序列对比应在 50ms 内完成', () => {
    const pairs = Array.from({ length: 1000 }, () => [randomSeq(10), randomSeq(10)] as const);

    const start = performance.now();
    for (const [a, b] of pairs) {
      computeSimilarity(a, b);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
  });

  it('computeDiffIndices: 1000 次长度 10 的序列对比应在 100ms 内完成', () => {
    const pairs = Array.from({ length: 1000 }, () => [randomSeq(10), randomSeq(10)] as const);

    const start = performance.now();
    for (const [a, b] of pairs) {
      computeDiffIndices(a, b);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
  });

  it('weightedEditDistance: 长度 20 的最大序列应在 1ms 内完成', () => {
    const a = randomSeq(20);
    const b = randomSeq(20);

    const start = performance.now();
    weightedEditDistance(a, b);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1);
  });
});
