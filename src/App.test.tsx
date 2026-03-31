import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import fc from 'fast-check';
import { AppProvider } from './state/AppContext';
import App from './App';

// Mock the Web Worker used by dictionaryService
const mockSearchExact = vi.fn().mockResolvedValue([]);
const mockSearchFuzzy = vi.fn().mockResolvedValue([]);
const mockPrefetchWordDetails = vi.fn();

vi.mock('./services/dictionaryService', () => ({
  searchExact: (...args: unknown[]) => mockSearchExact(...args),
  searchFuzzy: (...args: unknown[]) => mockSearchFuzzy(...args),
  getWordDetail: vi.fn().mockResolvedValue({
    word: 'test',
    phonetic: 'tɛst',
    meanings: [],
  }),
  abortSearch: vi.fn(),
  prefetchWordDetails: (...args: unknown[]) => mockPrefetchWordDetails(...args),
}));

vi.mock('./services/audioService', () => ({
  playPhoneme: vi.fn(),
}));

vi.mock('./services/historyService', () => ({
  getHistoryService: () => ({
    getAll: () => [],
    save: vi.fn(),
    clear: vi.fn(),
  }),
}));

// jsdom 不支持 ResizeObserver，提供 stub
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

function renderApp() {
  return render(
    <AppProvider>
      <App />
    </AppProvider>,
  );
}

describe('App', () => {
  it('renders the app title', () => {
    renderApp();
    expect(screen.getByText('音标找词 - Phonetic Word Finder')).toBeInTheDocument();
  });

  it('renders the search button', () => {
    renderApp();
    expect(screen.getByRole('button', { name: /查找匹配单词/ })).toBeInTheDocument();
  });

  it('renders the system switcher', () => {
    renderApp();
    expect(screen.getByRole('radiogroup', { name: /音标体系选择/ })).toBeInTheDocument();
  });

  it('renders the symbol selector with vowel and consonant groups', () => {
    renderApp();
    expect(screen.getByText('元音 Vowels')).toBeInTheDocument();
    expect(screen.getByText('辅音 Consonants')).toBeInTheDocument();
  });

  it('renders the history panel', () => {
    renderApp();
    expect(screen.getByText('查询历史')).toBeInTheDocument();
  });
});

describe('fast-check smoke test', () => {
  it('verifies fast-check is working', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        expect(a + b).toBe(b + a);
      }),
    );
  });
});

describe('搜索行为', () => {
  beforeEach(() => {
    mockSearchExact.mockReset();
    mockSearchFuzzy.mockReset();
    mockPrefetchWordDetails.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('精确匹配有结果时也显示模糊匹配结果', async () => {
    mockSearchExact.mockResolvedValue([
      { word: 'bat', phonetic: 'bæt', arpabet: 'B AE1 T', partOfSpeech: ['n.'], briefDefinition: '' },
    ]);
    mockSearchFuzzy.mockResolvedValue([
      { word: 'bad', phonetic: 'bæd', arpabet: 'B AE1 D', similarity: 0.85, diffIndices: [2] },
    ]);

    renderApp();
    // 点击一个唯一的音标符号（ʃ）来添加到序列
    const symbolButton = screen.getByRole('button', { name: /音标 ʃ/ });
    fireEvent.click(symbolButton);
    const searchButton = screen.getByRole('button', { name: /查找匹配单词/ });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('bat')).toBeInTheDocument();
    });
    // 模糊结果也应该展示
    expect(screen.getByText('你可能在找')).toBeInTheDocument();
    expect(screen.getByText('bad')).toBeInTheDocument();
  });

  it('精确匹配有结果时，模糊结果中排除已精确匹配的单词', async () => {
    mockSearchExact.mockResolvedValue([
      { word: 'bat', phonetic: 'bæt', arpabet: 'B AE1 T', partOfSpeech: ['n.'], briefDefinition: '' },
    ]);
    mockSearchFuzzy.mockResolvedValue([
      { word: 'bat', phonetic: 'bæt', arpabet: 'B AE1 T', similarity: 1.0, diffIndices: [] },
      { word: 'bad', phonetic: 'bæd', arpabet: 'B AE1 D', similarity: 0.85, diffIndices: [2] },
    ]);

    renderApp();
    const symbolButton = screen.getByRole('button', { name: /音标 ʃ/ });
    fireEvent.click(symbolButton);
    const searchButton = screen.getByRole('button', { name: /查找匹配单词/ });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('bat')).toBeInTheDocument();
    });
    // 模糊结果区域只显示 bad，不重复显示 bat
    const fuzzySection = screen.getByRole('list', { name: '模糊匹配建议' });
    expect(fuzzySection).toBeInTheDocument();
    expect(fuzzySection.textContent).toContain('bad');
    expect(fuzzySection.textContent).not.toContain('bat');
  });
});
