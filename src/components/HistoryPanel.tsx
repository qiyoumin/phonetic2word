import { useState, useCallback } from 'react';
import type { HistoryRecord } from '../types/index';
import { ConfirmDialog } from './ConfirmDialog';
import styles from './HistoryPanel.module.css';

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
          <ul className={styles.list} role="list" aria-label="查询历史记录">
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
