import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { MemoryCacheService } from './cacheService';

describe('Feature: shard-cache-and-deployment, Property 7: 对于任意非空版本号字符串，setCachedVersion 后 getCachedVersion 应返回相同值', () => {
  /** Validates: Requirements 3.4, 3.5 */
  it('setCachedVersion then getCachedVersion returns the same value', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (version) => {
          const cache = new MemoryCacheService();
          await cache.setCachedVersion(version);
          const result = await cache.getCachedVersion();
          expect(result).toBe(version);
        },
      ),
      { numRuns: 100 },
    );
  });
});
