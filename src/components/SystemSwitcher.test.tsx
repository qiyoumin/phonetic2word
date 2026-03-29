import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SystemSwitcher } from './SystemSwitcher';

import type { PhoneticSystem } from '../types/index';

const defaultProps = {
  currentSystem: 'IPA' as PhoneticSystem,
  onSwitch: vi.fn(),
  hasActiveSequence: false,
};

function renderSwitcher(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, onSwitch: vi.fn(), ...overrides };
  const result = render(<SystemSwitcher {...props} />);
  return { ...result, props };
}

describe('SystemSwitcher', () => {
  it('渲染三个系统按钮', () => {
    renderSwitcher();
    expect(screen.getByRole('radio', { name: 'IPA' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'KK' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '韦氏' })).toBeInTheDocument();
  });

  it('当前系统高亮（aria-checked）', () => {
    renderSwitcher({ currentSystem: 'KK' });
    expect(screen.getByRole('radio', { name: 'KK' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'IPA' })).toHaveAttribute('aria-checked', 'false');
  });

  it('无序列时直接切换', () => {
    const { props } = renderSwitcher({ hasActiveSequence: false });
    fireEvent.click(screen.getByRole('radio', { name: 'KK' }));
    expect(props.onSwitch).toHaveBeenCalledWith('KK');
  });

  it('有序列时显示确认对话框', () => {
    renderSwitcher({ hasActiveSequence: true });
    fireEvent.click(screen.getByRole('radio', { name: 'KK' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('切换音标体系将清空当前已组合的音标序列，是否继续？')).toBeInTheDocument();
  });

  it('确认切换调用 onSwitch', () => {
    const { props } = renderSwitcher({ hasActiveSequence: true });
    fireEvent.click(screen.getByRole('radio', { name: 'KK' }));
    fireEvent.click(screen.getByRole('button', { name: '确认切换' }));
    expect(props.onSwitch).toHaveBeenCalledWith('KK');
  });

  it('取消关闭对话框', () => {
    renderSwitcher({ hasActiveSequence: true });
    fireEvent.click(screen.getByRole('radio', { name: 'KK' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('点击当前系统不触发切换', () => {
    const { props } = renderSwitcher({ currentSystem: 'IPA' });
    fireEvent.click(screen.getByRole('radio', { name: 'IPA' }));
    expect(props.onSwitch).not.toHaveBeenCalled();
  });
});
