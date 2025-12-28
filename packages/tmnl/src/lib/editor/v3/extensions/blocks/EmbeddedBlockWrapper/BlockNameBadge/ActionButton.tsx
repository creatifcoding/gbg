/**
 * ActionButton Component
 *
 * Ghost button for hover action tray. Features:
 * - Subtle hover/active states
 * - Success flash animation (icon → checkmark → icon)
 * - Accessible with aria-label
 *
 * @module editor/v3/extensions/blocks/BlockNameBadge/ActionButton
 */

import React, { useState, useCallback, useRef, forwardRef } from 'react';
import { animate } from 'animejs';
import { Check, type LucideIcon } from 'lucide-react';
import { COLORS } from './constants';

// =============================================================================
// Types
// =============================================================================

export interface ActionButtonProps {
  /** Lucide icon component */
  icon: LucideIcon;

  /** Click handler - should return Promise for success feedback */
  onClick: () => Promise<void> | void;

  /** Accessible label */
  label: string;

  /** Optional className override */
  className?: string;

  /** Optional inline style (for animation initial state) */
  style?: React.CSSProperties;
}

// =============================================================================
// Styles
// =============================================================================

const BUTTON_STYLES = {
  base: {
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    background: 'rgba(255, 255, 255, 0.06)',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    outline: 'none',
    transition: 'background 100ms ease-out, transform 100ms ease-out',
  } as const,
  hover: {
    background: 'rgba(255, 255, 255, 0.12)',
  } as const,
  active: {
    background: 'rgba(255, 255, 255, 0.18)',
    transform: 'scale(0.95)',
  } as const,
  focus: {
    boxShadow: `0 0 0 2px ${COLORS.underlineCyan}`,
  } as const,
};

const ICON_STYLES = {
  base: {
    width: '14px',
    height: '14px',
    color: 'rgba(255, 255, 255, 0.5)',
    transition: 'color 100ms ease-out',
  } as const,
  hover: {
    color: 'rgba(255, 255, 255, 0.8)',
  } as const,
  success: {
    color: COLORS.underlineEmerald,
  } as const,
};

// =============================================================================
// ActionButton Component
// =============================================================================

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  function ActionButton({ icon: Icon, onClick, label, className, style: externalStyle }, ref) {
    const [isHovered, setIsHovered] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const iconRef = useRef<SVGSVGElement>(null);
    const successIconRef = useRef<SVGSVGElement>(null);

    // ─────────────────────────────────────────────────────────────
    // Click Handler with Success Animation
    // ─────────────────────────────────────────────────────────────

    const handleClick = useCallback(
      async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        try {
          await onClick();

          // Show success state
          setShowSuccess(true);

          // Animate success icon in
          if (successIconRef.current) {
            animate(successIconRef.current, {
              scale: [0, 1.1, 1],
              opacity: [0, 1],
              duration: 150,
              easing: 'easeOutBack',
            });
          }

          // Restore after 500ms
          setTimeout(() => {
            setShowSuccess(false);
          }, 500);
        } catch (err) {
          // Error handling - could add shake animation here
          console.error('Action failed:', err);
        }
      },
      [onClick]
    );

    // ─────────────────────────────────────────────────────────────
    // Computed Styles
    // ─────────────────────────────────────────────────────────────

    const buttonStyle: React.CSSProperties = {
      ...BUTTON_STYLES.base,
      ...(isHovered && !isActive ? BUTTON_STYLES.hover : {}),
      ...(isActive ? BUTTON_STYLES.active : {}),
      ...(isFocused ? BUTTON_STYLES.focus : {}),
      ...externalStyle,
    };

    const iconStyle: React.CSSProperties = {
      ...ICON_STYLES.base,
      ...(isHovered ? ICON_STYLES.hover : {}),
      ...(showSuccess ? ICON_STYLES.success : {}),
    };

    // ─────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────

    return (
      <button
        ref={ref}
        type="button"
        className={className}
        style={buttonStyle}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsActive(false);
        }}
        onMouseDown={() => setIsActive(true)}
        onMouseUp={() => setIsActive(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        aria-label={label}
        title={label}
      >
        {showSuccess ? (
          <Check ref={successIconRef} style={iconStyle} />
        ) : (
          <Icon ref={iconRef} style={iconStyle} />
        )}
      </button>
    );
  }
);

export default ActionButton;
