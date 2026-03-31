import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { PhoneticSystem, PhoneticSymbolData, PhoneticSymbol } from '../types/index';
import { playPhoneme } from '../services/audioService';
import styles from './SymbolSelector.module.css';

export interface SymbolSelectorProps {
  system: PhoneticSystem;
  symbols: PhoneticSymbolData[];
  sequence: PhoneticSymbol[];
  maxSequenceLength: number;
  onAppendSymbol: (symbol: PhoneticSymbol) => void;
  onRemoveSymbol: (index: number) => void;
  onClearSequence: () => void;
  /** 渲染在序列输入栏右侧的操作区（如查找按钮） */
  actionSlot?: ReactNode;
}

// --- Phonetic sub-grouping definitions ---

const MONOPHTHONG_CODES = ['IY', 'IH', 'EH', 'AE', 'AH', 'ER', 'AA', 'AO', 'UH', 'UW'];
const DIPHTHONG_CODES = ['EY', 'AY', 'OY', 'AW', 'OW'];

const PLOSIVE_CODES = ['P', 'B', 'T', 'D', 'K', 'G'];
const FRICATIVE_CODES = ['F', 'V', 'TH', 'DH', 'S', 'Z', 'SH', 'ZH', 'HH'];
const AFFRICATE_CODES = ['CH', 'JH'];
const NASAL_CODES = ['M', 'N', 'NG'];
const APPROXIMANT_CODES = ['L', 'R', 'W', 'Y'];

interface SubGroup {
  label: string;
  codes: string[];
}

const VOWEL_SUBGROUPS: SubGroup[] = [
  { label: '单元音 Monophthongs', codes: MONOPHTHONG_CODES },
  { label: '双元音 Diphthongs', codes: DIPHTHONG_CODES },
];

const CONSONANT_SUBGROUPS: SubGroup[] = [
  { label: '爆破音 Plosives', codes: PLOSIVE_CODES },
  { label: '摩擦音 Fricatives', codes: FRICATIVE_CODES },
  { label: '塞擦音 Affricates', codes: AFFRICATE_CODES },
  { label: '鼻音 Nasals', codes: NASAL_CODES },
  { label: '近音 Approximants', codes: APPROXIMANT_CODES },
];

function filterBySubGroup(symbols: PhoneticSymbolData[], codes: string[]): PhoneticSymbolData[] {
  const symbolMap = new Map(symbols.map((s) => [s.arpabetCode, s]));
  return codes.map((code) => symbolMap.get(code)).filter((s): s is PhoneticSymbolData => s != null);
}

// --- Sub-components ---

function SymbolSubGroup({
  label,
  symbols,
  disabled,
  onSelect,
}: {
  label: string;
  symbols: PhoneticSymbolData[];
  disabled: boolean;
  onSelect: (symbol: PhoneticSymbolData) => void;
}) {
  if (symbols.length === 0) return null;
  return (
    <div className={styles.subGroup}>
      <span className={styles.subGroupLabel}>{label}</span>
      <div className={styles.symbolGrid} role="group" aria-label={label}>
        {symbols.map((sym) => (
          <button
            key={sym.arpabetCode}
            className={styles.symbolButton}
            onClick={() => onSelect(sym)}
            disabled={disabled}
            aria-label={`音标 ${sym.symbol}，例如 ${sym.example}`}
          >
            <span className={styles.symbolChar}>{sym.symbol}</span>
            <span className={styles.symbolHint}>{sym.example.split(' as in ').pop()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SymbolGroup({
  title,
  symbols,
  subGroups,
  disabled,
  onSelect,
  defaultExpanded = true,
}: {
  title: string;
  symbols: PhoneticSymbolData[];
  subGroups: SubGroup[];
  disabled: boolean;
  onSelect: (symbol: PhoneticSymbolData) => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 640,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(max-width: 639px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // 非手机端始终展开
  const isExpanded = isMobile ? expanded : true;

  const handleToggle = () => {
    if (isMobile) setExpanded((prev) => !prev);
  };

  return (
    <div>
      <h3
        className={`${styles.groupTitle} ${isMobile ? styles.groupTitleToggle : ''}`}
        onClick={handleToggle}
        role={isMobile ? 'button' : undefined}
        tabIndex={isMobile ? 0 : undefined}
        aria-expanded={isMobile ? isExpanded : undefined}
        onKeyDown={isMobile ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        } : undefined}
      >
        <span>{title}</span>
        {isMobile && (
          <span className={`${styles.toggleIcon} ${isExpanded ? styles.toggleIconExpanded : ''}`} aria-hidden="true">▸</span>
        )}
      </h3>
      {isExpanded && (
        <div className={styles.subGroupContainer}>
          {subGroups.map((sg) => (
            <SymbolSubGroup
              key={sg.label}
              label={sg.label}
              symbols={filterBySubGroup(symbols, sg.codes)}
              disabled={disabled}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SequenceDisplay({
  sequence,
  maxLength,
  onRemove,
  onClear,
  actionSlot,
}: {
  sequence: PhoneticSymbol[];
  maxLength: number;
  onRemove: (index: number) => void;
  onClear: () => void;
  actionSlot?: ReactNode;
}) {
  const atLimit = sequence.length >= maxLength;

  return (
    <div className={styles.sequenceSection}>
      <div className={styles.sequenceRow}>
        <div className={styles.sequenceDisplay} aria-label="当前音标序列">
          {sequence.length === 0 ? (
            <span className={styles.sequenceEmpty}>点击音标符号开始组合...</span>
          ) : (
            sequence.map((sym, idx) => (
              <button
                key={`${sym.arpabetCode}-${idx}`}
                className={styles.sequenceSymbol}
                onClick={() => onRemove(idx)}
                aria-label={`移除音标 ${sym.symbol}`}
                title={`点击移除 ${sym.symbol}`}
              >
                {sym.symbol}
              </button>
            ))
          )}
        </div>
        {sequence.length > 0 && (
          <button
            className={styles.clearButton}
            onClick={onClear}
            aria-label="清空音标序列"
          >
            清空
          </button>
        )}
        {actionSlot}
      </div>
      <span
        className={`${styles.lengthIndicator} ${atLimit ? styles.lengthWarning : ''}`}
      >
        {sequence.length}/{maxLength}
        {atLimit && ' (已达上限)'}
      </span>
    </div>
  );
}

export function SymbolSelector({
  symbols,
  sequence,
  maxSequenceLength,
  onAppendSymbol,
  onRemoveSymbol,
  onClearSequence,
  actionSlot,
}: SymbolSelectorProps) {
  const vowels = symbols.filter((s) => s.category === 'vowel');
  const consonants = symbols.filter((s) => s.category === 'consonant');
  const atLimit = sequence.length >= maxSequenceLength;

  const handleSelect = (sym: PhoneticSymbolData) => {
    playPhoneme(sym.arpabetCode);
    onAppendSymbol({
      symbol: sym.symbol,
      arpabetCode: sym.arpabetCode,
      index: sequence.length,
    });
  };

  return (
    <div className={styles.container}>
      <SequenceDisplay
        sequence={sequence}
        maxLength={maxSequenceLength}
        onRemove={onRemoveSymbol}
        onClear={onClearSequence}
        actionSlot={actionSlot}
      />
      <div className={styles.phonemeGroups}>
        <div className={styles.vowelGroup}>
          <SymbolGroup
            title="元音 Vowels"
            symbols={vowels}
            subGroups={VOWEL_SUBGROUPS}
            disabled={atLimit}
            onSelect={handleSelect}
          />
        </div>
        <div className={styles.consonantGroup}>
          <SymbolGroup
            title="辅音 Consonants"
            symbols={consonants}
            subGroups={CONSONANT_SUBGROUPS}
            disabled={atLimit}
            onSelect={handleSelect}
          />
        </div>
      </div>
    </div>
  );
}
