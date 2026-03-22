/**
 * MorphingSaveButton Component
 *
 * A save button that morphs between states with smooth animations.
 * Inspired by uilab.dev patterns.
 *
 * States:
 * - idle: Shows save icon, enabled when dirty
 * - saving: Shows spinner, disabled
 * - saved: Shows checkmark with success color, auto-returns to idle
 * - error: Shows error icon with error color, click to retry
 *
 * @module editor/v3/components/MorphingSaveButton
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { SaveState, MorphingSaveButtonProps } from '../hooks/useSaveFile';

// =============================================================================
// Icons (inline SVG for independence)
// =============================================================================

const SaveIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const SpinnerIcon = ({ className }: { className?: string }) => (
  <svg
    className={cn('animate-spin', className)}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ErrorIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

// =============================================================================
// Component
// =============================================================================

export interface MorphingSaveButtonFullProps extends MorphingSaveButtonProps {
  /**
   * Size variant.
   * @default 'default'
   */
  size?: 'sm' | 'default' | 'lg';

  /**
   * Show text label alongside icon.
   * @default false
   */
  showLabel?: boolean;

  /**
   * Custom labels for each state.
   */
  labels?: {
    idle?: string;
    saving?: string;
    saved?: string;
    error?: string;
  };

  /**
   * Tooltip text (uses title attribute).
   */
  tooltip?: string;

  /**
   * Additional class for the icon.
   */
  iconClassName?: string;
}

const defaultLabels = {
  idle: 'Save',
  saving: 'Saving...',
  saved: 'Saved',
  error: 'Error',
};

/**
 * Morphing save button with state-based icon transitions.
 *
 * @example
 * ```tsx
 * const { state, isDirty, canSave, save } = useSaveFile({
 *   registry,
 *   fileDocumentLayer,
 *   getContent: () => editor.getMarkdown(),
 * })
 *
 * <MorphingSaveButton
 *   state={state}
 *   isDirty={isDirty}
 *   disabled={!canSave}
 *   onClick={() => save(editor.getMarkdown())}
 * />
 * ```
 */
export function MorphingSaveButton({
  state,
  isDirty,
  disabled = false,
  onClick,
  className,
  size = 'default',
  showLabel = false,
  labels: customLabels,
  tooltip,
  iconClassName,
}: MorphingSaveButtonFullProps) {
  const labels = useMemo(
    () => ({ ...defaultLabels, ...customLabels }),
    [customLabels]
  );

  // Determine visual state
  const isDisabled = disabled || state === 'saving';
  const isSaving = state === 'saving';
  const isSaved = state === 'saved';
  const isError = state === 'error';

  // Size classes
  const sizeClasses = {
    sm: 'h-7 px-2 text-xs gap-1',
    default: 'h-9 px-3 text-sm gap-1.5',
    lg: 'h-11 px-4 text-base gap-2',
  };

  const iconSizeClasses = {
    sm: 'w-3.5 h-3.5',
    default: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  // State-based styling
  const stateClasses = useMemo(() => {
    if (isError) {
      return 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20';
    }
    if (isSaved) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
    if (isSaving) {
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    }
    if (isDirty) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20';
    }
    // Idle, not dirty
    return 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:bg-zinc-700/50';
  }, [isError, isSaved, isSaving, isDirty]);

  // Icon component based on state
  const IconComponent = useMemo(() => {
    if (isSaving) return SpinnerIcon;
    if (isSaved) return CheckIcon;
    if (isError) return ErrorIcon;
    return SaveIcon;
  }, [isSaving, isSaved, isError]);

  // Current label
  const label = useMemo(() => {
    if (isSaving) return labels.saving;
    if (isSaved) return labels.saved;
    if (isError) return labels.error;
    return labels.idle;
  }, [isSaving, isSaved, isError, labels]);

  // Dirty indicator dot
  const showDirtyDot = isDirty && state === 'idle';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      title={tooltip ?? label}
      className={cn(
        // Base styles
        'relative inline-flex items-center justify-center',
        'rounded-md border font-medium',
        'transition-all duration-200 ease-out',
        'focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-1 focus:ring-offset-zinc-900',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        // Size
        sizeClasses[size],
        // State
        stateClasses,
        className
      )}
    >
      {/* Icon with transition */}
      <span
        className={cn(
          'transition-transform duration-200',
          isSaved && 'scale-110',
          iconClassName
        )}
      >
        <IconComponent className={iconSizeClasses[size]} />
      </span>

      {/* Label (optional) */}
      {showLabel && (
        <span className="transition-opacity duration-200">{label}</span>
      )}

      {/* Dirty indicator dot */}
      {showDirtyDot && (
        <span
          className={cn(
            'absolute -top-1 -right-1',
            'w-2 h-2 rounded-full',
            'bg-amber-400',
            'animate-pulse'
          )}
        />
      )}
    </button>
  );
}

// =============================================================================
// Compact Variant
// =============================================================================

export interface CompactSaveButtonProps {
  state: SaveState;
  isDirty: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}

/**
 * Compact icon-only save button.
 * Minimal footprint for toolbars.
 */
export function CompactSaveButton({
  state,
  isDirty,
  disabled = false,
  onClick,
  className,
}: CompactSaveButtonProps) {
  return (
    <MorphingSaveButton
      state={state}
      isDirty={isDirty}
      disabled={disabled}
      onClick={onClick}
      className={className}
      size="sm"
      showLabel={false}
    />
  );
}

// =============================================================================
// Keyboard Shortcut Hint
// =============================================================================

export interface SaveButtonWithHintProps extends MorphingSaveButtonFullProps {
  /**
   * Show keyboard shortcut hint.
   * @default true
   */
  showShortcut?: boolean;

  /**
   * Platform for shortcut display.
   * @default auto-detect
   */
  platform?: 'mac' | 'windows' | 'linux';
}

/**
 * Save button with keyboard shortcut hint.
 */
export function SaveButtonWithHint({
  showShortcut = true,
  platform,
  tooltip,
  ...props
}: SaveButtonWithHintProps) {
  const detectedPlatform = useMemo(() => {
    if (platform) return platform;
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('mac')) return 'mac';
      if (ua.includes('win')) return 'windows';
    }
    return 'linux';
  }, [platform]);

  const shortcutHint = detectedPlatform === 'mac' ? '⌘S' : 'Ctrl+S';
  const fullTooltip = showShortcut
    ? `${tooltip ?? 'Save'} (${shortcutHint})`
    : tooltip;

  return <MorphingSaveButton {...props} tooltip={fullTooltip} />;
}

export default MorphingSaveButton;
