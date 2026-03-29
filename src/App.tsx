import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAppContext } from './state/AppContext';
import { SystemSwitcher } from './components/SystemSwitcher';
import { SymbolSelector } from './components/SymbolSelector';
import { ResultPanel } from './components/ResultPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { searchExact, searchFuzzy, getWordDetail } from './services/dictionaryService';
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

function SearchButton({ onClick, disabled, loading }: { onClick: () => void; disabled: boolean; loading: boolean }) {
  return (
    <button
      className={styles.searchButton}
      onClick={onClick}
      disabled={disabled}
      aria-label={loading ? '正在查找中' : '查找匹配单词'}
    >
      {loading ? <><span aria-hidden="true">⏳</span> 查找中...</> : <><span aria-hidden="true">🔍</span> 查找</>}
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

  const currentSymbols = useMemo(
    () => getSymbolsForSystem(state.currentSystem),
    [state.currentSystem],
  );

  const runSearch = useCallback(async () => {
    if (state.sequence.length === 0) {
      setEmptyPrompt(true);
      return;
    }
    setEmptyPrompt(false);
    dispatch({ type: 'SEARCH_START' });

    try {
      const exactResults = await searchExact(state.sequence, state.currentSystem);

      if (exactResults.length > 0) {
        dispatch({
          type: 'SEARCH_SUCCESS',
          payload: { results: exactResults, fuzzyResults: [] },
        });
        // Save to history
        const record: HistoryRecord = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          system: state.currentSystem,
          sequence: [...state.sequence],
          matchedWords: exactResults.map((r) => r.word),
        };
        historyService.save(record);
        setHistoryRecords(historyService.getAll());
      } else {
        // No exact match → try fuzzy
        const fuzzyResults = await searchFuzzy(state.sequence, state.currentSystem);
        if (fuzzyResults.length > 0) {
          dispatch({
            type: 'SEARCH_SUCCESS',
            payload: { results: [], fuzzyResults },
          });
          // Save fuzzy results to history
          const record: HistoryRecord = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
            system: state.currentSystem,
            sequence: [...state.sequence],
            matchedWords: fuzzyResults.map((r) => r.word),
          };
          historyService.save(record);
          setHistoryRecords(historyService.getAll());
        } else {
          dispatch({ type: 'SEARCH_EMPTY' });
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
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
      try {
        const detail = await getWordDetail(word);
        dispatch({ type: 'SELECT_WORD', payload: detail });
      } catch {
        // API miss (e.g. 404) → show a minimal detail view so the click isn't silent
        const match = state.results.find((r) => r.word === word)
          ?? state.fuzzyResults.find((r) => r.word === word);
        const fallback: WordDetail = {
          word,
          phonetic: match?.phonetic ?? '',
          meanings: [{ partOfSpeech: '', definitions: [{ definition: '暂无释义（该词未被在线词典收录）' }] }],
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
          />
          <div className={styles.searchRow}>
            <SearchButton
              onClick={runSearch}
              disabled={state.searchStatus === 'loading'}
              loading={state.searchStatus === 'loading'}
            />
            {emptyPrompt && (
              <span className={styles.emptyPrompt}>请先组合音标符号</span>
            )}
          </div>
        </section>

        <section className={styles.resultColumn}>
          <ResultPanel
            status={state.searchStatus}
            results={state.results}
            fuzzyResults={state.fuzzyResults}
            selectedWord={state.selectedWord}
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
      </main>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
