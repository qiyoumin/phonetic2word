import { useState, useCallback, useRef, useEffect } from 'react';
import type { HistoryRecord } from '../types/index';
import { ConfirmDialog } from './ConfirmDialog';
import styles from './HistoryPanel.module.css';

const LIST_HEIGHT_KEY = 'history-list-height';

export interface HistoryPanelProps {
  records: HistoryRecord[];
  onSelectRecord: (record: HistoryRecord) => void;
  onClearHistory: () => void;
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function HistoryPanel({
  records,
  onSelectRecord,
  onClearHistory,
}: HistoryPanelProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [overflowing, setOverflowing] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  // 默认最大高度阈值（px），未保存过高度时使用
  const DEFAULT_MAX_HEIGHT = typeof window !== 'undefined' && window.innerWidth <= 1024 ? 300 : 400;

  // 响应式紧凑模式检测：通过 matchMedia 监听视口变化
  const [isCompactMode, setIsCompactMode] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth > 1024 && window.innerHeight <= 900,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(min-width: 1025px) and (max-height: 900px)');
    const handler = (e: MediaQueryListEvent) => setIsCompactMode(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // 从 localStorage 恢复列表高度，或在内容溢出时设置默认高度
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    // 紧凑模式下不设置固定高度，交给 CSS flex 布局控制
    if (isCompactMode) {
      el.style.height = '';
      el.style.minHeight = '';
      el.style.maxHeight = '';
      setOverflowing(false);
      return;
    }

    // 先清除固定高度，测量自然内容高度
    el.style.height = '';
    el.style.minHeight = '';
    el.style.maxHeight = '';
    const naturalHeight = el.scrollHeight;

    if (naturalHeight > DEFAULT_MAX_HEIGHT) {
      // 内容溢出：启用固定高度 + resize
      setOverflowing(true);

      // 尝试恢复用户之前拖拽保存的高度
      let targetHeight = DEFAULT_MAX_HEIGHT;
      try {
        const saved = localStorage.getItem(LIST_HEIGHT_KEY);
        if (saved) {
          const h = parseInt(saved, 10);
          // 恢复的高度不能小于阈值
          if (h >= DEFAULT_MAX_HEIGHT) {
            targetHeight = h;
          }
        }
      } catch { /* ignore */ }

      el.style.height = `${targetHeight}px`;
      // 设置 min-height 防止用户拉得比阈值更短
      el.style.minHeight = `${DEFAULT_MAX_HEIGHT}px`;
      // 设置 max-height 防止用户拉得比内容更长
      el.style.maxHeight = `${naturalHeight}px`;
    } else {
      // 内容未溢出：自然高度，不显示 resize
      setOverflowing(false);
    }
  }, [records.length, DEFAULT_MAX_HEIGHT, isCompactMode]);

  // 监听列表高度变化（用户拖拽 resize），持久化到 localStorage
  // 紧凑模式下跳过，避免不必要的 localStorage 写入
  useEffect(() => {
    const el = listRef.current;
    if (!el || isCompactMode) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        let height = Math.round(entry.contentRect.height);

        // 限制拖拽范围：不超过内容实际高度
        const maxH = el.scrollHeight;
        if (height > maxH && maxH > 0) {
          height = maxH;
          el.style.height = `${maxH}px`;
        }

        try {
          localStorage.setItem(LIST_HEIGHT_KEY, String(height));
        } catch {
          // 静默忽略
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [isCompactMode]);

  const handleClearClick = useCallback(() => {
    setShowConfirm(true);
  }, []);

  const handleConfirmClear = useCallback(() => {
    onClearHistory();
    setShowConfirm(false);
  }, [onClearHistory]);

  const handleCancelClear = useCallback(() => {
    setShowConfirm(false);
  }, []);

  const toggleDrawer = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  return (
    <>
      <div className={`${styles.container} ${collapsed ? styles.collapsed : ''}`}>
        <div className={styles.drawerHandle} onClick={toggleDrawer} aria-label="展开/收起历史记录">
          <div className={styles.handleBar} />
        </div>

        <div className={styles.header}>
          <h3 className={styles.title}>查询历史</h3>
          {records.length > 0 && (
            <button
              className={styles.clearButton}
              onClick={handleClearClick}
              aria-label="清除所有历史记录"
            >
              清除历史
            </button>
          )}
        </div>

        {records.length === 0 ? (
          <div className={styles.empty}>暂无查询记录</div>
        ) : (
          <ul className={`${styles.list} ${overflowing ? styles.listOverflowing : ''}`} role="list" aria-label="查询历史记录" ref={listRef}>
            {records.map((record) => (
              <li
                key={record.id}
                className={styles.item}
                onClick={() => onSelectRecord(record)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectRecord(record);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`回填音标序列 ${record.sequence.map((s) => s.symbol).join('')}`}
              >
                <div className={styles.itemSequence}>
                  /{record.sequence.map((s) => s.symbol).join('')}/
                </div>
                <div className={styles.itemMeta}>
                  <span className={styles.itemSystem}>{record.system}</span>
                  <span>{formatTime(record.timestamp)}</span>
                  {record.matchedWords.length > 0 && (
                    <span>{record.matchedWords.slice(0, 3).join(', ')}{record.matchedWords.length > 3 ? '...' : ''}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showConfirm && (
        <ConfirmDialog
          title="清除历史记录"
          message="确定要清除所有查询历史记录吗？此操作不可撤销。"
          confirmLabel="确认清除"
          cancelLabel="取消"
          onConfirm={handleConfirmClear}
          onCancel={handleCancelClear}
          confirmVariant="danger"
        />
      )}
    </>
  );
}
