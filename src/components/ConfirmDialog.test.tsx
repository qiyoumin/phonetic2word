import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

const defaultProps = {
  title: '测试标题',
  message: '测试消息内容',
  confirmLabel: '确认',
  cancelLabel: '取消',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

function renderDialog(overrides: Partial<typeof defaultProps & { confirmVariant: 'primary' | 'danger' }> = {}) {
  const props = { ...defaultProps, onConfirm: vi.fn(), onCancel: vi.fn(), ...overrides };
  const result = render(<ConfirmDialog {...props} />);
  return { ...result, props };
}

describe('ConfirmDialog', () => {
  it('渲染标题和消息', () => {
    renderDialog();
    expect(screen.getByText('测试标题')).toBeInTheDocument();
    expect(screen.getByText('测试消息内容')).toBeInTheDocument();
  });

  it('渲染自定义按钮文本', () => {
    renderDialog({ confirmLabel: '删除', cancelLabel: '返回' });
    expect(screen.getByRole('button', { name: '删除' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回' })).toBeInTheDocument();
  });

  it('点击确认按钮触发 onConfirm', () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: '确认' }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('点击取消按钮触发 onCancel', () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape 键触发 onCancel', () => {
    const { props } = renderDialog();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('自动聚焦取消按钮', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: '取消' })).toHaveFocus();
  });

  it('dialog 具有正确的 aria 属性', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', '测试标题');
  });

  it('confirmVariant=danger 使用 danger 样式', () => {
    renderDialog({ confirmVariant: 'danger' });
    const confirmBtn = screen.getByRole('button', { name: '确认' });
    expect(confirmBtn.className).toContain('confirmBtnDanger');
  });

  it('confirmVariant=primary 使用 primary 样式', () => {
    renderDialog({ confirmVariant: 'primary' });
    const confirmBtn = screen.getByRole('button', { name: '确认' });
    expect(confirmBtn.className).toContain('confirmBtnPrimary');
  });

  it('焦点陷阱：在最后一个元素按 Tab 回到第一个', () => {
    renderDialog();
    const confirmBtn = screen.getByRole('button', { name: '确认' });
    const cancelBtn = screen.getByRole('button', { name: '取消' });
    confirmBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(cancelBtn).toHaveFocus();
  });

  it('焦点陷阱：在第一个元素按 Shift+Tab 回到最后一个', () => {
    renderDialog();
    const confirmBtn = screen.getByRole('button', { name: '确认' });
    const cancelBtn = screen.getByRole('button', { name: '取消' });
    cancelBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(confirmBtn).toHaveFocus();
  });
});
