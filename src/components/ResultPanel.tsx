import { useState, useEffect, useCallback } from 'react';
import type { WordResult, FuzzyWordResult, WordDetail, PhoneticSystem } from '../types/index';
import { arpabetToSymbol } from '../services/phoneticMapper';
import styles from './ResultPanel.module.css';

export interface ResultPanelProps {
  status: 'idle' | 'loading' | 'success' | 'empty' | 'error';
  results: WordResult[];
  fuzzyResults: FuzzyWordResult[];
  selectedWord: WordDetail | null;
  onSelectWord: (word: string) => void;
  onRetry: () => void;
  onBack: () => void;
  currentSystem?: PhoneticSystem;
  errorMessage?: string | null;
}

/**
 * Convert ARPAbet string to an array of phonetic symbols for the target system.
 * Each element corresponds to one ARPAbet phoneme.
 * When system is 'IPA' or arpabet is empty, splits the IPA phonetic string
 * by mapping each ARPAbet code individually.
 */
function convertPhoneticSegments(
  ipaPhonetic: string,
  arpabet: string,
  system: PhoneticSystem,
): string[] {
  if (!arpabet.trim()) {
    return [ipaPhonetic];
  }
  return arpabet
    .trim()
    .split(/\s+/)
    .map((code) => arpabetToSymbol(code, system));
}

/**
 * Convert a space-separated ARPAbet string to the target phonetic system's symbols.
 * When system is 'IPA' or arpabet is empty, returns the original IPA phonetic string.
 */
function convertPhonetic(
  ipaPhonetic: string,
  arpabet: string,
  system: PhoneticSystem,
): string {
  return convertPhoneticSegments(ipaPhonetic, arpabet, system).join('');
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function WordList({
  results,
  onSelect,
  currentSystem,
}: {
  results: WordResult[];
  onSelect: (word: string) => void;
  currentSystem: PhoneticSystem;
}) {
  return (
    <ul className={styles.wordList} role="list" aria-label="匹配单词列表">
      {results.map((r) => {
        const displayPhonetic = convertPhonetic(r.phonetic, r.arpabet, currentSystem);
        return (
          <li
            key={r.word}
            className={styles.wordItem}
            onClick={() => onSelect(r.word)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(r.word);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`查看单词 ${r.word} 的详情`}
          >
            <div>
              <span className={styles.wordSpelling}>{r.word}</span>
              <span className={styles.wordPhonetic}>/{displayPhonetic}/</span>
            </div>
            <div className={styles.wordMeta}>
              {r.partOfSpeech.length > 0 && (
                <span className={styles.wordPos}>{r.partOfSpeech.join(', ')}</span>
              )}
              {r.briefDefinition && <span>{r.briefDefinition}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function FuzzyResults({
  results,
  onSelect,
  currentSystem,
}: {
  results: FuzzyWordResult[];
  onSelect: (word: string) => void;
  currentSystem: PhoneticSystem;
}) {
  if (results.length === 0) return null;

  return (
    <div className={styles.fuzzySection}>
      <h3 className={styles.fuzzyTitle}>你可能在找</h3>
      <ul className={styles.fuzzyList} role="list" aria-label="模糊匹配建议">
        {results.map((r) => {
          // Build phonetic display with diff highlighting at phoneme level
          const segments = convertPhoneticSegments(r.phonetic, r.arpabet, currentSystem);
          const separator = '';

          return (
            <li
              key={r.word}
              className={styles.fuzzyItem}
              onClick={() => onSelect(r.word)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(r.word);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`建议单词 ${r.word}，相似度 ${Math.round(r.similarity * 100)}%`}
            >
              <div>
                <span className={styles.fuzzyWord}>{r.word}</span>
                <span className={styles.fuzzyPhonetic}>
                  /
                  {segments.map((seg, i) => (
                    <span key={i}>
                      {i > 0 && separator}
                      <span
                        className={r.diffIndices.includes(i) ? styles.diffChar : undefined}
                      >
                        {seg}
                      </span>
                    </span>
                  ))}
                  /
                </span>
              </div>
              <span className={styles.similarity}>
                {Math.round(r.similarity * 100)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function WordDetailView({
  detail,
  displayPhonetic,
}: {
  detail: WordDetail;
  displayPhonetic: string;
}) {
  const [audioHidden, setAudioHidden] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!detail.audioUrl) {
      setAudioHidden(true);
      setAudioRef(null);
      return;
    }
    setAudioHidden(false);
    const audio = new Audio(detail.audioUrl);
    audio.preload = 'auto';
    audio.addEventListener('error', () => setAudioHidden(true), { once: true });
    setAudioRef(audio);
    return () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    };
  }, [detail.audioUrl]);

  const handlePlay = useCallback(() => {
    if (audioRef) {
      audioRef.currentTime = 0;
      audioRef.play().catch(() => setAudioHidden(true));
    }
  }, [audioRef]);

  return (
    <div className={styles.detail} aria-label={`单词 ${detail.word} 的详情`}>
      <div className={styles.detailHeader}>
        <h2 className={styles.detailWord}>{detail.word}</h2>
        <span className={styles.detailPhonetic}>/{displayPhonetic}/</span>
        {detail.audioUrl && !audioHidden && (
          <button
            className={styles.audioButton}
            onClick={handlePlay}
            aria-label={`播放 ${detail.word} 的发音`}
          >
            <span aria-hidden="true">🔊</span> 播放
          </button>
        )}
      </div>

      {detail.meanings.map((meaning, mIdx) => (
        <div key={mIdx} className={styles.meaningSection}>
          <p className={styles.meaningPos}>{meaning.partOfSpeech}</p>
          <ol className={styles.definitionList}>
            {meaning.definitions.map((def, dIdx) => (
              <li key={dIdx} className={styles.definitionItem}>
                <div>{def.definition}</div>
                {def.definitionCn && (
                  <div className={styles.definitionCn}>{def.definitionCn}</div>
                )}
                {def.example && (
                  <div className={styles.example}>"{def.example}"</div>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ResultPanel({
  status,
  results,
  fuzzyResults,
  selectedWord,
  onSelectWord,
  onRetry,
  onBack,
  currentSystem = 'IPA',
  errorMessage,
}: ResultPanelProps) {
  if (status === 'idle') {
    return (
      <div className={styles.container}>
        <div className={styles.idle}>组合音标符号后点击查找</div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className={styles.container}>
        <div className={styles.loading} role="status" aria-live="polite">
          <div className={styles.spinner} aria-hidden="true" />
          <span>正在查找...</span>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.container}>
        <div className={styles.error} role="alert">
          <span>{errorMessage || '查询出错，请稍后重试'}</span>
          <button className={styles.retryButton} onClick={onRetry}>
            重试
          </button>
        </div>
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <div className={styles.container}>
        <div className={styles.emptyMessage}>未找到匹配单词</div>
        <FuzzyResults results={fuzzyResults} onSelect={onSelectWord} currentSystem={currentSystem} />
        {fuzzyResults.length === 0 && (
          <div className={styles.emptyMessage}>请检查音标组合是否正确</div>
        )}
      </div>
    );
  }

  // For WordDetailView, find the matching result's arpabet to enable conversion
  let detailPhonetic = selectedWord?.phonetic ?? '';
  if (selectedWord && currentSystem !== 'IPA') {
    const matchingResult =
      results.find((r) => r.word === selectedWord.word) ??
      fuzzyResults.find((r) => r.word === selectedWord.word);
    if (matchingResult) {
      detailPhonetic = convertPhonetic(selectedWord.phonetic, matchingResult.arpabet, currentSystem);
    }
  }

  // status === 'success'
  return (
    <div className={styles.container}>
      {selectedWord ? (
        <>
          <button
            className={styles.backButton}
            onClick={onBack}
            aria-label="返回搜索结果列表"
          >
            ← 返回结果列表
          </button>
          <WordDetailView detail={selectedWord} displayPhonetic={detailPhonetic} />
        </>
      ) : (
        <WordList results={results} onSelect={onSelectWord} currentSystem={currentSystem} />
      )}
      {!selectedWord && fuzzyResults.length > 0 && (
        <FuzzyResults results={fuzzyResults} onSelect={onSelectWord} currentSystem={currentSystem} />
      )}
    </div>
  );
}
