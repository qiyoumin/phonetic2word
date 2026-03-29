import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { HistoryService, MemoryBackend } from './historyService';
import type { HistoryRecord, PhoneticSymbol, PhoneticSystem } from '../types/index';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const phoneticSystemArb = fc.constantFrom<PhoneticSystem>('IPA', 'KK', 'Webster');

const phoneticSymbolArb: fc.Arbitrary<PhoneticSymbol> = fc.record({
  symbol: fc.stringOf(fc.char(), { minLength: 1, maxLength: 5 }),
  arpabetCode: fc.stringOf(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    { minLength: 1, maxLength: 3 },
  ),
  index: fc.nat({ max: 100 }),
});

const historyRecordArb: fc.Arbitrary<HistoryRecord> = fc.record({
  id: fc.uuid(),
  timestamp: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
  system: phoneticSystemArb,
  sequence: fc.array(phoneticSymbolArb, { minLength: 1, maxLength: 10 }),
  matchedWords: fc.array(fc.stringOf(fc.char(), { minLength: 1, maxLength: 15 }), {
    minLength: 0,
    maxLength: 5,
  }),
});

// ---------------------------------------------------------------------------
// Property 8: 历史记录 round-trip
// Validates: Requirements 6.1, 6.3
// ---------------------------------------------------------------------------

describe('Property 8: 历史记录 round-trip', () => {
  it('saved records can be read back with matching system and sequence', () => {
    fc.assert(
      fc.property(historyRecordArb, (record) => {
        const service = new HistoryService(new MemoryBackend());

        service.save(record);
        const all = service.getAll();

        expect(all.length).toBe(1);

        const retrieved = all[0];
        expect(retrieved.system).toBe(record.system);
        expect(retrieved.sequence).toEqual(record.sequence);
        expect(retrieved.id).toBe(record.id);
        expect(retrieved.timestamp).toBe(record.timestamp);
        expect(retrieved.matchedWords).toEqual(record.matchedWords);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: 历史记录排序与截断
// Validates: Requirements 6.2
// ---------------------------------------------------------------------------

describe('Property 9: 历史记录排序与截断', () => {
  it('getAll returns records sorted by timestamp descending and length <= 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 150 }),
        (count) => {
          const service = new HistoryService(new MemoryBackend());

          // Generate and save `count` records with distinct timestamps
          for (let i = 0; i < count; i++) {
            const record: HistoryRecord = {
              id: `id-${i}`,
              timestamp: 1_000_000_000_000 + i,
              system: 'IPA',
              sequence: [{ symbol: 'b', arpabetCode: 'B', index: 0 }],
              matchedWords: ['bat'],
            };
            service.save(record);
          }

          const all = service.getAll();

          // Length must be <= 100
          expect(all.length).toBeLessThanOrEqual(100);
          expect(all.length).toBe(Math.min(count, 100));

          // Must be sorted by timestamp descending
          for (let i = 1; i < all.length; i++) {
            expect(all[i - 1].timestamp).toBeGreaterThanOrEqual(all[i].timestamp);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10: 清除历史记录
// Validates: Requirements 6.4
// ---------------------------------------------------------------------------

describe('Property 10: 清除历史记录', () => {
  it('after clear, getAll returns empty list', () => {
    fc.assert(
      fc.property(
        fc.array(historyRecordArb, { minLength: 1, maxLength: 20 }),
        (records) => {
          const service = new HistoryService(new MemoryBackend());

          for (const record of records) {
            service.save(record);
          }

          // Verify records were saved
          expect(service.getAll().length).toBeGreaterThan(0);

          // Clear
          service.clear();

          // After clear, should be empty
          expect(service.getAll()).toEqual([]);
        },
      ),
      { numRuns: 100 },
    );
  });
});
