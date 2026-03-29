import type {
  PhoneticSymbol,
  PhoneticSystem,
  WordResult,
  FuzzyWordResult,
  WordDetail,
} from '../types/index';
import { ipaToARPAbet, arpabetToIPA } from './phoneticMapper';
import { getCacheService } from './cacheService';

// ---------------------------------------------------------------------------
// Worker communication
// ---------------------------------------------------------------------------

interface FuzzyMatchResult {
  word: string;
  arpabetSequence: string;
  similarity: number;
  diffIndices: number[];
}

type WorkerResponse =
  | { type: 'SEARCH_EXACT_RESULT'; requestId?: string; payload: { words: string[] } }
  | { type: 'SEARCH_FUZZY_RESULT'; requestId?: string; payload: { results: FuzzyMatchResult[] } }
  | { type: 'WORKER_ERROR'; requestId?: string; payload: { message: string } };

let _worker: Worker | null = null;
let _requestIdCounter = 0;

function getWorker(): Worker {
  if (!_worker) {
    _worker = new Worker(new URL('../workers/searchWorker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return _worker;
}

const WORKER_TIMEOUT_MS = 30_000;

function postWorkerMessage<T extends WorkerResponse['type']>(
  message: { type: string; payload: unknown },
  expectedType: T,
  signal?: AbortSignal,
): Promise<Extract<WorkerResponse, { type: T }>['payload']> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Promise<any>((resolve, reject) => {
    const worker = getWorker();
    const requestId = `req-${++_requestIdCounter}`;

    const cleanup = () => {
      worker.removeEventListener('message', handler);
      signal?.removeEventListener('abort', onAbort);
      clearTimeout(timeoutId);
    };

    const onAbort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };

    const handler = (event: MessageEvent<WorkerResponse>) => {
      // Match by requestId to avoid response mismatch
      if (event.data.requestId !== requestId) return;

      if (event.data.type === 'WORKER_ERROR') {
        cleanup();
        reject(new Error((event.data.payload as { message: string }).message));
        return;
      }

      if (event.data.type === expectedType) {
        cleanup();
        resolve(event.data.payload as Extract<WorkerResponse, { type: T }>['payload']);
      }
    };

    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Worker request timed out'));
    }, WORKER_TIMEOUT_MS);

    signal?.addEventListener('abort', onAbort, { once: true });
    worker.addEventListener('message', handler);
    worker.postMessage({ ...message, requestId });
  });
}

// ---------------------------------------------------------------------------
// IPA → ARPAbet conversion helper
// ---------------------------------------------------------------------------

function sequenceToArpabet(
  sequence: PhoneticSymbol[],
  _system: PhoneticSystem,
): string[] {
  // MVP: only IPA is supported. Each symbol already carries arpabetCode,
  // but we go through ipaToARPAbet for correctness.
  return sequence.map((s) => {
    // Prefer the stored arpabetCode if present; fall back to mapper
    if (s.arpabetCode) return s.arpabetCode;
    return ipaToARPAbet(s.symbol);
  });
}

// ---------------------------------------------------------------------------
// AbortController management
// ---------------------------------------------------------------------------

let _currentController: AbortController | null = null;

function createSearchController(): AbortController {
  // Cancel previous incomplete query
  if (_currentController) {
    _currentController.abort();
  }
  _currentController = new AbortController();
  return _currentController;
}

// ---------------------------------------------------------------------------
// Free Dictionary API
// ---------------------------------------------------------------------------

const DICTIONARY_API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';

// ---------------------------------------------------------------------------
// Runtime type guard for API response
// ---------------------------------------------------------------------------

function isValidDictionaryEntry(entry: unknown): entry is {
  word?: string;
  phonetic?: string;
  phonetics?: unknown[];
  meanings?: unknown[];
} {
  if (typeof entry !== 'object' || entry === null) return false;
  const obj = entry as Record<string, unknown>;
  if (obj.word !== undefined && typeof obj.word !== 'string') return false;
  if (obj.phonetic !== undefined && typeof obj.phonetic !== 'string') return false;
  if (obj.phonetics !== undefined && !Array.isArray(obj.phonetics)) return false;
  if (obj.meanings !== undefined && !Array.isArray(obj.meanings)) return false;
  return true;
}

async function fetchWordDetail(
  word: string,
  signal?: AbortSignal,
): Promise<WordDetail> {
  const response = await fetch(`${DICTIONARY_API_BASE}/${encodeURIComponent(word)}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Dictionary API error: ${response.status}`);
  }

  const data: unknown = await response.json();
  // The API returns an array; take the first entry.
  const entry: unknown = Array.isArray(data) ? data[0] : data;

  if (!isValidDictionaryEntry(entry)) {
    throw new Error(
      `Dictionary API returned unexpected data structure for "${word}"`,
    );
  }

  const phonetic: string =
    entry.phonetic ??
    (entry.phonetics as { text?: string }[] | undefined)?.find((p) => p.text)?.text ??
    '';

  const audioUrl: string | undefined =
    (entry.phonetics as { audio?: string }[] | undefined)?.find((p) => p.audio)?.audio || undefined;

  const meanings = ((entry.meanings ?? []) as {
    partOfSpeech?: string;
    definitions?: { definition?: string; example?: string }[];
  }[]).map((m) => ({
    partOfSpeech: m.partOfSpeech ?? '',
    definitions: (m.definitions ?? []).map((d) => ({
      definition: d.definition ?? '',
      example: d.example,
    })),
  }));

  return { word: entry.word ?? word, phonetic, meanings, audioUrl };
}

// ---------------------------------------------------------------------------
// Pronunciation suffix stripping
// ---------------------------------------------------------------------------

/**
 * Strip trailing pronunciation variant suffix like "(2)" or "(3)" from
 * CMU dictionary words.  Returns the original string when no suffix is present.
 */
export function stripPronunciationSuffix(word: string): string {
  return word.replace(/\(\d+\)$/, '');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Exact search: IPA sequence → ARPAbet → Worker exact search.
 */
export async function searchExact(
  sequence: PhoneticSymbol[],
  system: PhoneticSystem,
): Promise<WordResult[]> {
  const controller = createSearchController();
  const arpabetSeq = sequenceToArpabet(sequence, system);

  const { words } = await postWorkerMessage(
    { type: 'SEARCH_EXACT', payload: { arpabetSequence: arpabetSeq } },
    'SEARCH_EXACT_RESULT',
    controller.signal,
  );

  return words.map((w) => ({
    word: stripPronunciationSuffix(w),
    phonetic: sequence.map((s) => s.symbol).join(''),
    arpabet: arpabetSeq.join(' '),
    partOfSpeech: [],
    briefDefinition: '',
  }));
}

/**
 * Fuzzy search: IPA sequence → ARPAbet → Worker fuzzy search.
 */
export async function searchFuzzy(
  sequence: PhoneticSymbol[],
  system: PhoneticSystem,
): Promise<FuzzyWordResult[]> {
  const controller = createSearchController();
  const arpabetSeq = sequenceToArpabet(sequence, system);

  const { results } = await postWorkerMessage(
    { type: 'SEARCH_FUZZY', payload: { arpabetSequence: arpabetSeq } },
    'SEARCH_FUZZY_RESULT',
    controller.signal,
  );

  return results.map((r) => {
    const candidateArpabets = r.arpabetSequence.split(' ');
    const phonetic = candidateArpabets.map((a) => arpabetToIPA(a)).join('');

    return {
      word: stripPronunciationSuffix(r.word),
      phonetic,
      arpabet: r.arpabetSequence,
      partOfSpeech: [],
      briefDefinition: '',
      similarity: r.similarity,
      diffIndices: r.diffIndices,
    };
  });
}

/**
 * Get word detail: check IndexedDB cache first, then call Free Dictionary API.
 */
export async function getWordDetail(word: string): Promise<WordDetail> {
  word = stripPronunciationSuffix(word);
  const cache = getCacheService();

  // Check cache first
  const cached = await cache.getWordDetail(word);
  if (cached) return cached;

  // Cache miss → fetch from API
  const detail = await fetchWordDetail(word);

  // Store in cache (fire-and-forget)
  cache.cacheWordDetail(word, detail).catch(() => {
    // Silently ignore cache write failures
  });

  return detail;
}

/**
 * Abort any in-flight search.
 */
export function abortSearch(): void {
  if (_currentController) {
    _currentController.abort();
    _currentController = null;
  }
}
