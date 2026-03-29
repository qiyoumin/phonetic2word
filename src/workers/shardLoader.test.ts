import { describe, it, expect } from 'vitest';
import { createLoadShard } from './shardLoader';
import { MemoryCacheService } from '../services/cacheService';
import type { PhoneticIndex } from '../types/index';

describe('shardLoader - fetchFn binding', () => {
  it('should work when fetchFn is an arrow function wrapping fetch', async () => {
    const shardData: PhoneticIndex = { 'T AE S K': ['task'] };
    const memoryCache = new Map<string, PhoneticIndex>();
    const cacheService = new MemoryCacheService();

    // Simulate the arrow-function pattern used in searchWorker.ts
    const fetchFn = (_url: string) =>
      Promise.resolve(
        new Response(JSON.stringify(shardData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const loadShard = createLoadShard({ memoryCache, cacheService, fetchFn });
    const result = await loadShard('T');

    expect(result).toEqual(shardData);
  });

  it('should throw Illegal invocation when fetchFn loses its binding', async () => {
    // This test documents the bug: in browser/worker environments, passing
    // `fetch` directly (without wrapping) causes "Illegal invocation" because
    // fetch loses its `this` binding to WorkerGlobalScope.
    //
    // We simulate this by creating a class method that requires correct binding.
    const memoryCache = new Map<string, PhoneticIndex>();
    const cacheService = new MemoryCacheService();

    class FakeScope {
      fetch(_url: string): Promise<Response> {
        // This method requires `this` to be a FakeScope instance
        if (!(this instanceof FakeScope)) {
          throw new TypeError('Illegal invocation');
        }
        return Promise.resolve(
          new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
        );
      }
    }

    const scope = new FakeScope();
    // Passing the unbound method directly (the bug pattern)
    const unboundFetch = scope.fetch;

    const loadShardBroken = createLoadShard({
      memoryCache,
      cacheService,
      fetchFn: unboundFetch,
    });

    await expect(loadShardBroken('T')).rejects.toThrow('Illegal invocation');
  });

  it('should succeed when fetchFn is wrapped in arrow function (the fix)', async () => {
    const memoryCache = new Map<string, PhoneticIndex>();
    const cacheService = new MemoryCacheService();

    class FakeScope {
      fetch(_url: string): Promise<Response> {
        if (!(this instanceof FakeScope)) {
          throw new TypeError('Illegal invocation');
        }
        return Promise.resolve(
          new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
        );
      }
    }

    const scope = new FakeScope();
    // Arrow function wrapper preserves the calling context (the fix pattern)
    const loadShardFixed = createLoadShard({
      memoryCache,
      cacheService,
      fetchFn: (url: string) => scope.fetch(url),
    });

    const result = await loadShardFixed('T');
    expect(result).toEqual({});
  });
});
