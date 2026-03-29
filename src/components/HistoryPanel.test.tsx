import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryPanel } from './HistoryPanel';
import type { HistoryRecord } from '../types/index';

const makeRecord = (id: string, symbols: string[] = ['æ', 'p']): HistoryRecord => ({
  id,
  timestamp: Date.now(),
  system: 'IPA',
  sequence: symbols.map((s, i) => ({ symbol: s, arpabetCode: 'AE', index: i })),
  matchedWords: ['apple'],
});

const defaultProps = {
  records: [] as HistoryRecord[],
  onSelectRecord: vi.fn(),
  onClearHistory: vi.fn(),
};

function renderPanel(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, onSelectRecord: vi.fn(), onClearHistory: vi.fn(), ...overrides };
  const result = render(<HistoryPanel {...props} />);
  return { ...result, props };
}

describe('HistoryPanel', () => {
  it('空记录时显示"暂无查询记录"', () => {
    renderPanel({ records: [] });
    expect(screen.getByText('暂无查询记录')).toBeInTheDocument();
  });

  it('有记录时渲染列表', () => {
    const records = [makeRecord('1'), makeRecord('2', ['ɪ'])];
    renderPanel({ records });
    const list = screen.getByRole('list', { name: '查询历史记录' });
    expect(list).toBeInTheDocument();
    expect(list.querySelectorAll('li')).toHaveLength(2);
  });

  it('点击记录触发 onSelectRecord', () => {
    const record = makeRecord('1');
    const { props } = renderPanel({ records: [record] });
    const item = screen.getByRole('button', { name: /回填音标序列/ });
    fireEvent.click(item);
    expect(props.onSelectRecord).toHaveBeenCalledWith(record);
  });

  it('清除按钮显示确认对话框', () => {
    renderPanel({ records: [makeRecord('1')] });
    fireEvent.click(screen.getByRole('button', { name: '清除所有历史记录' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('确定要清除所有查询历史记录吗？此操作不可撤销。')).toBeInTheDocument();
  });

  it('确认清除调用 onClearHistory', () => {
    const { props } = renderPanel({ records: [makeRecord('1')] });
    fireEvent.click(screen.getByRole('button', { name: '清除所有历史记录' }));
    fireEvent.click(screen.getByRole('button', { name: '确认清除' }));
    expect(props.onClearHistory).toHaveBeenCalledTimes(1);
  });

  it('Escape 关闭确认对话框', () => {
    renderPanel({ records: [makeRecord('1')] });
    fireEvent.click(screen.getByRole('button', { name: '清除所有历史记录' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('空记录时不显示清除按钮', () => {
    renderPanel({ records: [] });
    expect(screen.queryByRole('button', { name: '清除所有历史记录' })).not.toBeInTheDocument();
  });
});
