import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SymbolSelector } from './SymbolSelector';
import type { PhoneticSymbolData, PhoneticSymbol } from '../types/index';

// Mock audioService
vi.mock('../services/audioService', () => ({
  playPhoneme: vi.fn(),
}));
import { playPhoneme } from '../services/audioService';

const vowelSymbol: PhoneticSymbolData = {
  symbol: 'æ',
  arpabetCode: 'AE',
  category: 'vowel',
  example: 'a as in cat',
  system: 'IPA',
};

const consonantSymbol: PhoneticSymbolData = {
  symbol: 'p',
  arpabetCode: 'P',
  category: 'consonant',
  example: 'p as in pen',
  system: 'IPA',
};

const defaultProps = {
  system: 'IPA' as const,
  symbols: [vowelSymbol, consonantSymbol],
  sequence: [] as PhoneticSymbol[],
  maxSequenceLength: 20,
  onAppendSymbol: vi.fn(),
  onRemoveSymbol: vi.fn(),
  onClearSequence: vi.fn(),
};

function renderSelector(overrides: Partial<typeof defaultProps> = {}) {
  const props = {
    ...defaultProps,
    onAppendSymbol: vi.fn(),
    onRemoveSymbol: vi.fn(),
    onClearSequence: vi.fn(),
    ...overrides,
  };
  const result = render(<SymbolSelector {...props} />);
  return { ...result, props };
}

describe('SymbolSelector', () => {
  it('渲染元音和辅音分组', () => {
    renderSelector();
    expect(screen.getByText('元音 Vowels')).toBeInTheDocument();
    expect(screen.getByText('辅音 Consonants')).toBeInTheDocument();
  });

  it('点击符号触发 onAppendSymbol', () => {
    const { props } = renderSelector();
    const btn = screen.getByRole('button', { name: /音标 æ/ });
    fireEvent.click(btn);
    expect(props.onAppendSymbol).toHaveBeenCalledTimes(1);
    expect(props.onAppendSymbol).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: 'æ', arpabetCode: 'AE' }),
    );
  });

  it('点击符号时播放对应音素音频', () => {
    renderSelector();
    const btn = screen.getByRole('button', { name: /音标 æ/ });
    fireEvent.click(btn);
    expect(playPhoneme).toHaveBeenCalledWith('AE');
  });

  it('达到上限时按钮 disabled', () => {
    const sequence: PhoneticSymbol[] = Array.from({ length: 3 }, (_, i) => ({
      symbol: 'æ',
      arpabetCode: 'AE',
      index: i,
    }));
    renderSelector({ sequence, maxSequenceLength: 3 });
    const btn = screen.getByRole('button', { name: /音标 æ，例如/ });
    expect(btn).toBeDisabled();
  });

  it('点击序列中的符号触发 onRemoveSymbol', () => {
    const sequence: PhoneticSymbol[] = [
      { symbol: 'æ', arpabetCode: 'AE', index: 0 },
    ];
    const { props } = renderSelector({ sequence });
    const seqBtn = screen.getByRole('button', { name: '移除音标 æ' });
    fireEvent.click(seqBtn);
    expect(props.onRemoveSymbol).toHaveBeenCalledWith(0);
  });

  it('清空按钮触发 onClearSequence', () => {
    const sequence: PhoneticSymbol[] = [
      { symbol: 'æ', arpabetCode: 'AE', index: 0 },
    ];
    const { props } = renderSelector({ sequence });
    const clearBtn = screen.getByRole('button', { name: '清空音标序列' });
    fireEvent.click(clearBtn);
    expect(props.onClearSequence).toHaveBeenCalledTimes(1);
  });

  it('空序列时不显示清空按钮', () => {
    renderSelector({ sequence: [] });
    expect(screen.queryByRole('button', { name: '清空音标序列' })).not.toBeInTheDocument();
  });

  it('显示长度指示器', () => {
    const sequence: PhoneticSymbol[] = [
      { symbol: 'æ', arpabetCode: 'AE', index: 0 },
    ];
    renderSelector({ sequence, maxSequenceLength: 20 });
    expect(screen.getByText('1/20')).toBeInTheDocument();
  });
});
