import type { PhoneticSystem } from '../types';
import ipaData from '../data/ipa.json';
import kkData from '../data/kk.json';
import websterData from '../data/webster.json';

// Build lookup maps for each phonetic system
function buildMaps(data: typeof ipaData) {
  const arpabetToSymbol = new Map<string, string>();
  const symbolToArpabet = new Map<string, string>();
  for (const entry of data.symbols) {
    arpabetToSymbol.set(entry.arpabetCode, entry.symbol);
    symbolToArpabet.set(entry.symbol, entry.arpabetCode);
  }
  return { arpabetToSymbol, symbolToArpabet };
}

const ipaMaps = buildMaps(ipaData);
const kkMaps = buildMaps(kkData);
const websterMaps = buildMaps(websterData);

// Convenience aliases for backward compatibility
const arpabetToIPAMap = ipaMaps.arpabetToSymbol;
const ipaToARPAbetMap = ipaMaps.symbolToArpabet;

function getMaps(system: PhoneticSystem) {
  switch (system) {
    case 'IPA': return ipaMaps;
    case 'KK': return kkMaps;
    case 'Webster': return websterMaps;
  }
}

/**
 * Strip ARPAbet stress markers (0, 1, 2 suffix) before lookup.
 * e.g. "IY1" -> "IY", "AH0" -> "AH", "B" -> "B"
 */
function stripStress(arpabet: string): string {
  return arpabet.replace(/[012]$/, '');
}

/**
 * Convert an ARPAbet phoneme code to its IPA equivalent.
 * Handles stress markers (0/1/2 suffix) by stripping them before lookup.
 * Returns the original string if no mapping is found.
 */
export function arpabetToIPA(arpabet: string): string {
  const base = stripStress(arpabet);
  return arpabetToIPAMap.get(base) ?? arpabet;
}

/**
 * Convert an IPA symbol to its ARPAbet equivalent.
 * Returns the original string if no mapping is found.
 */
export function ipaToARPAbet(ipa: string): string {
  return ipaToARPAbetMap.get(ipa) ?? ipa;
}

/**
 * Convert an ARPAbet phoneme code to the symbol of the specified phonetic system.
 * Handles stress markers (0/1/2 suffix) by stripping them before lookup.
 * Returns the original string if no mapping is found.
 */
export function arpabetToSymbol(arpabet: string, system: PhoneticSystem): string {
  const base = stripStress(arpabet);
  return getMaps(system).arpabetToSymbol.get(base) ?? arpabet;
}

/**
 * Convert a phonetic symbol to its ARPAbet equivalent for the specified system.
 * Returns the original string if no mapping is found.
 */
export function symbolToARPAbet(symbol: string, system: PhoneticSystem): string {
  return getMaps(system).symbolToArpabet.get(symbol) ?? symbol;
}
