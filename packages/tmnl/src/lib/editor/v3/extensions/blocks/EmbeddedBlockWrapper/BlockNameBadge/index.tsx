/**
 * BlockNameBadge Component
 *
 * Inline-rename component with 5 states and choreographed animations.
 * Based on STORYBOARD.md specification.
 *
 * States: DISPLAY → EDITING → SUBMITTING → SUCCESS/ERROR
 *
 * @module editor/v3/extensions/blocks/BlockNameBadge
 */

import React, {
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useState,
  memo,
  forwardRef,
} from 'react';
import { useAtomValue, useAtom, Atom } from '@effect-atom/atom-react';

import { createBlockNameAtoms, getHoverAtom } from './atoms';
import * as animations from './animations';
import * as styles from './styles';
import { type BlockNameBadgeProps, type AnimationRefs, type BadgeState } from './types';
import { ErrorPopover } from './ErrorPopover';
import { ActionTray } from './ActionTray';
import type { BlockId } from '../shared';

// =============================================================================
// Checkmark SVG Component
// =============================================================================

const Checkmark = forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
  (props, ref) => (
    <svg
      ref={ref}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      style={styles.checkmarkStyle}
      {...props}
    >
      <path
        d="M2.5 7L5.5 10L11.5 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
);
Checkmark.displayName = 'Checkmark';

// =============================================================================
// BlockNameBadge Component
// =============================================================================

export const BlockNameBadge = memo(function BlockNameBadge({
  blockId,
  onRename,
  accentColor,
  accentBg,
}: BlockNameBadgeProps) {
  // ─────────────────────────────────────────────────────────────
  // Refs for Animation Targets
  // ─────────────────────────────────────────────────────────────

  const refs: AnimationRefs = {
    badgeRef: useRef<HTMLDivElement>(null),
    nameRef: useRef<HTMLSpanElement>(null),
    prefixRef: useRef<HTMLSpanElement>(null),
    underlineRef: useRef<HTMLDivElement>(null),
    caretRef: useRef<HTMLDivElement>(null),
    checkmarkRef: useRef<SVGSVGElement>(null),
    errorRef: useRef<HTMLDivElement>(null), // Legacy: unused, popover handles error display
    blockIdRef: useRef<HTMLSpanElement>(null),
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const prevStateRef = useRef<BadgeState>('display');
  const prevHasErrorRef = useRef<boolean>(false);

  // Double-click detection for ProseMirror compatibility
  const lastClickTimeRef = useRef<number>(0);
  const DOUBLE_CLICK_THRESHOLD = 300;

  // Hover debounce timer
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const HOVER_DELAY = 100; // ms before showing action tray

  // ─────────────────────────────────────────────────────────────
  // Atoms Setup
  // ─────────────────────────────────────────────────────────────

  const atoms = useMemo(
    () => createBlockNameAtoms(blockId),
    [blockId]
  );

  const hoverAtom = useMemo(
    () => getHoverAtom(blockId),
    [blockId]
  );

  // Subscribe to state (ErrorPopover handles error display)
  const state = useAtomValue(atoms.stateAtom);
  const inputValue = useAtomValue(atoms.inputValueAtom);
  const currentName = useAtomValue(atoms.currentNameAtom);
  const isEditable = useAtomValue(atoms.isEditableAtom);
  const hasError = useAtomValue(atoms.hasErrorAtom);
  const [isHovered, setIsHovered] = useAtom(hoverAtom);

  const { ops } = atoms;

  // ─────────────────────────────────────────────────────────────
  // Sync External State
  // ─────────────────────────────────────────────────────────────

  // Sync onRename handler
  useEffect(() => {
    ops.setOnRename(onRename);
  }, [onRename, ops]);

  // ─────────────────────────────────────────────────────────────
  // Error Underline Animation
  // ─────────────────────────────────────────────────────────────

  // Animate underline color when error appears/disappears during editing
  useEffect(() => {
    const prevHasError = prevHasErrorRef.current;

    if (state === 'editing') {
      if (!prevHasError && hasError) {
        // Error appeared → animate to rose + shake
        animations.animateUnderlineToError(refs.underlineRef);
        animations.animateErrorShake(refs);
      } else if (prevHasError && !hasError) {
        // Error cleared → animate back to cyan
        animations.animateUnderlineFromError(refs.underlineRef);
      }
    }

    prevHasErrorRef.current = hasError;
  }, [hasError, state]);

  // ─────────────────────────────────────────────────────────────
  // Cleanup on Unmount
  // ─────────────────────────────────────────────────────────────
  //
  // NOTE: We intentionally do NOT dispose the actor here.
  // React strict mode calls cleanup on "fake" unmount, but useMemo
  // returns the same cached atoms bundle on remount. If we dispose
  // the actor, those atoms point to a stopped actor.
  //
  // Actors persist in the module-level cache. They are only disposed
  // when the block is truly removed from the editor (via external
  // cleanup mechanism, not component lifecycle).
  //
  useEffect(() => {
    return () => {
      animations.cleanupAllAnimations();
      // Clear hover timer
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
      // Actor disposal moved to block deletion handler, not component unmount
    };
  }, [blockId]);

  // ─────────────────────────────────────────────────────────────
  // State Transition Animations
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const prev = prevStateRef.current;
    const next = state;

    if (prev === next) return;

    const runTransition = async () => {
      const transitionKey = `${prev}->${next}`;

      switch (transitionKey) {
        case 'display->editing':
          await animations.animateDisplayToEditing(refs);
          animations.startCaretPulse(refs.caretRef);
          // Focus and select input after animation
          setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
          }, 50);
          break;

        case 'editing->submitting':
          animations.stopCaretPulse(refs.caretRef);
          await animations.animateEditingToSubmitting(refs);
          break;

        case 'submitting->success':
          await animations.animateSubmittingToSuccess(refs);
          break;

        case 'success->display':
          await animations.animateSuccessToDisplay(refs);
          break;

        case 'editing->display':
          // Cancel - just cleanup
          animations.stopCaretPulse(refs.caretRef);
          animations.stopSubmittingShimmer(refs.underlineRef);
          animations.cleanupAllAnimations();
          break;

        case 'submitting->editing':
          // Submission failed, return to editing with error in context
          // Error popover handles display, just restart caret pulse
          animations.stopSubmittingShimmer(refs.underlineRef);
          animations.startCaretPulse(refs.caretRef);
          setTimeout(() => {
            inputRef.current?.focus();
          }, 50);
          break;

        default:
          // Unknown transition - just cleanup
          animations.cleanupAllAnimations();
      }
    };

    runTransition();
    prevStateRef.current = next;
  }, [state]);

  // ─────────────────────────────────────────────────────────────
  // Event Handlers
  // ─────────────────────────────────────────────────────────────

  /**
   * Handle double-click to enter editing.
   * Uses manual detection because ProseMirror eats onDoubleClick.
   */
  const handleMouseDown = useCallback(() => {
    const now = Date.now();
    const timeSinceLastClick = now - lastClickTimeRef.current;

    if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD && isEditable) {
      // Double-click detected
      ops.edit();
    }

    lastClickTimeRef.current = now;
  }, [isEditable, ops]);

  /**
   * Handle input changes during editing.
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      ops.inputChange(e.target.value);
    },
    [ops]
  );

  /**
   * Handle submit (Enter or blur).
   *
   * The state machine handles the full submission lifecycle:
   * - SUBMIT event triggers submitting state
   * - Machine invokes onRename via submitRename actor
   * - Success → success state → display
   * - Error → editing state with submissionError in context
   */
  const handleSubmit = useCallback(() => {
    // SUBMIT event handles all logic:
    // - Empty/unchanged → returns to display
    // - Has validation error → stays in editing
    // - Valid input → enters submitting, invokes onRename
    ops.submit();
  }, [ops]);

  /**
   * Handle keyboard events in input.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        ops.cancel();
      }
    },
    [handleSubmit, ops]
  );

  /**
   * Handle blur - submit if still editing.
   */
  const handleBlur = useCallback(() => {
    // Delay to allow click events to process first
    setTimeout(() => {
      if (state === 'editing') {
        handleSubmit();
      }
    }, 100);
  }, [state, handleSubmit]);

  /**
   * Handle pointer enter with debounce (prevents flicker).
   */
  const handlePointerEnter = useCallback(() => {
    // Don't show action tray during editing/submitting/success
    if (state !== 'display') return;

    // Clear any existing timer
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }

    // Debounce to prevent flicker
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(true);
    }, HOVER_DELAY);
  }, [state, setIsHovered]);

  /**
   * Handle pointer leave.
   */
  const handlePointerLeave = useCallback(() => {
    // Clear pending hover timer
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }

    setIsHovered(false);
  }, [setIsHovered]);

  // ─────────────────────────────────────────────────────────────
  // Derived Values
  // ─────────────────────────────────────────────────────────────

  const displayName = currentName || 'untitled';
  const hasName = !!currentName;
  const shortBlockId = blockId.slice(0, 10);

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* Inject keyframe animations */}
      <style>{styles.allKeyframes}</style>

      {/*
        CSS Grid Container
        - col-1: Name column (triggers hover)
        - col-2: Actions column (visible on hover)

        Hitbox expansion logic:
        - IDLE: only name-column has pointer-events
        - HOVERED: entire container captures pointer-events
      */}
      <div
        ref={refs.badgeRef}
        style={{
          ...styles.badgeContainerStyle,
          // When hovered, container captures all pointer events (expanded hitbox)
          pointerEvents: isHovered ? 'auto' : 'none',
        }}
        data-badge-state={state}
        data-hovered={isHovered}
        onPointerLeave={handlePointerLeave}
      >
        {/* ═══════════════════════════════════════════════════════════════
            NAME COLUMN — Grid col-1, triggers hover
            ═══════════════════════════════════════════════════════════════ */}
        <div
          style={{
            ...styles.nameColumnStyle,
            // Name column always captures pointer (hover trigger zone)
            pointerEvents: 'auto',
          }}
          onPointerEnter={handlePointerEnter}
        >
          {/* Name Row */}
          <div style={styles.nameRowStyle}>
            {/* "@" prefix - visible in display, success; hidden in editing */}
            {state !== 'editing' && state !== 'submitting' && (
              <span
                ref={refs.prefixRef}
                style={{
                  ...styles.prefixStyle,
                  opacity: state === 'success' ? 0 : styles.prefixStyle.opacity,
                }}
              >
                @
              </span>
            )}

            {/* Caret - visible during editing */}
            {state === 'editing' && (
              <div ref={refs.caretRef} style={styles.caretStyle} />
            )}

            {/* Content based on state */}
            {state === 'editing' ? (
              // Input field
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                placeholder="block-name"
                style={styles.inputStyle}
                autoComplete="off"
                spellCheck={false}
              />
            ) : state === 'success' ? (
              // Checkmark
              <Checkmark ref={refs.checkmarkRef} />
            ) : (
              // Name display (display, submitting)
              <span
                ref={refs.nameRef}
                style={styles.getNameStyle(hasName, state)}
                onMouseDown={isEditable ? handleMouseDown : undefined}
                title={isEditable ? 'Double-click to rename' : undefined}
              >
                {state === 'submitting' ? inputValue : displayName}
              </span>
            )}
          </div>

          {/* Underline */}
          <div
            ref={refs.underlineRef}
            style={styles.getUnderlineStyle(state)}
          />

          {/* Block ID */}
          <span ref={refs.blockIdRef} style={styles.blockIdStyle}>
            {shortBlockId}
          </span>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            ACTIONS COLUMN — Grid col-2, visible on hover
            ═══════════════════════════════════════════════════════════════ */}
        {state === 'display' && (
          <div
            style={
              isHovered
                ? styles.actionsColumnVisibleStyle
                : styles.actionsColumnHiddenStyle
            }
          >
            <ActionTray
              blockId={blockId}
              name={currentName}
              isVisible={isHovered}
            />
          </div>
        )}
      </div>

      {/* Error Popover — atoms-as-state, derives open/error from machine */}
      <ErrorPopover
        blockId={blockId}
        referenceElement={refs.badgeRef.current}
      />
    </>
  );
});

// =============================================================================
// Exports
// =============================================================================

export default BlockNameBadge;
export type { BlockNameBadgeProps } from './types';
export { createBlockNameAtoms, disposeBlockNameActor } from './atoms';
