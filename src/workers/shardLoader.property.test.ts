import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateManifest } from './manifestUtils';

/**
 * Arbitrary that generates a Map of shard filenames to content strings.
 * Filenames follow the pattern "index-XX.json".
 */
const arbShardContents = fc
  .uniqueArray(
    fc.tuple(
      fc.stringMatching(/^[A-Z]{1,3}$/).map((code) => `index-${code}.json`),
      fc.string({ minLength: 1, maxLength: 200 }),
    ),
    { minLength: 1, maxLength: 20, selector: ([name]) => name },
  )
  .map((entries) => new Map(entries));

/**
 * Feature: shard-cache-and-deployment, Property 1:
 * 对于任意一组分片文件名和内容，生成的 manifest 应包含非空 version 和匹配的 shards 数组
 *
 * **Validates: Requirements 1.2, 1.3**
 */
describe('Feature: shard-cache-and-deployment, Property 1: 对于任意一组分片文件名和内容，生成的 manifest 应包含非空 version 和匹配的 shards 数组', () => {
  it('manifest has non-empty version and shards matching input filenames', () => {
    fc.assert(
      fc.property(arbShardContents, (shardContents) => {
        const manifest = generateManifest(shardContents);

        // version must be a non-empty string
        expect(manifest.version).toBeTruthy();
        expect(typeof manifest.version).toBe('string');
        expect(manifest.version.length).toBeGreaterThan(0);

        // shards must match the input filenames (sorted)
        const expectedShards = Array.from(shardContents.keys()).sort();
        expect(manifest.shards).toEqual(expectedShards);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: shard-cache-and-deployment, Property 2:
 * 对于任意一组分片文件内容，两次生成应产生相同 version
 *
 * **Validates: Requirements 1.4**
 */
describe('Feature: shard-cache-and-deployment, Property 2: 对于任意一组分片文件内容，两次生成应产生相同 version', () => {
  it('calling generateManifest twice with the same input produces the same version', () => {
    fc.assert(
      fc.property(arbShardContents, (shardContents) => {
        const manifest1 = generateManifest(shardContents);
        const manifest2 = generateManifest(shardContents);

        expect(manifest1.version).toBe(manifest2.version);
        expect(manifest1.shards).toEqual(manifest2.shards);
      }),
      { numRuns: 100 },
    );
  });
});

import { createLoadShard } from './shardLoader';
import { MemoryCacheService } from '../services/cacheService';
import type { CacheService } from '../services/cacheService';
import type { PhoneticIndex } from '../types/index';

/**
 * Arbitrary: generates a valid ARPABET-style phoneme key (1-3 uppercase letters).
 */
const arbPhoneme = fc.stringMatching(/^[A-Z]{1,3}$/);

/**
 * Arbitrary: generates a PhoneticIndex object with 1-5 entries.
 */
const arbPhoneticIndex: fc.Arbitrary<PhoneticIndex> = fc
  .uniqueArray(
    fc.tuple(
      fc.array(arbPhoneme, { minLength: 1, maxLength: 3 }).map((seq) => seq.join(' ')),
      fc.array(fc.stringMatching(/^[a-z]{2,8}$/), { minLength: 1, maxLength: 3 }),
    ),
    { minLength: 1, maxLength: 5, selector: ([key]) => key },
  )
  .map((entries) => Object.fromEntries(entries));

/**
 * Helper: creates a mock fetch function that returns the given data for any URL.
 */
function createMockFetch(data: PhoneticIndex): (url: string) => Promise<Response> {
  return async () =>
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Helper: creates a mock fetch that tracks call count.
 */
function createTrackedFetch(data: PhoneticIndex) {
  let callCount = 0;
  const fetchFn = async () => {
    callCount++;
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { fetchFn, getCallCount: () => callCount };
}

/**
 * Feature: shard-cache-and-deployment, Property 3:
 * 对于任意分片 key，若缓存中已存在该分片，loadShard 应返回缓存数据且不发起 fetch
 *
 * **Validates: Requirements 2.1, 2.2**
 */
describe('Feature: shard-cache-and-deployment, Property 3: 对于任意分片 key，若缓存中已存在该分片，loadShard 应返回缓存数据且不发起 fetch', () => {
  it('returns cached data from memory without calling fetch', async () => {
    await fc.assert(
      fc.asyncProperty(arbPhoneme, arbPhoneticIndex, async (phoneme, shardData) => {
        const memoryCache = new Map<string, PhoneticIndex>();
        memoryCache.set(phoneme, shardData);

        const { fetchFn, getCallCount } = createTrackedFetch({});
        const cacheService = new MemoryCacheService();

        const loadShard = createLoadShard({ memoryCache, cacheService, fetchFn });
        const result = await loadShard(phoneme);

        expect(result).toEqual(shardData);
        expect(getCallCount()).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  it('returns cached data from IndexedDB without calling fetch', async () => {
    await fc.assert(
      fc.asyncProperty(arbPhoneme, arbPhoneticIndex, async (phoneme, shardData) => {
        const memoryCache = new Map<string, PhoneticIndex>();
        const cacheService = new MemoryCacheService();
        await cacheService.cacheIndexShard(phoneme, shardData);

        const { fetchFn, getCallCount } = createTrackedFetch({});

        const loadShard = createLoadShard({ memoryCache, cacheService, fetchFn });
        const result = await loadShard(phoneme);

        expect(result).toEqual(shardData);
        expect(getCallCount()).toBe(0);
        // Should also be written to memory cache
        expect(memoryCache.get(phoneme)).toEqual(shardData);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: shard-cache-and-deployment, Property 4:
 * 对于任意分片 key，缓存未命中时 fetch 后应同时存在于内存和 IndexedDB 中
 *
 * **Validates: Requirements 2.3, 2.5**
 */
describe('Feature: shard-cache-and-deployment, Property 4: 对于任意分片 key，缓存未命中时 fetch 后应同时存在于内存和 IndexedDB 中', () => {
  it('after cache miss, data exists in both memory and IndexedDB', async () => {
    await fc.assert(
      fc.asyncProperty(arbPhoneme, arbPhoneticIndex, async (phoneme, shardData) => {
        const memoryCache = new Map<string, PhoneticIndex>();
        const cacheService = new MemoryCacheService();
        const fetchFn = createMockFetch(shardData);

        const loadShard = createLoadShard({ memoryCache, cacheService, fetchFn });
        const result = await loadShard(phoneme);

        // Returned data matches fetched data
        expect(result).toEqual(shardData);
        // Written to memory cache
        expect(memoryCache.get(phoneme)).toEqual(shardData);
        // Written to IndexedDB (MemoryCacheService)
        const idbStored = await cacheService.getIndexShard(phoneme);
        expect(idbStored).toEqual(shardData);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: shard-cache-and-deployment, Property 5:
 * 对于任意分片 key，即使 IndexedDB 写入失败，loadShard 仍应返回有效数据
 *
 * **Validates: Requirements 2.4**
 */
describe('Feature: shard-cache-and-deployment, Property 5: 对于任意分片 key，即使 IndexedDB 写入失败，loadShard 仍应返回有效数据', () => {
  it('returns valid data even when IndexedDB write throws', async () => {
    await fc.assert(
      fc.asyncProperty(arbPhoneme, arbPhoneticIndex, async (phoneme, shardData) => {
        const memoryCache = new Map<string, PhoneticIndex>();

        // Create a CacheService that throws on write but works for reads
        const failingCacheService: CacheService = {
          async getIndexShard() { return null; },
          async cacheIndexShard() { throw new Error('IndexedDB write failed'); },
          async getWordDetail() { return null; },
          async cacheWordDetail() { throw new Error('IndexedDB write failed'); },
          async getCachedVersion() { return null; },
          async setCachedVersion() { throw new Error('IndexedDB write failed'); },
          async clearIndexShards() { throw new Error('IndexedDB clear failed'); },
        };

        const fetchFn = createMockFetch(shardData);

        const loadShard = createLoadShard({
          memoryCache,
          cacheService: failingCacheService,
          fetchFn,
        });
        const result = await loadShard(phoneme);

        // Should still return valid data
        expect(result).toEqual(shardData);
        // Should still be in memory cache
        expect(memoryCache.get(phoneme)).toEqual(shardData);
      }),
      { numRuns: 100 },
    );
  });
});


import { checkVersionResult } from './shardLoader';

/**
 * Feature: shard-cache-and-deployment, Property 6:
 * 对于任意两个版本号，相同时 cacheStale=false，不同时 cacheStale=true
 *
 * **Validates: Requirements 3.2, 3.3**
 */
describe('Feature: shard-cache-and-deployment, Property 6: 对于任意两个版本号，相同时 cacheStale=false，不同时 cacheStale=true', () => {
  it('same versions → cacheStale is false', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 64 }),
        (version) => {
          const stale = checkVersionResult(version, version);
          expect(stale).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('different versions → cacheStale is true', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 64 }),
        fc.string({ minLength: 1, maxLength: 64 }),
        (v1, v2) => {
          fc.pre(v1 !== v2);
          const stale = checkVersionResult(v1, v2);
          expect(stale).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('null cached version (first visit) → cacheStale is true', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 64 }),
        (remoteVersion) => {
          const stale = checkVersionResult(null, remoteVersion);
          expect(stale).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: shard-cache-and-deployment, Property 8:
 * 对于任意分片 key，manifest fetch 失败且缓存存在时应返回缓存数据
 *
 * **Validates: Requirements 4.1, 4.2**
 */
describe('Feature: shard-cache-and-deployment, Property 8: 对于任意分片 key，manifest fetch 失败且缓存存在时应返回缓存数据', () => {
  it('when manifest fetch fails and IndexedDB has cached data, loadShard returns cached data', async () => {
    await fc.assert(
      fc.asyncProperty(arbPhoneme, arbPhoneticIndex, async (phoneme, shardData) => {
        const memoryCache = new Map<string, PhoneticIndex>();
        const cacheService = new MemoryCacheService();
        // Pre-populate IndexedDB with cached shard data
        await cacheService.cacheIndexShard(phoneme, shardData);

        // manifest fetch failed → cacheStale stays false → IndexedDB is used
        const fetchFn = async () => {
          throw new Error('Network error');
        };

        const loadShard = createLoadShard({
          memoryCache,
          cacheService,
          fetchFn,
          isCacheStale: () => false, // manifest failed, so stale flag not set
        });

        const result = await loadShard(phoneme);
        expect(result).toEqual(shardData);
      }),
      { numRuns: 100 },
    );
  });
});


import { buildShardUrl } from './shardLoader';

/**
 * Feature: shard-cache-and-deployment, Property 9:
 * 对于任意 base 路径和分片文件名，构造的 URL 应为 basePath + index-shards/ + shardFileName
 *
 * **Validates: Requirements 5.4**
 */
describe('Feature: shard-cache-and-deployment, Property 9: 对于任意 base 路径和分片文件名，构造的 URL 应为 basePath + index-shards/ + shardFileName', () => {
  /**
   * Arbitrary: generates a base path string like "/", "/app/", "/phonetic-word-finder/"
   * Always starts with "/" and may or may not end with "/".
   */
  const arbBasePath = fc
    .array(fc.stringMatching(/^[a-z0-9-]{1,10}$/), { minLength: 0, maxLength: 3 })
    .map((segments) => '/' + segments.join('/'))
    .chain((path) =>
      fc.boolean().map((addTrailingSlash) =>
        addTrailingSlash || path === '/' ? path + (path.endsWith('/') ? '' : '/') : path,
      ),
    );

  it('constructed URL equals normalizedBasePath + "index-shards/index-" + phoneme + ".json"', () => {
    fc.assert(
      fc.property(arbBasePath, arbPhoneme, (basePath, phoneme) => {
        const url = buildShardUrl(basePath, phoneme);

        const normalizedBase = basePath.endsWith('/') ? basePath : basePath + '/';
        const expected = `${normalizedBase}index-shards/index-${phoneme}.json`;

        expect(url).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  it('URL always contains "index-shards/index-" segment', () => {
    fc.assert(
      fc.property(arbBasePath, arbPhoneme, (basePath, phoneme) => {
        const url = buildShardUrl(basePath, phoneme);
        expect(url).toContain('index-shards/index-');
        expect(url.endsWith('.json')).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('URL never has double slashes between base and shard path', () => {
    fc.assert(
      fc.property(arbBasePath, arbPhoneme, (basePath, phoneme) => {
        const url = buildShardUrl(basePath, phoneme);
        // After the protocol-free URL, there should be no "//" in the path
        expect(url).not.toMatch(/\/\/index-shards/);
      }),
      { numRuns: 100 },
    );
  });
});
