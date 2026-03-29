import type { HistoryRecord, PhoneticSystem } from '../types/index';

const STORAGE_KEY = 'phonetic-word-finder-history';
const MAX_RECORDS = 100;

const VALID_SYSTEMS: ReadonlySet<string> = new Set<PhoneticSystem>(['IPA', 'KK', 'Webster']);

/**
 * 验证单条历史记录的关键字段是否存在且类型正确。
 * 过滤掉 localStorage 中可能存在的损坏/过期数据。
 */
function isValidRecord(record: unknown): record is HistoryRecord {
  if (typeof record !== 'object' || record === null) return false;
  const r = record as Record<string, unknown>;
  if (typeof r.id !== 'string') return false;
  if (typeof r.timestamp !== 'number') return false;
  if (typeof r.system !== 'string' || !VALID_SYSTEMS.has(r.system)) return false;
  if (!Array.isArray(r.sequence)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Storage abstraction
// ---------------------------------------------------------------------------

interface Storage {
  read(): HistoryRecord[];
  write(records: HistoryRecord[]): void;
  clear(): void;
}

class LocalStorageBackend implements Storage {
  read(): HistoryRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidRecord);
    } catch {
      // Data corrupted – reset
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
  }

  write(records: HistoryRecord[]): void {
    const json = JSON.stringify(records);
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {
      // localStorage full – remove oldest records and retry
      const trimmed = records.slice(0, Math.max(1, records.length - 10));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      } catch {
        // Still failing – give up silently
      }
    }
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}

class MemoryBackend implements Storage {
  private records: HistoryRecord[] = [];

  read(): HistoryRecord[] {
    return [...this.records];
  }

  write(records: HistoryRecord[]): void {
    this.records = [...records];
  }

  clear(): void {
    this.records = [];
  }
}

// ---------------------------------------------------------------------------
// Detect localStorage availability
// ---------------------------------------------------------------------------

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__phonetic_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// HistoryService
// ---------------------------------------------------------------------------

export class HistoryService {
  private backend: Storage;

  constructor(backend?: Storage) {
    this.backend = backend ?? (isLocalStorageAvailable()
      ? new LocalStorageBackend()
      : new MemoryBackend());
  }

  /**
   * Save a history record. Removes the oldest record when exceeding MAX_RECORDS.
   */
  save(record: HistoryRecord): void {
    const records = this.backend.read();

    // Prepend new record (most recent first)
    records.unshift(record);

    // Truncate to MAX_RECORDS
    if (records.length > MAX_RECORDS) {
      records.length = MAX_RECORDS;
    }

    this.backend.write(records);
  }

  /**
   * Get all history records in reverse chronological order (max 100).
   */
  getAll(): HistoryRecord[] {
    const records = this.backend.read();
    // Sort by timestamp descending (most recent first)
    records.sort((a, b) => b.timestamp - a.timestamp);
    // Ensure max 100
    return records.slice(0, MAX_RECORDS);
  }

  /**
   * Clear all history records.
   */
  clear(): void {
    this.backend.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: HistoryService | null = null;

export function getHistoryService(): HistoryService {
  if (!_instance) {
    _instance = new HistoryService();
  }
  return _instance;
}

// Exported for testing
export { MemoryBackend };
