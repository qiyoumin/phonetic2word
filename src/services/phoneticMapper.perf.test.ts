import { describe, it, expect } from 'vitest';
import { arpabetToSymbol, symbolToARPAbet, arpabetToIPA, ipaToARPAbet } from './phoneticMapper';
import type { PhoneticSystem } from '../types';

const ARPABET_CODES = [
  'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY',
  'IH', 'IY', 'OW', 'OY', 'UH', 'UW',
  'B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K',
  'L', 'M', 'N', 'NG', 'P', 'R', 'S', 'SH',
  'T', 'TH', 'V', 'W', 'Y', 'Z', 'ZH',
];

const SYSTEMS: PhoneticSystem[] = ['IPA', 'KK', 'Webster'];

describe('phoneticMapper 性能测试', () => {
  it('arpabetToSymbol: 10000 次转换应在 10ms 内完成', () => {
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      const code = ARPABET_CODES[i % ARPABET_CODES.length];
      const system = SYSTEMS[i % SYSTEMS.length];
      arpabetToSymbol(code, system);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10);
  });

  it('symbolToARPAbet round-trip: 10000 次往返转换应在 20ms 内完成', () => {
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      const code = ARPABET_CODES[i % ARPABET_CODES.length];
      const system = SYSTEMS[i % SYSTEMS.length];
      const symbol = arpabetToSymbol(code, system);
      symbolToARPAbet(symbol, system);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(20);
  });

  it('arpabetToIPA + ipaToARPAbet: 10000 次往返应在 10ms 内完成', () => {
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      const code = ARPABET_CODES[i % ARPABET_CODES.length];
      const ipa = arpabetToIPA(code);
      ipaToARPAbet(ipa);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10);
  });

  it('带重音标记的转换: 10000 次应在 10ms 内完成', () => {
    const stressSuffixes = ['0', '1', '2'];
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      const code = ARPABET_CODES[i % ARPABET_CODES.length];
      const suffix = stressSuffixes[i % 3];
      arpabetToSymbol(code + suffix, 'IPA');
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10);
  });
});
