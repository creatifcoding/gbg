/**
 * BlockNameBadge Component
 *
 * TMNL aesthetic: typographic, minimal, premium microinteractions.
 * XState for state management, animejs for animations.
 */
import {
  useRef,
  useMemo,
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent,
  type FocusEvent,
} from 'react';
import { animate } from 'animejs';
import { Option } from 'effect';
import { Atom } from '@effect-atom/atom';
import { useAtom, useAtomValue } from '@effect-atom/atom-react';
import { useMachine } from '@xstate/react';
import { Switch } from '@legendapp/state/react';

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

interface BlockNameBadgeProps {
  blockId: BlockId;
  onRename?: (newName: string) => Promise<void>;
  accentColor?: string;
  accentBg?: string;
}

export function BlockNameBadge({
  blockId,
  onRename,
  accentColor = VANTA_COLORS.text.muted,
  accentBg = 'rgba(255, 255, 255, 0.03)',
}: BlockNameBadgeProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const underlineRef = useRef<HTMLDivElement>(null);

  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const blockRef = useAtomValue(blockByIdAtom(blockId));
  const renameError = useAtomValue(renameErrorAtom);
  const isRenaming = useAtomValue(isRenamingAtom);

  const isThisBlockRenaming =
    Option.isSome(isRenaming) && isRenaming.value === blockId;

  const name = Option.isSome(blockRef) ? blockRef.value.name : Option.none();
  const displayName = Option.isSome(name) ? name.value : null;

  const [state, send] = useMachine(blockNameMachine, {
    input: {
      blockId,
      currentName: displayName,
      inputValue: '',
      error: null,
      onRename,
    } satisfies BlockNameMachineContext,
  });

  const machineStateAtom = useMemo(
    () => Atom.make<string>(state.value as string),
    []
  );
  const [currentMachineState, setMachineState] = useAtom(machineStateAtom);

  useEffect(() => {
    setMachineState(state.value as string);
  }, [state.value, setMachineState]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ANIMATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const animateSuccess = useCallback(() => {
    if (!badgeRef.current) return;
    animate(badgeRef.current, {
      scale: [1, 1.05, 1],
      opacity: [1, 0.8, 1],
      duration: 300,
      easing: 'easeOutCubic',
    });
  }, []);

  const animateError = useCallback(() => {
    if (!badgeRef.current) return;
    animate(badgeRef.current, {
      translateX: [0, -3, 3, -2, 2, 0],
      duration: 300,
      easing: 'easeOutCubic',
    });
  }, []);

  const animateEditIn = useCallback(() => {
    if (!badgeRef.current) return;
    animate(badgeRef.current, {
      scale: [0.95, 1],
      opacity: [0.7, 1],
      duration: 200,
      easing: 'easeOutCubic',
    });
  }, []);

  const animatePulse = useCallback(() => {
    if (!underlineRef.current) return;
    animate(underlineRef.current, {
      scaleX: [0, 1],
      opacity: [0.5, 1, 0.5],
      duration: 1200,
      easing: 'easeInOutSine',
      loop: true,
    });
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    send({ type: 'SET_NAME', name: displayName });
  }, [displayName, send]);

  useEffect(() => {
    send({ type: 'SET_ON_RENAME', handler: onRename });
  }, [onRename, send]);

  useEffect(() => {
    if (state.matches('editing') && inputRef.current) {
      animateEditIn();
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [state, animateEditIn]);

  useEffect(() => {
    if (state.matches('submitting')) {
      animatePulse();
    }
  }, [state, animatePulse]);

  useEffect(() => {
    if (state.matches('success')) {
      animateSuccess();
      const timer = setTimeout(() => send({ type: 'RESET' }), 600);
      return () => clearTimeout(timer);
    }
  }, [state, animateSuccess, send]);

  useEffect(() => {
    if (state.matches('error')) {
      animateError();
    }
  }, [state, animateError]);

  useEffect(() => {
    if (
      Option.isSome(renameError) &&
      isThisBlockRenaming &&
      state.matches('editing')
    ) {
      animateError();
    }
  }, [renameError, isThisBlockRenaming, state, animateError]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleSubmit = useCallback(async () => {
    send({ type: 'SUBMIT' });

    if (state.context.onRename && state.context.inputValue.trim()) {
      try {
        await state.context.onRename(state.context.inputValue.trim());
        send({ type: 'SUCCESS' });
      } catch (err) {
        send({
          type: 'ERROR',
          error: err instanceof Error ? err.message : 'Rename failed',
        });
      }
    }
  }, [send, state.context]);

  const handleKeyDown = useCallback(
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
      handleSubmit();
    },
    [handleSubmit]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      send({ type: 'EDIT' });
    },
    [send]
  );

  const handleBadgeKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        send({ type: 'EDIT' });
      }
    },
    [send]
  );

  const isEditable = !!state.context.onRename;
  const hasError = state.context.error !== null || Option.isSome(renameError);

  // ═══════════════════════════════════════════════════════════════════════════
  // STYLES
  // ═══════════════════════════════════════════════════════════════════════════

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    fontFamily: 'var(--tmnl-font-mono)',
    fontSize: 'var(--tmnl-text-xs, 12px)',
    letterSpacing: '0.04em',
    textTransform: 'lowercase',
    borderRadius: '3px',
    transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
  };

  return (
    <Switch value={currentMachineState}>
      {{
        editing: () => (
          <div
            ref={badgeRef}
            style={{
              ...baseStyle,
              position: 'relative',
              background: 'rgba(0, 0, 0, 0.4)',
              border: `1px solid ${VANTA_COLORS.accent.cyan}`,
              boxShadow: `0 0 0 1px ${VANTA_COLORS.accent.cyan}20, inset 0 1px 2px rgba(0,0,0,0.3)`,
              overflow: 'hidden',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={state.context.inputValue}
              onChange={(e) =>
                send({ type: 'INPUT_CHANGE', value: e.target.value })
              }
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder="block-name"
              style={{
                width: '110px',
                padding: '4px 8px',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: VANTA_COLORS.text.primary,
                fontFamily: 'inherit',
                fontSize: 'inherit',
                letterSpacing: 'inherit',
                caretColor: VANTA_COLORS.accent.cyan,
              }}
            />
            <div
              ref={underlineRef}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '1px',
                background: `linear-gradient(90deg, transparent, ${VANTA_COLORS.accent.cyan}, transparent)`,
                transformOrigin: 'center',
              }}
            />
          </div>
        ),

        submitting: () => (
          <div
            ref={badgeRef}
            style={{
              ...baseStyle,
              position: 'relative',
              padding: '4px 10px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: VANTA_COLORS.text.muted,
              overflow: 'hidden',
            }}
          >
            <span style={{ opacity: 0.6 }}>
              @{state.context.inputValue.trim()}
            </span>
            <div
              ref={underlineRef}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: '100%',
                height: '1px',
                background: `linear-gradient(90deg, transparent, ${VANTA_COLORS.accent.cyan}, transparent)`,
              }}
            />
          </div>
        ),

        success: () => (
          <div
            ref={badgeRef}
            style={{
              ...baseStyle,
              padding: '4px 10px',
              background: `${VANTA_COLORS.accent.emerald}15`,
              border: `1px solid ${VANTA_COLORS.accent.emerald}40`,
              color: VANTA_COLORS.accent.emerald,
              boxShadow: `0 0 8px ${VANTA_COLORS.accent.emerald}20`,
            }}
          >
            <span>@{displayName}</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              style={{ marginLeft: '6px' }}
            >
              <path
                d="M2 6L5 9L10 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        ),

        error: () => (
          <div
            ref={badgeRef}
            style={{
              ...baseStyle,
              padding: '4px 10px',
              background: `${VANTA_COLORS.accent.rose}10`,
              border: `1px solid ${VANTA_COLORS.accent.rose}50`,
              color: VANTA_COLORS.accent.rose,
            }}
          >
            <span style={{ fontSize: '11px' }}>
              {state.context.error || 'failed'}
            </span>
          </div>
        ),

        display: () => (
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            {isEditable && (
              <button
                type="button"
                onDoubleClick={handleDoubleClick}
                onKeyDown={handleBadgeKeyDown}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => {
                  setIsHovered(false);
                  setIsPressed(false);
                }}
                onMouseDown={() => setIsPressed(true)}
                onMouseUp={() => setIsPressed(false)}
                title={
                  displayName
                    ? `@${displayName} — double-click to rename`
                    : 'double-click to name'
                }
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'text',
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  margin: 0,
                  zIndex: 1,
                }}
              />
            )}
            <div
              ref={badgeRef}
              style={{
                ...baseStyle,
                padding: '4px 10px',
                background: isHovered
                  ? 'rgba(255, 255, 255, 0.06)'
                  : displayName
                  ? accentBg
                  : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${
                  isHovered
                    ? 'rgba(255, 255, 255, 0.15)'
                    : 'rgba(255, 255, 255, 0.06)'
                }`,
                color: displayName
                  ? isHovered
                    ? VANTA_COLORS.text.primary
                    : accentColor
                  : VANTA_COLORS.text.muted,
                transform: isPressed ? 'scale(0.98)' : 'scale(1)',
                opacity: displayName ? 1 : 0.5,
                cursor: isEditable ? 'text' : 'default',
              }}
            >
              {displayName ? (
                <span>@{displayName}</span>
              ) : (
                <span style={{ fontStyle: 'italic', opacity: 0.7 }}>
                  unnamed
                </span>
              )}
            </div>
          </div>
        ),
      }}
    </Switch>
  );
}

export default BlockNameBadge;
