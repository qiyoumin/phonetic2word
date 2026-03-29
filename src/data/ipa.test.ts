import { describe, it, expect } from 'vitest';
import ipaData from './ipa.json';

describe('IPA data file', () => {
  it('has system set to IPA', () => {
    expect(ipaData.system).toBe('IPA');
  });

  it('contains 39 phoneme symbols', () => {
    expect(ipaData.symbols).toHaveLength(39);
  });

  it('every symbol has required fields', () => {
    for (const sym of ipaData.symbols) {
      expect(sym.symbol).toBeTruthy();
      expect(sym.arpabetCode).toBeTruthy();
      expect(['vowel', 'consonant']).toContain(sym.category);
      expect(sym.example).toBeTruthy();
    }
  });

  it('contains all 15 vowels', () => {
    const vowels = ipaData.symbols.filter(s => s.category === 'vowel');
    expect(vowels).toHaveLength(15);
  });

  it('contains all 24 consonants', () => {
    const consonants = ipaData.symbols.filter(s => s.category === 'consonant');
    expect(consonants).toHaveLength(24);
  });

  it('has unique arpabetCodes', () => {
    const codes = ipaData.symbols.map(s => s.arpabetCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('has unique symbols', () => {
    const symbols = ipaData.symbols.map(s => s.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });
});
