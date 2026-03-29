import type { PhoneticIndex, WordDetail } from '../types/index';

const DB_NAME = 'phonetic-word-finder';
const DB_VERSION = 1;
const INDEX_STORE = 'index-shards';
const WORD_STORE = 'word-details';
const MAX_WORD_CACHE_SIZE = 2000;

/**
 * CacheService provides IndexedDB-backed caching for index shards and word
 * details, with an automatic in-memory fallback when IndexedDB is unavailable.
 */
export interface CacheService {
  cacheIndexShard(shardKey: string, data: PhoneticIndex): Promise<void>;
  getIndexShard(shardKey: string): Promise<PhoneticIndex | null>;
  cacheWordDetail(word: string, detail: WordDetail): Promise<void>;
  getWordDetail(word: string): Promise<WordDetail | null>;
  getCachedVersion(): Promise<string | null>;
  setCachedVersion(version: string): Promise<void>;
  clearIndexShards(): Promise<void>;
}

/** Wrapper that stores a timestamp alongside the cached WordDetail for LRU eviction. */
interface CachedWordEntry {
  detail: WordDetail;
  accessedAt: number;
}

// ---------------------------------------------------------------------------
// IndexedDB implementation
// ---------------------------------------------------------------------------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(INDEX_STORE)) {
        db.createObjectStore(INDEX_STORE);
      }
      if (!db.objectStoreNames.contains(WORD_STORE)) {
        db.createObjectStore(WORD_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbPut(db: IDBDatabase, store: string, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const request = tx.objectStore(store).get(key);
    request.onsuccess = () => resolve((request.result as T) ?? null);
    request.onerror = () => reject(request.error);
  });
}

function idbClear(db: IDBDatabase, store: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

class IDBCacheService implements CacheService {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = openDB();
  }

  async cacheIndexShard(shardKey: string, data: PhoneticIndex): Promise<void> {
    const db = await this.dbPromise;
    await idbPut(db, INDEX_STORE, shardKey, data);
  }

  async getIndexShard(shardKey: string): Promise<PhoneticIndex | null> {
    const db = await this.dbPromise;
    return idbGet<PhoneticIndex>(db, INDEX_STORE, shardKey);
  }

  async cacheWordDetail(word: string, detail: WordDetail): Promise<void> {
    const db = await this.dbPromise;
    const entry: CachedWordEntry = { detail, accessedAt: Date.now() };
    await idbPut(db, WORD_STORE, word, entry);
    // Fire-and-forget eviction check
    this.evictOldEntries().catch(() => {});
  }

  async getWordDetail(word: string): Promise<WordDetail | null> {
    const db = await this.dbPromise;
    const entry = await idbGet<CachedWordEntry | WordDetail>(db, WORD_STORE, word);
    if (!entry) return null;
    // Handle legacy entries stored without the wrapper
    if ('detail' in entry && 'accessedAt' in entry) {
      // Update access timestamp (fire-and-forget)
      const updated: CachedWordEntry = { detail: entry.detail, accessedAt: Date.now() };
      idbPut(db, WORD_STORE, word, updated).catch(() => {});
      return entry.detail;
    }
    // Legacy format: raw WordDetail
    return entry as WordDetail;
  }

  /**
   * Evict oldest entries when word-details store exceeds MAX_WORD_CACHE_SIZE.
   * Removes the oldest 20% by accessedAt timestamp.
   */
  private async evictOldEntries(): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(WORD_STORE, 'readonly');
    const store = tx.objectStore(WORD_STORE);

    const countReq = store.count();
    const count = await new Promise<number>((resolve, reject) => {
      countReq.onsuccess = () => resolve(countReq.result);
      countReq.onerror = () => reject(countReq.error);
    });

    if (count <= MAX_WORD_CACHE_SIZE) return;

    // Collect all keys with their accessedAt timestamps
    const entries: { key: IDBValidKey; accessedAt: number }[] = [];
    const cursorTx = db.transaction(WORD_STORE, 'readonly');
    const cursorStore = cursorTx.objectStore(WORD_STORE);

    await new Promise<void>((resolve, reject) => {
      const req = cursorStore.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) { resolve(); return; }
        const val = cursor.value as CachedWordEntry | WordDetail;
        const accessedAt = ('accessedAt' in val) ? val.accessedAt : 0;
        entries.push({ key: cursor.key, accessedAt });
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });

    // Sort by accessedAt ascending (oldest first), remove oldest 20%
    entries.sort((a, b) => a.accessedAt - b.accessedAt);
    const removeCount = Math.ceil(count * 0.2);
    const keysToRemove = entries.slice(0, removeCount).map((e) => e.key);

    const deleteTx = db.transaction(WORD_STORE, 'readwrite');
    const deleteStore = deleteTx.objectStore(WORD_STORE);
    for (const key of keysToRemove) {
      deleteStore.delete(key);
    }
    await new Promise<void>((resolve, reject) => {
      deleteTx.oncomplete = () => resolve();
      deleteTx.onerror = () => reject(deleteTx.error);
    });
  }

  async getCachedVersion(): Promise<string | null> {
    const db = await this.dbPromise;
    return idbGet<string>(db, INDEX_STORE, '__version__');
  }

  async setCachedVersion(version: string): Promise<void> {
    const db = await this.dbPromise;
    await idbPut(db, INDEX_STORE, '__version__', version);
  }

  async clearIndexShards(): Promise<void> {
    const db = await this.dbPromise;
    await idbClear(db, INDEX_STORE);
  }
}

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------

class MemoryCacheService implements CacheService {
  private indexShards = new Map<string, PhoneticIndex>();
  private wordDetails = new Map<string, { detail: WordDetail; accessedAt: number }>();
  private version: string | null = null;

  async cacheIndexShard(shardKey: string, data: PhoneticIndex): Promise<void> {
    this.indexShards.set(shardKey, data);
  }

  async getIndexShard(shardKey: string): Promise<PhoneticIndex | null> {
    return this.indexShards.get(shardKey) ?? null;
  }

  async cacheWordDetail(word: string, detail: WordDetail): Promise<void> {
    this.wordDetails.set(word, { detail, accessedAt: Date.now() });
    // Evict oldest 20% when exceeding limit
    if (this.wordDetails.size > MAX_WORD_CACHE_SIZE) {
      const entries = [...this.wordDetails.entries()]
        .sort((a, b) => a[1].accessedAt - b[1].accessedAt);
      const removeCount = Math.ceil(this.wordDetails.size * 0.2);
      for (let i = 0; i < removeCount; i++) {
        this.wordDetails.delete(entries[i][0]);
      }
    }
  }

  async getWordDetail(word: string): Promise<WordDetail | null> {
    const entry = this.wordDetails.get(word);
    if (!entry) return null;
    // Update access timestamp
    entry.accessedAt = Date.now();
    return entry.detail;
  }

  async getCachedVersion(): Promise<string | null> {
    return this.version;
  }

  async setCachedVersion(version: string): Promise<void> {
    this.version = version;
  }

  async clearIndexShards(): Promise<void> {
    this.indexShards.clear();
    this.version = null;
  }
}

// ---------------------------------------------------------------------------
// Factory – pick the right implementation
// ---------------------------------------------------------------------------

function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

export function createCacheService(): CacheService {
  if (isIndexedDBAvailable()) {
    return new IDBCacheService();
  }
  return new MemoryCacheService();
}

// Convenience singleton – most callers just need one instance.
let _instance: CacheService | null = null;

export function getCacheService(): CacheService {
  if (!_instance) {
    _instance = createCacheService();
  }
  return _instance;
}

// Exported for testing purposes
export { MemoryCacheService, IDBCacheService };
