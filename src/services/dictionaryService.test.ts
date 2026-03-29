import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getWordDetail, prefetchWordDetails } from './dictionaryService';
import type { WordDetail } from '../types/index';

// ---------------------------------------------------------------------------
// Mock cacheService — 默认返回 null（缓存未命中）
// ---------------------------------------------------------------------------

const mockCache = {
  getWordDetail: vi.fn().mockResolvedValue(null),
  cacheWordDetail: vi.fn().mockResolvedValue(undefined),
  getIndexShard: vi.fn().mockResolvedValue(null),
  cacheIndexShard: vi.fn().mockResolvedValue(undefined),
  getCachedVersion: vi.fn().mockResolvedValue(null),
  setCachedVersion: vi.fn().mockResolvedValue(undefined),
  clearIndexShards: vi.fn().mockResolvedValue(undefined),
};

vi.mock('./cacheService', () => ({
  getCacheService: () => mockCache,
}));

// ---------------------------------------------------------------------------
// Mock Audio 构造函数
// ---------------------------------------------------------------------------

const mockAudioInstances: { preload: string; src: string }[] = [];

// ---------------------------------------------------------------------------
// 辅助：构造 Free Dictionary API 的标准响应
// ---------------------------------------------------------------------------

function makeDictionaryResponse(word: string, audioUrl?: string) {
  return [
    {
      word,
      phonetic: `/test-${word}/`,
      phonetics: audioUrl
        ? [{ text: `/test-${word}/`, audio: audioUrl }]
        : [{ text: `/test-${word}/` }],
      meanings: [
        {
          partOfSpeech: 'noun',
          definitions: [{ definition: `definition of ${word}` }],
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// 辅助：设置 fetch mock 并返回 spy
// ---------------------------------------------------------------------------

let fetchMock: ReturnType<typeof vi.fn>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockFetch(impl?: (...args: any[]) => any) {
  fetchMock = impl ? vi.fn(impl) : vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function mockFetchResolve(word: string, audioUrl?: string) {
  return mockFetch(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(makeDictionaryResponse(word, audioUrl)),
    }),
  );
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  mockAudioInstances.length = 0;
  vi.stubGlobal('Audio', class {
    preload = '';
    src = '';
    constructor() {
      mockAudioInstances.push(this);
    }
  });
  mockCache.getWordDetail.mockResolvedValue(null);
  mockCache.cacheWordDetail.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// getWordDetail 超时测试
// ---------------------------------------------------------------------------

describe('getWordDetail 超时处理', () => {
  it('API 在 8 秒内响应时正常返回结果', async () => {
    mockFetchResolve('hello');

    const detail = await getWordDetail('hello');

    expect(detail.word).toBe('hello');
    expect(detail.meanings).toHaveLength(1);

    // fetchWordDetail 内部有 setTimeout，需要推进清理
    vi.advanceTimersByTime(10_000);
  });

  it('API 超过 8 秒未响应时抛出 TIMEOUT 错误', async () => {
    // fetch 返回一个永远不 resolve 的 promise，但监听 abort signal
    mockFetch((_url: string, options?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        const signal = options?.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }
      }),
    );

    const promise = getWordDetail('slowword');

    // 先挂上 catch 防止 Node 报 unhandled rejection，再推进时间
    const resultPromise = promise.catch((err: Error) => err);

    await vi.advanceTimersByTimeAsync(8_000);

    const err = await resultPromise;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('TIMEOUT');
  });

  it('缓存命中时不发起网络请求', async () => {
    const cachedDetail: WordDetail = {
      word: 'cached',
      phonetic: '/cached/',
      meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'from cache' }] }],
    };
    mockCache.getWordDetail.mockResolvedValue(cachedDetail);
    mockFetch();

    const detail = await getWordDetail('cached');

    expect(detail).toEqual(cachedDetail);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('API 返回非 200 状态码时抛出错误', async () => {
    mockFetch(() => Promise.resolve({ ok: false, status: 404 }));

    await expect(getWordDetail('notfound')).rejects.toThrow('Dictionary API error: 404');
  });
});

// ---------------------------------------------------------------------------
// prefetchWordDetails 测试
// ---------------------------------------------------------------------------

describe('prefetchWordDetails', () => {
  it('默认最多预取 5 个单词', async () => {
    const words = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    mockFetchResolve('word');

    prefetchWordDetails(words);
    await vi.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('可通过 maxCount 参数控制预取数量', async () => {
    const words = ['a', 'b', 'c', 'd', 'e'];
    mockFetchResolve('word');

    prefetchWordDetails(words, 2);
    await vi.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('缓存命中的单词不发起网络请求', async () => {
    const cachedDetail: WordDetail = {
      word: 'cached',
      phonetic: '/cached/',
      meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'from cache' }] }],
    };
    mockCache.getWordDetail.mockResolvedValue(cachedDetail);
    mockFetch();

    prefetchWordDetails(['cached', 'cached2']);
    await vi.runAllTimersAsync();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('预取成功后将结果写入缓存', async () => {
    mockFetchResolve('hello');

    prefetchWordDetails(['hello'], 1);
    await vi.runAllTimersAsync();

    expect(mockCache.cacheWordDetail).toHaveBeenCalledWith(
      'hello',
      expect.objectContaining({ word: 'hello' }),
    );
  });

  it('预取失败时静默忽略，不抛出错误', async () => {
    mockFetch(() => Promise.reject(new Error('Network error')));

    expect(() => prefetchWordDetails(['fail'])).not.toThrow();
    await vi.runAllTimersAsync();
  });

  it('会去除发音变体后缀再预取', async () => {
    mockFetchResolve('about');

    prefetchWordDetails(['about(2)'], 1);
    await vi.runAllTimersAsync();

    const fetchUrl = fetchMock.mock.calls[0][0] as string;
    expect(fetchUrl).toContain('/about');
    expect(fetchUrl).not.toContain('(2)');
  });
});

// ---------------------------------------------------------------------------
// 音频预加载测试
// ---------------------------------------------------------------------------

describe('prefetchWordDetails 音频预加载', () => {
  it('API 返回 audioUrl 时预加载音频', async () => {
    mockFetchResolve('hello', 'https://example.com/hello.mp3');

    prefetchWordDetails(['hello'], 1);
    await vi.runAllTimersAsync();

    expect(mockAudioInstances.length).toBeGreaterThanOrEqual(1);
    const audioWithSrc = mockAudioInstances.find((a) => a.src === 'https://example.com/hello.mp3');
    expect(audioWithSrc).toBeDefined();
    expect(audioWithSrc!.preload).toBe('auto');
  });

  it('API 未返回 audioUrl 时不预加载音频', async () => {
    mockFetchResolve('hello');

    prefetchWordDetails(['hello'], 1);
    await vi.runAllTimersAsync();

    const audioWithSrc = mockAudioInstances.find((a) => a.src !== '');
    expect(audioWithSrc).toBeUndefined();
  });

  it('缓存命中且有 audioUrl 时也预加载音频', async () => {
    const cachedDetail: WordDetail = {
      word: 'cached',
      phonetic: '/cached/',
      meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'from cache' }] }],
      audioUrl: 'https://example.com/cached.mp3',
    };
    mockCache.getWordDetail.mockResolvedValue(cachedDetail);
    mockFetch();

    prefetchWordDetails(['cached'], 1);
    await vi.runAllTimersAsync();

    const audioWithSrc = mockAudioInstances.find((a) => a.src === 'https://example.com/cached.mp3');
    expect(audioWithSrc).toBeDefined();
  });
});
