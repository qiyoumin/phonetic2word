import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAppContext } from './state/AppContext';
import { SystemSwitcher } from './components/SystemSwitcher';
import { SymbolSelector } from './components/SymbolSelector';
import { ResultPanel } from './components/ResultPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { searchExact, searchFuzzy, getWordDetail, prefetchWordDetails } from './services/dictionaryService';
import { getHistoryService } from './services/historyService';
import ipaData from './data/ipa.json';
import kkData from './data/kk.json';
import websterData from './data/webster.json';
import type { PhoneticSystem, PhoneticSymbolData, HistoryRecord, WordDetail } from './types/index';
import styles from './App.module.css';

function getSymbolsForSystem(system: PhoneticSystem): PhoneticSymbolData[] {
  switch (system) {
    case 'KK':
      return kkData.symbols.map((s) => ({
        ...s,
        system: 'KK' as const,
        category: s.category as 'vowel' | 'consonant',
      }));
    case 'Webster':
      return websterData.symbols.map((s) => ({
        ...s,
        system: 'Webster' as const,
        category: s.category as 'vowel' | 'consonant',
      }));
    case 'IPA':
    default:
      return ipaData.symbols.map((s) => ({
        ...s,
        system: 'IPA' as const,
        category: s.category as 'vowel' | 'consonant',
      }));
  }
}

const historyService = getHistoryService();

const CANCEL_BUTTON_DELAY_MS = 1000;

function SearchButton({ onClick, onCancel, disabled, loading }: { onClick: () => void; onCancel: () => void; disabled: boolean; loading: boolean }) {
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShowCancel(false);
      return;
    }
    const timer = setTimeout(() => setShowCancel(true), CANCEL_BUTTON_DELAY_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading && showCancel) {
    return (
      <button
        className={styles.searchButton}
        onClick={onCancel}
        aria-label="取消查找"
      >
        <span aria-hidden="true">✕</span> 取消
      </button>
    );
  }

  return (
    <button
      className={styles.searchButton}
      onClick={loading ? undefined : onClick}
      disabled={disabled || loading}
      aria-label={loading ? '正在查找中' : '查找匹配单词'}
    >
      <span aria-hidden="true">🔍</span> 查找
    </button>
  );
}

function AppContent() {
  const { state, dispatch } = useAppContext();
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>(() =>
    historyService.getAll(),
  );
  const [emptyPrompt, setEmptyPrompt] = useState(false);
  const pendingFillSearch = useRef(false);
  const searchControllerRef = useRef<AbortController | null>(null);

  const currentSymbols = useMemo(
    () => getSymbolsForSystem(state.currentSystem),
    [state.currentSystem],
  );

  const handleCancelSearch = useCallback(() => {
    searchControllerRef.current?.abort();
    searchControllerRef.current = null;
    dispatch({ type: 'SEARCH_ERROR', payload: '已取消查找' });
  }, [dispatch]);

  const runSearch = useCallback(async () => {
    if (state.sequence.length === 0) {
      setEmptyPrompt(true);
      return;
    }
    setEmptyPrompt(false);

    // Abort any previous in-flight search
    searchControllerRef.current?.abort();
    const controller = new AbortController();
    searchControllerRef.current = controller;
    const signal = controller.signal;

    dispatch({ type: 'SEARCH_START' });

    try {
      const [exactResults, fuzzyResults] = await Promise.all([
        searchExact(state.sequence, state.currentSystem, signal),
        searchFuzzy(state.sequence, state.currentSystem, signal),
      ]);

      // 从模糊结果中排除已精确匹配的单词
      const exactWords = new Set(exactResults.map((r) => r.word));
      const filteredFuzzy = fuzzyResults.filter((r) => !exactWords.has(r.word));

      if (exactResults.length > 0 || filteredFuzzy.length > 0) {
        dispatch({
          type: 'SEARCH_SUCCESS',
          payload: { results: exactResults, fuzzyResults: filteredFuzzy },
        });
        const allWords = [
          ...exactResults.map((r) => r.word),
          ...filteredFuzzy.map((r) => r.word),
        ];
        prefetchWordDetails(allWords);
        // Save to history
        const record: HistoryRecord = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          system: state.currentSystem,
          sequence: [...state.sequence],
          matchedWords: exactResults.length > 0
            ? exactResults.map((r) => r.word)
            : filteredFuzzy.map((r) => r.word),
        };
        historyService.save(record);
        setHistoryRecords(historyService.getAll());
      } else {
        dispatch({ type: 'SEARCH_EMPTY' });
      }
    } catch (err) {
      // 如果是被新搜索覆盖或用户取消导致的 abort，不需要处理状态
      // （新搜索已经 dispatch 了 SEARCH_START，或 handleCancelSearch 已 dispatch 了 SEARCH_ERROR）
      if (signal.aborted) return;
      dispatch({
        type: 'SEARCH_ERROR',
        payload: err instanceof Error ? err.message : '查询出错',
      });
    }
  }, [state.sequence, state.currentSystem, dispatch]);

  // Auto-trigger search after FILL_SEQUENCE
  useEffect(() => {
    if (pendingFillSearch.current && state.sequence.length > 0) {
      pendingFillSearch.current = false;
      runSearch();
    }
  }, [state.sequence, runSearch]);

  const handleSwitchSystem = useCallback(
    (system: typeof state.currentSystem) => {
      dispatch({ type: 'SWITCH_SYSTEM', payload: system });
    },
    [dispatch],
  );

  const handleSelectWord = useCallback(
    async (word: string) => {
      dispatch({ type: 'SELECT_WORD_START' });
      try {
        const detail = await getWordDetail(word);
        dispatch({ type: 'SELECT_WORD', payload: detail });
      } catch (err) {
        const match = state.results.find((r) => r.word === word)
          ?? state.fuzzyResults.find((r) => r.word === word);
        const isTimeout = err instanceof Error && err.message === 'TIMEOUT';
        const fallback: WordDetail = {
          word,
          phonetic: match?.phonetic ?? '',
          meanings: [{
            partOfSpeech: '',
            definitions: [{
              definition: isTimeout
                ? '请求超时，请检查网络后重试'
                : '暂无释义（该词未被在线词典收录）',
            }],
          }],
        };
        dispatch({ type: 'SELECT_WORD', payload: fallback });
      }
    },
    [dispatch, state.results, state.fuzzyResults],
  );

  const handleSelectRecord = useCallback(
    (record: HistoryRecord) => {
      dispatch({
        type: 'FILL_SEQUENCE',
        payload: { system: record.system, sequence: record.sequence },
      });
      pendingFillSearch.current = true;
    },
    [dispatch],
  );

  const handleClearHistory = useCallback(() => {
    historyService.clear();
    setHistoryRecords([]);
  }, []);

  const handleBack = useCallback(() => {
    dispatch({ type: 'DESELECT_WORD' });
  }, [dispatch]);

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>音标找词 - Phonetic Word Finder</h1>
        <SystemSwitcher
          currentSystem={state.currentSystem}
          onSwitch={handleSwitchSystem}
          hasActiveSequence={state.sequence.length > 0}
        />
      </header>

      <main className={styles.main}>
        <section className={styles.selectorColumn}>
          <SymbolSelector
            system={state.currentSystem}
            symbols={currentSymbols}
            sequence={state.sequence}
            maxSequenceLength={20}
            onAppendSymbol={(sym) => {
              dispatch({ type: 'APPEND_SYMBOL', payload: sym });
              setEmptyPrompt(false);
            }}
            onRemoveSymbol={(idx) => dispatch({ type: 'REMOVE_SYMBOL', payload: idx })}
            onClearSequence={() => dispatch({ type: 'CLEAR_SEQUENCE' })}
            actionSlot={
              <div className={styles.searchAction}>
                <SearchButton
                  onClick={runSearch}
                  onCancel={handleCancelSearch}
                  disabled={state.searchStatus === 'loading'}
                  loading={state.searchStatus === 'loading'}
                />
                {emptyPrompt && (
                  <span className={styles.emptyPrompt}>请先组合音标符号</span>
                )}
              </div>
            }
          />
        </section>

        <div className={styles.bottomPanel}>
          <section className={styles.resultColumn}>
            <ResultPanel
              status={state.searchStatus}
              results={state.results}
              fuzzyResults={state.fuzzyResults}
              selectedWord={state.selectedWord}
              detailLoading={state.detailLoading}
              onSelectWord={handleSelectWord}
              onRetry={runSearch}
              onBack={handleBack}
              currentSystem={state.currentSystem}
              errorMessage={state.error}
            />
          </section>

          <aside className={styles.historyColumn}>
            <HistoryPanel
              records={historyRecords}
              onSelectRecord={handleSelectRecord}
              onClearHistory={handleClearHistory}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
