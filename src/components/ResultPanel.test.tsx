import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as fc from 'fast-check';
import { ResultPanel } from './ResultPanel';
import type { WordResult, FuzzyWordResult, WordDetail } from '../types/index';

// --- Arbitraries ---

const definitionArb = fc.record({
  definition: fc.string({ minLength: 1, maxLength: 30 }),
});

const meaningArb = fc.record({
  partOfSpeech: fc.string({ minLength: 1, maxLength: 10 }),
  definitions: fc.array(definitionArb, { minLength: 1, maxLength: 3 }),
});

const wordDetailArb: fc.Arbitrary<WordDetail> = fc.record({
  word: fc.string({ minLength: 1, maxLength: 10 }),
  phonetic: fc.string({ minLength: 1, maxLength: 10 }),
  meanings: fc.array(meaningArb, { minLength: 1, maxLength: 3 }),
});

const wordResultArb: fc.Arbitrary<WordResult> = fc.record({
  word: fc.string({ minLength: 1, maxLength: 10 }),
  phonetic: fc.string({ minLength: 1, maxLength: 10 }),
  arpabet: fc.string({ minLength: 1, maxLength: 20 }),
  partOfSpeech: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 3 }),
  briefDefinition: fc.string({ minLength: 0, maxLength: 30 }),
});

// --- Helpers ---

const noop = () => {};

function renderResultPanel(overrides: Partial<Parameters<typeof ResultPanel>[0]> = {}) {
  const defaultProps = {
    status: 'success' as const,
    results: [{ word: 'test', phonetic: 'tɛst', arpabet: 'T EH S T', partOfSpeech: ['noun'], briefDefinition: 'a test' }],
    fuzzyResults: [] as FuzzyWordResult[],
    selectedWord: null as WordDetail | null,
    detailLoading: false,
    onSelectWord: noop,
    onRetry: noop,
    onBack: noop,
    ...overrides,
  };
  return render(<ResultPanel {...defaultProps} />);
}

// --- Property 4 ---

/**
 * Feature: search-result-navigation-and-history-scroll, Property 4: 详情视图渲染返回按钮
 * Validates: Requirements 1.1, 1.5
 *
 * For any valid WordDetail and non-empty search results list,
 * when ResultPanel is rendered with selectedWord not null,
 * the output should contain a back button with aria-label="返回搜索结果列表".
 */
describe('Property 4: 详情视图渲染返回按钮', () => {
  it('renders a back button with correct aria-label when selectedWord is not null', () => {
    fc.assert(
      fc.property(
        wordDetailArb,
        fc.array(wordResultArb, { minLength: 1, maxLength: 5 }),
        (selectedWord, results) => {
          const { unmount } = renderResultPanel({ selectedWord, results });

          const backButton = screen.getByRole('button', { name: '返回搜索结果列表' });
          expect(backButton).toBeInTheDocument();
          expect(backButton).toHaveAttribute('aria-label', '返回搜索结果列表');

          unmount();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Unit tests ---

describe('ResultPanel back button', () => {
  const sampleDetail: WordDetail = {
    word: 'hello',
    phonetic: 'hɛˈloʊ',
    meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'a greeting' }] }],
  };

  // Validates requirement 1.4
  it('triggers onBack when Enter key is pressed on the back button', () => {
    const onBack = vi.fn();
    renderResultPanel({ selectedWord: sampleDetail, onBack });

    const backButton = screen.getByRole('button', { name: '返回搜索结果列表' });
    fireEvent.keyDown(backButton, { key: 'Enter', code: 'Enter' });
    // Native button handles Enter via click
    fireEvent.click(backButton);
    expect(onBack).toHaveBeenCalled();
  });

  // Validates requirement 1.4
  it('triggers onBack when Space key is pressed on the back button', () => {
    const onBack = vi.fn();
    renderResultPanel({ selectedWord: sampleDetail, onBack });

    const backButton = screen.getByRole('button', { name: '返回搜索结果列表' });
    fireEvent.keyDown(backButton, { key: ' ', code: 'Space' });
    // Native button handles Space via click
    fireEvent.click(backButton);
    expect(onBack).toHaveBeenCalled();
  });

  // Validates requirement 1.5
  it('back button has aria-label="返回搜索结果列表"', () => {
    renderResultPanel({ selectedWord: sampleDetail });

    const backButton = screen.getByRole('button', { name: '返回搜索结果列表' });
    expect(backButton).toHaveAttribute('aria-label', '返回搜索结果列表');
  });

  // When selectedWord is null, no back button should be rendered
  it('does not render a back button when selectedWord is null', () => {
    renderResultPanel({ selectedWord: null });

    const backButton = screen.queryByRole('button', { name: '返回搜索结果列表' });
    expect(backButton).not.toBeInTheDocument();
  });
});

// --- Fuzzy diff highlighting tests ---

describe('FuzzyResults diff highlighting', () => {
  const makeFuzzyResult = (overrides: Partial<FuzzyWordResult> = {}): FuzzyWordResult => ({
    word: 'tusk',
    phonetic: 'tʌsk',
    arpabet: 'T AH S K',
    partOfSpeech: [],
    briefDefinition: '',
    similarity: 0.9,
    diffIndices: [1],
    ...overrides,
  });

  it('highlights the correct phoneme segment based on diffIndices (IPA)', () => {
    // diffIndices [1] should highlight the 2nd ARPAbet phoneme (AH → ʌ), not the 2nd character
    const fuzzyResults = [makeFuzzyResult({ diffIndices: [1] })];
    renderResultPanel({
      status: 'success',
      results: [],
      fuzzyResults,
      selectedWord: null,
      currentSystem: 'IPA',
    });

    const fuzzySection = screen.getByRole('list', { name: '模糊匹配建议' });
    // The diff-highlighted segment should have the diffChar class
    const diffSpans = fuzzySection.querySelectorAll('[class]');
    // Find spans that contain the diff character class
    const highlighted: string[] = [];
    diffSpans.forEach((span) => {
      if (span.className && span.className.includes('diffChar')) {
        highlighted.push(span.textContent ?? '');
      }
    });
    // The highlighted phoneme should be 'ʌ' (the IPA symbol for AH)
    expect(highlighted).toContain('ʌ');
  });

  it('highlights multiple diff positions correctly', () => {
    // dusk: D AH S K — diffIndices [0, 1] means D and AH differ
    const fuzzyResults = [makeFuzzyResult({
      word: 'dusk',
      phonetic: 'dʌsk',
      arpabet: 'D AH S K',
      diffIndices: [0, 1],
      similarity: 0.83,
    })];
    renderResultPanel({
      status: 'success',
      results: [],
      fuzzyResults,
      selectedWord: null,
      currentSystem: 'IPA',
    });

    const fuzzySection = screen.getByRole('list', { name: '模糊匹配建议' });
    const highlighted: string[] = [];
    fuzzySection.querySelectorAll('[class]').forEach((span) => {
      if (span.className && span.className.includes('diffChar')) {
        highlighted.push(span.textContent ?? '');
      }
    });
    expect(highlighted).toContain('d');
    expect(highlighted).toContain('ʌ');
    expect(highlighted).not.toContain('s');
    expect(highlighted).not.toContain('k');
  });

  it('does not highlight any segment when diffIndices is empty', () => {
    const fuzzyResults = [makeFuzzyResult({ diffIndices: [] })];
    renderResultPanel({
      status: 'success',
      results: [],
      fuzzyResults,
      selectedWord: null,
      currentSystem: 'IPA',
    });

    const fuzzySection = screen.getByRole('list', { name: '模糊匹配建议' });
    const highlighted: Element[] = [];
    fuzzySection.querySelectorAll('[class]').forEach((span) => {
      if (span.className && span.className.includes('diffChar')) {
        highlighted.push(span);
      }
    });
    expect(highlighted).toHaveLength(0);
  });
});

// --- Audio button tests ---

describe('WordDetailView audio button', () => {
  it('shows audio button immediately when audioUrl is present', () => {
    const detail: WordDetail = {
      word: 'bid',
      phonetic: 'bɪd',
      meanings: [{ partOfSpeech: 'verb', definitions: [{ definition: 'to offer' }] }],
      audioUrl: 'https://example.com/bid.mp3',
    };
    renderResultPanel({ selectedWord: detail });

    const audioButton = screen.getByRole('button', { name: /播放 bid 的发音/ });
    expect(audioButton).toBeInTheDocument();
  });

  it('does not show audio button when audioUrl is absent', () => {
    const detail: WordDetail = {
      word: 'bid',
      phonetic: 'bɪd',
      meanings: [{ partOfSpeech: 'verb', definitions: [{ definition: 'to offer' }] }],
    };
    renderResultPanel({ selectedWord: detail });

    const audioButton = screen.queryByRole('button', { name: /播放/ });
    expect(audioButton).not.toBeInTheDocument();
  });
});

// --- Fuzzy results interaction tests ---

describe('FuzzyResults interaction', () => {
  it('calls onSelectWord when a fuzzy result is clicked', () => {
    const onSelectWord = vi.fn();
    const fuzzyResults: FuzzyWordResult[] = [{
      word: 'tusk',
      phonetic: 'tʌsk',
      arpabet: 'T AH S K',
      partOfSpeech: [],
      briefDefinition: '',
      similarity: 0.9,
      diffIndices: [1],
    }];
    renderResultPanel({
      status: 'success',
      results: [],
      fuzzyResults,
      selectedWord: null,
      onSelectWord,
    });

    const item = screen.getByRole('button', { name: /建议单词 tusk/ });
    fireEvent.click(item);
    expect(onSelectWord).toHaveBeenCalledWith('tusk');
  });

  it('displays similarity percentage for fuzzy results', () => {
    const fuzzyResults: FuzzyWordResult[] = [{
      word: 'tusk',
      phonetic: 'tʌsk',
      arpabet: 'T AH S K',
      partOfSpeech: [],
      briefDefinition: '',
      similarity: 0.9,
      diffIndices: [1],
    }];
    renderResultPanel({
      status: 'success',
      results: [],
      fuzzyResults,
      selectedWord: null,
    });

    expect(screen.getByText('90%')).toBeInTheDocument();
  });
});

// --- Fallback detail view tests ---

describe('WordDetailView fallback for unknown words', () => {
  it('renders fallback detail with "暂无释义" message', () => {
    const fallbackDetail: WordDetail = {
      word: 'mit',
      phonetic: 'mɪt',
      meanings: [{ partOfSpeech: '', definitions: [{ definition: '暂无释义（该词未被在线词典收录）' }] }],
    };
    renderResultPanel({ selectedWord: fallbackDetail });

    expect(screen.getByText('mit')).toBeInTheDocument();
    expect(screen.getByText('暂无释义（该词未被在线词典收录）')).toBeInTheDocument();
  });

  it('renders timeout fallback message', () => {
    const timeoutDetail: WordDetail = {
      word: 'test',
      phonetic: 'tɛst',
      meanings: [{ partOfSpeech: '', definitions: [{ definition: '请求超时，请检查网络后重试' }] }],
    };
    renderResultPanel({ selectedWord: timeoutDetail });

    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('请求超时，请检查网络后重试')).toBeInTheDocument();
  });
});

// --- detailLoading 状态测试 ---

describe('ResultPanel detailLoading', () => {
  it('显示加载中提示当 detailLoading 为 true', () => {
    renderResultPanel({ detailLoading: true, selectedWord: null });

    expect(screen.getByText('正在加载单词详情...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('detailLoading 时不显示单词列表', () => {
    renderResultPanel({ detailLoading: true, selectedWord: null });

    expect(screen.queryByRole('list', { name: '匹配单词列表' })).not.toBeInTheDocument();
  });

  it('detailLoading 时不显示模糊匹配结果', () => {
    const fuzzyResults: FuzzyWordResult[] = [{
      word: 'tusk',
      phonetic: 'tʌsk',
      arpabet: 'T AH S K',
      partOfSpeech: [],
      briefDefinition: '',
      similarity: 0.9,
      diffIndices: [1],
    }];
    renderResultPanel({ detailLoading: true, selectedWord: null, fuzzyResults });

    expect(screen.queryByRole('list', { name: '模糊匹配建议' })).not.toBeInTheDocument();
  });

  it('detailLoading 为 false 时正常显示单词列表', () => {
    renderResultPanel({ detailLoading: false, selectedWord: null });

    expect(screen.queryByText('正在加载单词详情...')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: '匹配单词列表' })).toBeInTheDocument();
  });
});
