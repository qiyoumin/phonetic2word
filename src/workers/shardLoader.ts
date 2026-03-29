import type { CacheService } from '../services/cacheService';
import type { PhoneticIndex } from '../types/index';

/**
 * Constructs the fetch URL for a shard file given a base path and phoneme.
 * Ensures the base path ends with a slash before appending the shard path.
 */
export function buildShardUrl(basePath: string, phoneme: string): string {
  const base = basePath.endsWith('/') ? basePath : basePath + '/';
  return `${base}index-shards/index-${phoneme}.json`;
}

export interface LoadShardDeps {
  memoryCache: Map<string, PhoneticIndex>;
  cacheService: CacheService;
  fetchFn: (url: string) => Promise<Response>;
  isCacheStale?: () => boolean;
  basePath?: string;
}

/**
 * Pure function: compares cached version with remote version.
 * Returns true if cache is stale (versions differ), false if valid.
 */
export function checkVersionResult(cachedVersion: string | null, remoteVersion: string): boolean {
  return cachedVersion !== remoteVersion;
}

/**
 * Creates a loadShard function with injected dependencies for testability.
 * Implements three-level cache: memory Map → IndexedDB → network fetch.
 * When isCacheStale returns true, skips IndexedDB read and fetches from network.
 */
export function createLoadShard(deps: LoadShardDeps) {
  return async function loadShard(phoneme: string): Promise<PhoneticIndex> {
    // 1. Memory cache
    const memCached = deps.memoryCache.get(phoneme);
    if (memCached) return memCached;

    // 2. IndexedDB cache (skip if cache is stale)
    if (!deps.isCacheStale?.()) {
      try {
        const idbCached = await deps.cacheService.getIndexShard(phoneme);
        if (idbCached) {
          deps.memoryCache.set(phoneme, idbCached);
          return idbCached;
        }
      } catch {
        // IndexedDB read failed, fall through to network
      }
    }

    // 3. Network fetch
    const url = buildShardUrl(deps.basePath ?? '/', phoneme);
    const response = await deps.fetchFn(url);
    if (!response.ok) {
      const empty: PhoneticIndex = {};
      deps.memoryCache.set(phoneme, empty);
      return empty;
    }
    const data: PhoneticIndex = await response.json();
    deps.memoryCache.set(phoneme, data);

    // Write back to IndexedDB (silent failure)
    try {
      await deps.cacheService.cacheIndexShard(phoneme, data);
    } catch {
      // Silently ignore IndexedDB write failure
    }

    return data;
  };
}
