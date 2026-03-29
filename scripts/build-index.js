#!/usr/bin/env node

/**
 * Build script: generates CMU Pronouncing Dictionary index shards.
 *
 * Each shard is keyed by the first (stress-stripped) phoneme and contains
 * a mapping from the full stress-stripped ARPAbet sequence to an array of
 * matching words.
 *
 * Output: public/index-shards/index-{PHONEME}.json
 */

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const cmuModule = require('cmu-pronouncing-dictionary');
const cmuDict = cmuModule.dictionary || cmuModule;
const englishWords = require('an-array-of-english-words');
const englishWordSet = new Set(englishWords);

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'index-shards');

// Ensure output directory exists
mkdirSync(outDir, { recursive: true });

/**
 * Strip stress markers (0, 1, 2) from a single ARPAbet phoneme.
 * e.g. "IY1" -> "IY", "B" -> "B"
 */
function stripStress(phoneme) {
  return phoneme.replace(/[012]$/, '');
}

// Group entries by first phoneme
const shards = {};

for (const [word, pronunciation] of Object.entries(cmuDict)) {
  // Skip entries that aren't plain words (e.g. words starting with ')
  if (!/^[a-z]/i.test(word)) continue;

  // Strip pronunciation variant suffix, e.g. "mit(2)" -> "mit"
  const baseWord = word.replace(/\(\d+\)$/, '').toLowerCase();

  // Filter: only keep words that exist in the English word list
  if (!englishWordSet.has(baseWord)) continue;

  // pronunciation is a space-separated ARPAbet string, e.g. "HH AH0 L OW1"
  const phonemes = pronunciation.split(' ');
  const strippedPhonemes = phonemes.map(stripStress);
  const firstPhoneme = strippedPhonemes[0];
  const key = strippedPhonemes.join(' ');

  if (!shards[firstPhoneme]) {
    shards[firstPhoneme] = {};
  }
  if (!shards[firstPhoneme][key]) {
    shards[firstPhoneme][key] = [];
  }
  shards[firstPhoneme][key].push(word);
}

// Write each shard to a JSON file
let totalWords = 0;
const shardNames = Object.keys(shards).sort();

for (const phoneme of shardNames) {
  const filename = `index-${phoneme}.json`;
  const filepath = join(outDir, filename);
  const data = shards[phoneme];
  const wordCount = Object.values(data).reduce((sum, arr) => sum + arr.length, 0);
  totalWords += wordCount;
  writeFileSync(filepath, JSON.stringify(data), 'utf-8');
}

console.log(`Built ${shardNames.length} shard files in ${outDir}`);
console.log(`Total words indexed: ${totalWords}`);
console.log(`English word filter: ${englishWordSet.size} words in dictionary`);
console.log(`Shards: ${shardNames.join(', ')}`);
