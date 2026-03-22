/**
 * BlockNameBadge Component — v3 First Principles
 *
 * Uses HeaderButton pattern: plain <button> with onMouseDown/onMouseUp.
 * Manual double-click detection because ProseMirror eats onDoubleClick.
 */
import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type FocusEvent,
  type MouseEvent,
} from 'react';
import { Option } from 'effect';
import { useAtomValue } from '@effect-atom/atom-react';
import { useMachine } from '@xstate/react';

import {
  VANTA_COLORS,
  VANTA_BORDERS,
  VANTA_SPACING,
  VANTA_TYPOGRAPHY,
  VANTA_ANIMATION,
} from '@/components/portal/tokens';

import type { BlockId } from './shared';
import { renameErrorAtom, isRenamingAtom, blockByIdAtom } from './registry';
import {
  blockNameMachine,
  type BlockNameMachineContext,
} from './BlockNameBadge/machines/blockNameMachine';

// =============================================================================
// Constants
// =============================================================================

const DOUBLE_CLICK_THRESHOLD_MS = 300;

// =============================================================================
// Types
// =============================================================================

interface BlockNameBadgeProps {
  blockId: BlockId;
  onRename?: (newName: string) => Promise<void>;
  accentColor?: string;
  accentBg?: string;
}

type BadgeState = 'display' | 'editing' | 'submitting' | 'success' | 'error';

// =============================================================================
// Component
// =============================================================================

export function BlockNameBadge({
  blockId,
  onRename,
  accentColor = VANTA_COLORS.text.muted,
  accentBg = VANTA_COLORS.surface.hover,
}: BlockNameBadgeProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Double-click detection state
  const lastClickTimeRef = useRef<number>(0);

  // Visual feedback state (HeaderButton pattern)
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  // Atom state
  const blockRef = useAtomValue(blockByIdAtom(blockId));
  const renameError = useAtomValue(renameErrorAtom);
  const isRenaming = useAtomValue(isRenamingAtom);

  const isThisBlockRenaming =
    Option.isSome(isRenaming) && isRenaming.value === blockId;

  const name = Option.isSome(blockRef) ? blockRef.value.name : Option.none();
  const displayName = Option.isSome(name) ? name.value : null;

  // XState machine
  const [state, send] = useMachine(blockNameMachine, {
    input: {
      blockId,
      currentName: displayName,
      inputValue: '',
      error: null,
      onRename,
    } satisfies BlockNameMachineContext,
  });

  const currentState = state.value as BadgeState;
  const isEditable = !!onRename;

  // Sync external state to machine
  useEffect(() => {
    send({ type: 'SET_NAME', name: displayName });
  }, [displayName, send]);

  useEffect(() => {
    send({ type: 'SET_ON_RENAME', handler: onRename });
  }, [onRename, send]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (currentState === 'editing' && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [currentState]);

  // =============================================================================
  // Handlers
  // =============================================================================

  const handleSubmit = useCallback(async () => {
    send({ type: 'SUBMIT' });

    if (state.context.onRename && state.context.inputValue.trim()) {
      try {
        await state.context.onRename(state.context.inputValue.trim());
        send({ type: 'SUCCESS' });
      } catch (err) {
        send({
          type: 'ERROR',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  }, [send, state.context]);

  const handleInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        send({ type: 'CANCEL' });
      }
    },
    [handleSubmit, send]
  );

  const handleBlur = useCallback(
    (_e: FocusEvent<HTMLInputElement>) => {
      // Small delay to allow button clicks to register first
      setTimeout(() => {
        if (currentState === 'editing') {
          handleSubmit();
        }
      }, 100);
    },
    [currentState, handleSubmit]
  );

  // HeaderButton pattern: manual double-click via mousedown/mouseup
  const handleMouseDown = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPressed(true);
    console.log('[BlockNameBadge] mouseDown');
  }, []);

  const handleMouseUp = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isPressed) {
        console.log('[BlockNameBadge] mouseUp — not pressed, ignoring');
        return;
      }

      setIsPressed(false);

      const now = Date.now();
      const timeSinceLastClick = now - lastClickTimeRef.current;

      console.log('[BlockNameBadge] mouseUp', {
        timeSinceLastClick,
        threshold: DOUBLE_CLICK_THRESHOLD_MS,
      });

      if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD_MS) {
        // Double-click detected!
        console.log(
          '[BlockNameBadge] DOUBLE-CLICK DETECTED — entering edit mode'
        );
        lastClickTimeRef.current = 0; // Reset
        send({ type: 'EDIT' });
      } else {
        // First click — record timestamp
        lastClickTimeRef.current = now;
      }
    },
    [isPressed, send]
  );

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (isPressed) {
      console.log('[BlockNameBadge] mouseLeave while pressed — cancelling');
      setIsPressed(false);
    }
  }, [isPressed]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      // Ctrl+R or Cmd+R to rename
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        send({ type: 'EDIT' });
      }
    },
    [send]
  );

  // =============================================================================
  // Computed Styles (HeaderButton pattern)
  // =============================================================================

  const hasError = state.context.error !== null || Option.isSome(renameError);

  const getBadgeStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: VANTA_SPACING['1'],
      padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
      background: displayName ? accentBg : VANTA_COLORS.surface.hover,
      border: `1px solid ${
        displayName ? 'transparent' : VANTA_COLORS.surface.border
      }`,
      borderRadius: VANTA_BORDERS.radius.sm,
      cursor: isEditable ? 'pointer' : 'default',
      outline: 'none',
      transition: `all ${VANTA_ANIMATION.duration.fast} ${VANTA_ANIMATION.easing.default}`,
      opacity: displayName ? 1 : 0.6,
      userSelect: 'none',
    };

    if (isPressed) {
      return {
        ...base,
        transform: 'scale(0.95)',
        boxShadow: `0 0 0 2px ${VANTA_COLORS.accent.cyan}`,
      };
    }

    if (isHovered && isEditable) {
      return {
        ...base,
        boxShadow: `0 0 0 1px ${VANTA_COLORS.surface.border}`,
        background: VANTA_COLORS.surface.raised,
      };
    }

    return base;
  };

  // =============================================================================
  // Render
  // =============================================================================

  // DISPLAY STATE
  if (currentState === 'display') {
    if (isEditable) {
      return (
        <button
          type="button"
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={handleMouseLeave}
          onKeyDown={handleKeyDown}
          title={
            displayName
              ? `Named: ${displayName} (double-click or Ctrl+R to rename)`
              : 'Double-click or Ctrl+R to name this block'
          }
          style={getBadgeStyles()}
        >
          <span
            style={{
              ...VANTA_TYPOGRAPHY.preset.label,
              color: displayName ? accentColor : VANTA_COLORS.text.muted,
              fontFamily: 'var(--tmnl-font-mono)',
              fontSize: 'var(--tmnl-text-xs, 12px)',
              letterSpacing: '0.02em',
              fontStyle: displayName ? 'normal' : 'italic',
            }}
          >
            {displayName ? `@${displayName}` : 'unnamed'}
          </span>
        </button>
      );
    }

    // Non-editable display
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: VANTA_SPACING['1'],
          padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
          background: displayName ? accentBg : VANTA_COLORS.surface.hover,
          border: `1px solid ${
            displayName ? 'transparent' : VANTA_COLORS.surface.border
          }`,
          borderRadius: VANTA_BORDERS.radius.sm,
          opacity: displayName ? 1 : 0.6,
        }}
      >
        <span
          style={{
            ...VANTA_TYPOGRAPHY.preset.label,
            color: displayName ? accentColor : VANTA_COLORS.text.muted,
            fontFamily: 'var(--tmnl-font-mono)',
            fontSize: 'var(--tmnl-text-xs, 12px)',
            letterSpacing: '0.02em',
            fontStyle: displayName ? 'normal' : 'italic',
          }}
        >
          {displayName ? `@${displayName}` : 'unnamed'}
        </span>
      </div>
    );
  }

  // EDITING STATE
  if (currentState === 'editing') {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          borderRadius: VANTA_BORDERS.radius.sm,
          border: `1px solid ${VANTA_COLORS.accent.emerald}`,
          background: VANTA_COLORS.surface.default,
          overflow: 'hidden',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={state.context.inputValue}
          onChange={(e) => {
            send({ type: 'INPUT_CHANGE', value: e.target.value });
          }}
          onKeyDown={handleInputKeyDown}
          onBlur={handleBlur}
          placeholder="block-name"
          style={{
            width: '120px',
            padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: VANTA_COLORS.text.primary,
            fontFamily: 'var(--tmnl-font-mono)',
            fontSize: 'var(--tmnl-text-xs, 12px)',
            letterSpacing: '0.02em',
          }}
        />
      </div>
    );
  }

  // SUBMITTING STATE
  if (currentState === 'submitting') {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: VANTA_SPACING['1'],
          padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
          background: accentBg,
          border: `1px solid ${VANTA_COLORS.accent.emerald}`,
          borderRadius: VANTA_BORDERS.radius.sm,
        }}
      >
        <span
          style={{
            ...VANTA_TYPOGRAPHY.preset.label,
            color: accentColor,
            fontFamily: 'var(--tmnl-font-mono)',
            fontSize: 'var(--tmnl-text-xs, 12px)',
            letterSpacing: '0.02em',
          }}
        >
          @{state.context.inputValue.trim()}
        </span>
        <span
          style={{
            ...VANTA_TYPOGRAPHY.preset.label,
            color: VANTA_COLORS.text.muted,
            fontSize: 'var(--tmnl-text-xs, 12px)',
          }}
        >
          saving...
        </span>
      </div>
    );
  }

  // SUCCESS STATE
  if (currentState === 'success') {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: VANTA_SPACING['1'],
          padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
          background: VANTA_COLORS.accent.emerald,
          border: '1px solid transparent',
          borderRadius: VANTA_BORDERS.radius.sm,
        }}
      >
        <span
          style={{
            ...VANTA_TYPOGRAPHY.preset.label,
            color: VANTA_COLORS.surface.default,
            fontFamily: 'var(--tmnl-font-mono)',
            fontSize: 'var(--tmnl-text-xs, 12px)',
            letterSpacing: '0.02em',
          }}
        >
          @{displayName}
        </span>
      </div>
    );
  }

  // ERROR STATE
  if (currentState === 'error') {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: VANTA_SPACING['1'],
          padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
          background: VANTA_COLORS.surface.default,
          border: `1px solid ${VANTA_COLORS.accent.rose}`,
          borderRadius: VANTA_BORDERS.radius.sm,
        }}
      >
        <span
          style={{
            ...VANTA_TYPOGRAPHY.preset.label,
            color: VANTA_COLORS.accent.rose,
            fontSize: 'var(--tmnl-text-xs, 12px)',
          }}
        >
          {state.context.error || 'Rename failed'}
        </span>
        <button
          type="button"
          onClick={() => send({ type: 'RETRY' })}
          style={{
            padding: '2px 6px',
            background: 'transparent',
            border: `1px solid ${VANTA_COLORS.accent.rose}`,
            borderRadius: VANTA_BORDERS.radius.sm,
            color: VANTA_COLORS.accent.rose,
            fontSize: 'var(--tmnl-text-xs, 12px)',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Fallback (shouldn't reach here)
  return null;
}

export default BlockNameBadge;
