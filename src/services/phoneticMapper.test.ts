import { describe, it, expect } from 'vitest';
import { arpabetToIPA, ipaToARPAbet } from './phoneticMapper';

describe('phoneticMapper', () => {
  describe('arpabetToIPA', () => {
    it('converts basic vowels', () => {
      expect(arpabetToIPA('IY')).toBe('iː');
      expect(arpabetToIPA('IH')).toBe('ɪ');
      expect(arpabetToIPA('AA')).toBe('ɑː');
      expect(arpabetToIPA('AE')).toBe('æ');
    });

    it('converts basic consonants', () => {
      expect(arpabetToIPA('B')).toBe('b');
      expect(arpabetToIPA('CH')).toBe('tʃ');
      expect(arpabetToIPA('SH')).toBe('ʃ');
      expect(arpabetToIPA('TH')).toBe('θ');
      expect(arpabetToIPA('NG')).toBe('ŋ');
    });

    it('strips stress markers before lookup', () => {
      expect(arpabetToIPA('IY1')).toBe('iː');
      expect(arpabetToIPA('AH0')).toBe('ʌ');
      expect(arpabetToIPA('EY2')).toBe('eɪ');
    });

    it('returns original string for unknown codes', () => {
      expect(arpabetToIPA('UNKNOWN')).toBe('UNKNOWN');
    });
  });

  describe('ipaToARPAbet', () => {
    it('converts IPA vowels to ARPAbet', () => {
      expect(ipaToARPAbet('iː')).toBe('IY');
      expect(ipaToARPAbet('ɪ')).toBe('IH');
      expect(ipaToARPAbet('ɑː')).toBe('AA');
    });

    it('converts IPA consonants to ARPAbet', () => {
      expect(ipaToARPAbet('b')).toBe('B');
      expect(ipaToARPAbet('tʃ')).toBe('CH');
      expect(ipaToARPAbet('ʃ')).toBe('SH');
      expect(ipaToARPAbet('ŋ')).toBe('NG');
    });

    it('returns original string for unknown symbols', () => {
      expect(ipaToARPAbet('???')).toBe('???');
    });
  });
});
