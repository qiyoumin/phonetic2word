import { useState, useCallback } from 'react';
import type { PhoneticSystem } from '../types/index';
import { ConfirmDialog } from './ConfirmDialog';
import styles from './SystemSwitcher.module.css';

export interface SystemSwitcherProps {
  currentSystem: PhoneticSystem;
  onSwitch: (system: PhoneticSystem) => void;
  hasActiveSequence: boolean;
}

interface SystemOption {
  system: PhoneticSystem;
  label: string;
  disabled: boolean;
  comingSoon: boolean;
}

const SYSTEM_OPTIONS: SystemOption[] = [
  { system: 'IPA', label: 'IPA', disabled: false, comingSoon: false },
  { system: 'KK', label: 'KK', disabled: false, comingSoon: false },
  { system: 'Webster', label: '韦氏', disabled: false, comingSoon: false },
];

export function SystemSwitcher({
  currentSystem,
  onSwitch,
  hasActiveSequence,
}: SystemSwitcherProps) {
  const [pendingSystem, setPendingSystem] = useState<PhoneticSystem | null>(null);

  const handleClick = useCallback(
    (system: PhoneticSystem) => {
      if (system === currentSystem) return;
      if (hasActiveSequence) {
        setPendingSystem(system);
      } else {
        onSwitch(system);
      }
    },
    [currentSystem, hasActiveSequence, onSwitch],
  );

  const handleConfirm = useCallback(() => {
    if (pendingSystem) {
      onSwitch(pendingSystem);
      setPendingSystem(null);
    }
  }, [pendingSystem, onSwitch]);

  const handleCancel = useCallback(() => {
    setPendingSystem(null);
  }, []);

  return (
    <>
      <div className={styles.container} role="radiogroup" aria-label="音标体系选择">
        {SYSTEM_OPTIONS.map((option) => (
          <button
            key={option.system}
            className={`${styles.button} ${currentSystem === option.system ? styles.active : ''}`}
            onClick={() => handleClick(option.system)}
            disabled={option.disabled}
            role="radio"
            aria-checked={currentSystem === option.system}
            aria-label={
              option.comingSoon
                ? `${option.label}（即将推出）`
                : option.label
            }
          >
            {option.label}
            {option.comingSoon && (
              <span className={styles.badge}>即将推出</span>
            )}
          </button>
        ))}
      </div>

      {pendingSystem !== null && (
        <ConfirmDialog
          title="切换音标体系"
          message="切换音标体系将清空当前已组合的音标序列，是否继续？"
          confirmLabel="确认切换"
          cancelLabel="取消"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          confirmVariant="primary"
        />
      )}
    </>
  );
}
