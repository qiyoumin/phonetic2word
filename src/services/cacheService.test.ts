import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryCacheService } from './cacheService';
import type { PhoneticIndex, WordDetail } from '../types/index';

describe('MemoryCacheService', () => {
  let cache: MemoryCacheService;

  beforeEach(() => {
    cache = new MemoryCacheService();
  });

  describe('index shard caching', () => {
    it('returns null for uncached shard', async () => {
      expect(await cache.getIndexShard('B')).toBeNull();
    });

    it('caches and retrieves an index shard', async () => {
      const shard: PhoneticIndex = {
        'B IY': ['be', 'bee'],
        'B AE T': ['bat'],
      };
      await cache.cacheIndexShard('B', shard);
      const result = await cache.getIndexShard('B');
      expect(result).toEqual(shard);
    });

    it('overwrites existing shard', async () => {
      const shard1: PhoneticIndex = { 'B IY': ['be'] };
      const shard2: PhoneticIndex = { 'B IY': ['be', 'bee'] };
      await cache.cacheIndexShard('B', shard1);
      await cache.cacheIndexShard('B', shard2);
      expect(await cache.getIndexShard('B')).toEqual(shard2);
    });
  });

  describe('version caching', () => {
    it('returns null when no version is cached', async () => {
      expect(await cache.getCachedVersion()).toBeNull();
    });

    it('stores and retrieves a version string', async () => {
      await cache.setCachedVersion('abc123');
      expect(await cache.getCachedVersion()).toBe('abc123');
    });

    it('overwrites existing version', async () => {
      await cache.setCachedVersion('v1');
      await cache.setCachedVersion('v2');
      expect(await cache.getCachedVersion()).toBe('v2');
    });
  });

  describe('clearIndexShards', () => {
    it('clears all cached shards', async () => {
      const shard: PhoneticIndex = { 'B IY': ['be'] };
      await cache.cacheIndexShard('B', shard);
      await cache.clearIndexShards();
      expect(await cache.getIndexShard('B')).toBeNull();
    });

    it('clears cached version as well', async () => {
      await cache.setCachedVersion('v1');
      await cache.cacheIndexShard('B', { 'B IY': ['be'] });
      await cache.clearIndexShards();
      expect(await cache.getCachedVersion()).toBeNull();
    });

    it('does not affect word detail cache', async () => {
      const detail: WordDetail = {
        word: 'test',
        phonetic: '/tɛst/',
        meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'a test' }] }],
      };
      await cache.cacheWordDetail('test', detail);
      await cache.clearIndexShards();
      expect(await cache.getWordDetail('test')).toEqual(detail);
    });
  });

  describe('word detail caching', () => {
    const detail: WordDetail = {
      word: 'hello',
      phonetic: '/həˈloʊ/',
      meanings: [
        {
          partOfSpeech: 'noun',
          definitions: [{ definition: 'a greeting' }],
        },
      ],
    };

    it('returns null for uncached word', async () => {
      expect(await cache.getWordDetail('hello')).toBeNull();
    });

    it('caches and retrieves word detail', async () => {
      await cache.cacheWordDetail('hello', detail);
      expect(await cache.getWordDetail('hello')).toEqual(detail);
    });

    it('overwrites existing word detail', async () => {
      const updated: WordDetail = { ...detail, phonetic: '/hɛˈloʊ/' };
      await cache.cacheWordDetail('hello', detail);
      await cache.cacheWordDetail('hello', updated);
      expect(await cache.getWordDetail('hello')).toEqual(updated);
    });
  });
});

describe('MemoryCacheService LRU eviction', () => {
  it('evicts oldest entries when exceeding MAX_WORD_CACHE_SIZE', async () => {
    // Use a fresh cache instance. MAX_WORD_CACHE_SIZE is 2000 in production,
    // but we test the eviction behavior by filling past the limit.
    // To keep the test fast, we'll monkey-patch or just verify the behavior
    // by inserting 2001 entries and checking that the count drops.
    const cache = new MemoryCacheService();

    const makeDetail = (word: string): WordDetail => ({
      word,
      phonetic: `/${word}/`,
      meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: `def of ${word}` }] }],
    });

    // Insert 2001 entries (exceeds the 2000 limit)
    for (let i = 0; i < 2001; i++) {
      await cache.cacheWordDetail(`word${i}`, makeDetail(`word${i}`));
    }

    // After eviction, oldest 20% (~400 entries) should be removed
    // The earliest entries (word0, word1, ...) should be evicted
    // The latest entries should still be present
    const latestWord = await cache.getWordDetail('word2000');
    expect(latestWord).not.toBeNull();
    expect(latestWord?.word).toBe('word2000');

    // Some of the earliest entries should have been evicted
    let evictedCount = 0;
    for (let i = 0; i < 400; i++) {
      const result = await cache.getWordDetail(`word${i}`);
      if (result === null) evictedCount++;
    }
    // At least some of the oldest entries should be gone
    expect(evictedCount).toBeGreaterThan(0);
  });

  it('updates accessedAt on getWordDetail to keep frequently accessed entries', async () => {
    const cache = new MemoryCacheService();

    const makeDetail = (word: string): WordDetail => ({
      word,
      phonetic: `/${word}/`,
      meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: `def of ${word}` }] }],
    });

    // Insert word0 first (oldest by insertion order)
    await cache.cacheWordDetail('word0', makeDetail('word0'));

    // Insert 1999 more entries
    for (let i = 1; i < 2000; i++) {
      await cache.cacheWordDetail(`word${i}`, makeDetail(`word${i}`));
    }

    // Access word0 to refresh its timestamp — use a small delay to ensure
    // Date.now() returns a newer value than the batch-inserted entries
    await new Promise((r) => setTimeout(r, 5));
    await cache.getWordDetail('word0');

    // Now insert one more to trigger eviction
    await new Promise((r) => setTimeout(r, 5));
    await cache.cacheWordDetail('word2000', makeDetail('word2000'));

    // word0 should survive because its accessedAt was refreshed
    const word0 = await cache.getWordDetail('word0');
    expect(word0).not.toBeNull();
    expect(word0?.word).toBe('word0');
  });

  it('does not evict when under the limit', async () => {
    const cache = new MemoryCacheService();

    const makeDetail = (word: string): WordDetail => ({
      word,
      phonetic: `/${word}/`,
      meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: `def of ${word}` }] }],
    });

    // Insert 100 entries (well under 2000 limit)
    for (let i = 0; i < 100; i++) {
      await cache.cacheWordDetail(`word${i}`, makeDetail(`word${i}`));
    }

    // All entries should still be present
    for (let i = 0; i < 100; i++) {
      const result = await cache.getWordDetail(`word${i}`);
      expect(result).not.toBeNull();
    }
  });
});
