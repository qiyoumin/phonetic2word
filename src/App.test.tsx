import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import fc from 'fast-check';
import { AppProvider } from './state/AppContext';
import App from './App';

// Mock the Web Worker used by dictionaryService
vi.mock('./services/dictionaryService', () => ({
  searchExact: vi.fn().mockResolvedValue([]),
  searchFuzzy: vi.fn().mockResolvedValue([]),
  getWordDetail: vi.fn().mockResolvedValue({
    word: 'test',
    phonetic: 'tɛst',
    meanings: [],
  }),
  abortSearch: vi.fn(),
}));

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
