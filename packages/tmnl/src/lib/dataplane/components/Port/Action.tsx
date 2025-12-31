/**
 * @fileoverview Port Action Component
 *
 * Individual action button for port operations.
 */

import React, { memo } from 'react';

export interface PortActionProps {
  /** Icon character or symbol */
  icon: string;
  /** Click handler */
  onClick: (e: React.MouseEvent) => void;
  /** Accessible label */
  label: string;
  /** Button variant */
  variant?: 'default' | 'destructive';
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Individual action button.
 */
export const Action = memo(function PortAction({
  icon,
  onClick,
  label,
  variant = 'default',
  disabled = false,
}: PortActionProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) onClick(e);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`
        p-1.5 rounded
        transition-colors duration-150
        font-mono
        ${disabled
          ? 'opacity-50 cursor-not-allowed'
          : variant === 'destructive'
            ? 'text-muted-foreground hover:text-red-400 hover:bg-red-500/10'
            : 'text-muted-foreground hover:text-foreground hover:bg-surface-3'
        }
      `}
      style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
    >
      {icon}
    </button>
  );
});

export default Action;
