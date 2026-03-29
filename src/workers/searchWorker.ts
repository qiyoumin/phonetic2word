/**
 * Web Worker for phonetic search (exact + fuzzy matching).
 *
 * Message protocol:
 *   Incoming:
 *     { type: 'SEARCH_EXACT', payload: { arpabetSequence: string[] } }
 *     { type: 'SEARCH_FUZZY', payload: { arpabetSequence: string[] } }
 *   Outgoing:
 *     { type: 'SEARCH_EXACT_RESULT', payload: { words: string[] } }
 *     { type: 'SEARCH_FUZZY_RESULT', payload: { results: FuzzyMatchResult[] } }
 */

import { computeSimilarity, computeDiffIndices } from './editDistance';
import { getCacheService } from '../services/cacheService';
import { createLoadShard } from './shardLoader';
import { getSubstituteCandidates, isCloseSubstitute } from './phonemeSubstitution';
import type { PhoneticIndex } from '../types/index';

// --- Types ---

export interface FuzzyMatchResult {
  word: string;
  arpabetSequence: string;
  similarity: number;
  diffIndices: number[];
}

type IncomingMessage =
  | { type: 'SEARCH_EXACT'; payload: { arpabetSequence: string[] } }
  | { type: 'SEARCH_FUZZY'; payload: { arpabetSequence: string[] } };

// --- Shard cache (three-level: memory → IndexedDB → network) ---

const shardCache = new Map<string, PhoneticIndex>();
const cache = getCacheService();

// --- Version check state ---
let cacheStale = false;
let versionCheckPromise: Promise<void> | null = null;

/**
 * Fetch manifest.json (5s timeout), compare version with IndexedDB.
 * If versions differ, set cacheStale = true and store new version.
 * On failure, degrade gracefully — use existing cache.
 */
async function checkVersion(): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${import.meta.env.BASE_URL}manifest.json`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return; // degradation: use existing cache

    const manifest = await response.json();
    const cachedVersion = await cache.getCachedVersion();

    if (cachedVersion !== manifest.version) {
      cacheStale = true;
      await cache.setCachedVersion(manifest.version);
    }
  } catch {
    // manifest fetch failed — degrade to using existing cache
  }
}

const loadShard = createLoadShard({
  memoryCache: shardCache,
  cacheService: cache,
  fetchFn: (url: string) => fetch(url),
  isCacheStale: () => cacheStale,
  basePath: import.meta.env.BASE_URL,
});

// --- Exact search ---

async function searchExact(arpabetSequence: string[]): Promise<string[]> {
  if (arpabetSequence.length === 0) return [];

  const firstPhoneme = arpabetSequence[0];
  const shard = await loadShard(firstPhoneme);
  const key = arpabetSequence.join(' ');
  return shard[key] ?? [];
}

// --- Fuzzy search ---

const SIMILARITY_THRESHOLD = 0.7;
const MAX_RESULTS = 10;
const LENGTH_TOLERANCE = 2;

async function searchFuzzy(arpabetSequence: string[]): Promise<FuzzyMatchResult[]> {
  if (arpabetSequence.length === 0) return [];

  const queryLen = arpabetSequence.length;
  const firstPhoneme = arpabetSequence[0];
  const lastPhoneme = arpabetSequence[arpabetSequence.length - 1];

  // Collect candidate shards to search.
  const shardsToSearch = new Set<string>();
  shardsToSearch.add(firstPhoneme);

  // Also add shards for common substitutes of the first phoneme
  const firstPhonemeSubstitutes = getSubstituteCandidates(firstPhoneme);
  for (const sub of firstPhonemeSubstitutes) {
    shardsToSearch.add(sub);
  }

  const results: FuzzyMatchResult[] = [];

  for (const shardKey of shardsToSearch) {
    const shard = await loadShard(shardKey);

    for (const [candidateKey, words] of Object.entries(shard)) {
      const candidateSeq = candidateKey.split(' ');
      const candidateLen = candidateSeq.length;

      // Pre-filter: length ±2
      if (Math.abs(candidateLen - queryLen) > LENGTH_TOLERANCE) continue;

      // Pre-filter: last phoneme must match or be a close substitute
      const candidateLast = candidateSeq[candidateSeq.length - 1];
      if (candidateLast !== lastPhoneme && !isCloseSubstitute(candidateLast, lastPhoneme)) {
        continue;
      }

      const similarity = computeSimilarity(arpabetSequence, candidateSeq);
      if (similarity < SIMILARITY_THRESHOLD) continue;

      const diffIndices = computeDiffIndices(arpabetSequence, candidateSeq);

      for (const word of words) {
        results.push({
          word,
          arpabetSequence: candidateKey,
          similarity,
          diffIndices,
        });
      }
    }
  }

  // Sort by similarity descending, take top MAX_RESULTS
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, MAX_RESULTS);
}

// --- Worker message handler ---

declare const self: { onmessage: ((event: MessageEvent) => void) | null; postMessage: (message: unknown) => void };

self.onmessage = async (event: MessageEvent<IncomingMessage>) => {
  const { type, payload } = event.data;
  const requestId = (event.data as { requestId?: string }).requestId;

  // Lazy init: trigger version check on first search request
  if (!versionCheckPromise) {
    versionCheckPromise = checkVersion();
  }

  try {
    if (type === 'SEARCH_EXACT') {
      const words = await searchExact(payload.arpabetSequence);
      self.postMessage({
        type: 'SEARCH_EXACT_RESULT',
        requestId,
        payload: { words },
      });
    } else if (type === 'SEARCH_FUZZY') {
      const results = await searchFuzzy(payload.arpabetSequence);
      self.postMessage({
        type: 'SEARCH_FUZZY_RESULT',
        requestId,
        payload: { results },
      });
    }
  } catch (err) {
    self.postMessage({
      type: 'WORKER_ERROR',
      requestId,
      payload: { message: err instanceof Error ? err.message : String(err) },
    });
  }
};
