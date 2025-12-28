/**
 * ErrorPopover Component
 *
 * Floating UI-based error popover with "soft" variant styling.
 * Shows parsed error with retry action.
 *
 * Follows atoms-as-state doctrine: derives open state and error
 * directly from the block's state machine atoms.
 *
 * @module editor/v3/extensions/blocks/BlockNameBadge/ErrorPopover
 */

import React, { useRef, useMemo } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  arrow,
  FloatingPortal,
  FloatingArrow,
  useDismiss,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { TYPOGRAPHY } from './constants';
import { createBlockNameAtoms } from './atoms';
import { parseError, type ParsedError } from './types';
import type { BlockId } from '../shared';

// =============================================================================
// Types
// =============================================================================

export interface ErrorPopoverProps {
  /** Block ID to derive state from */
  blockId: BlockId;
  /** Reference element for positioning */
  referenceElement: HTMLElement | null;
}

// =============================================================================
// Styles — "Soft" Variant
// =============================================================================

const SOFT_ROSE = {
  bg: 'rgba(244, 63, 94, 0.12)',
  border: 'rgba(244, 63, 94, 0.3)',
  text: '#f43f5e',
  muted: 'rgba(255, 255, 255, 0.6)',
  hint: 'rgba(255, 255, 255, 0.4)',
};

// =============================================================================
// ErrorPopover Component
// =============================================================================

export function ErrorPopover({ blockId, referenceElement }: ErrorPopoverProps) {
  const arrowRef = useRef<SVGSVGElement>(null);

  // ─────────────────────────────────────────────────────────────
  // Atoms-as-State: Derive all state from block's machine
  // ─────────────────────────────────────────────────────────────

  const atoms = useMemo(() => createBlockNameAtoms(blockId), [blockId]);

  const state = useAtomValue(atoms.stateAtom);
  const error = useAtomValue(atoms.errorAtom);

  // Derived: popover is open when editing AND error exists
  // Error shown as live feedback during editing, auto-dismisses when error clears
  const isOpen = state === 'editing' && error !== null;

  // Parse the error for structured display
  const parsed: ParsedError = error ? parseError(error) : { title: 'Error', message: '' };

  // FloatingUI setup
  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: () => {
      // No explicit dismiss action needed — popover auto-closes when
      // user types (clears validation error) or cancels editing
    },
    placement: 'bottom-start',
    middleware: [
      offset(8),
      flip({ fallbackAxisSideDirection: 'start' }),
      shift({ padding: 8 }),
      arrow({ element: arrowRef }),
    ],
    whileElementsMounted: autoUpdate,
    elements: {
      reference: referenceElement,
    },
  });

  // Interactions
  const dismiss = useDismiss(context, {
    escapeKey: true,
    outsidePress: true,
  });
  const role = useRole(context, { role: 'alert' });

  const { getFloatingProps } = useInteractions([dismiss, role]);

  if (!isOpen) return null;

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        style={{
          ...floatingStyles,
          zIndex: 9999,
        }}
        {...getFloatingProps()}
      >
        {/* Popover Content */}
        <div
          style={{
            backgroundColor: SOFT_ROSE.bg,
            border: `1px solid ${SOFT_ROSE.border}`,
            borderRadius: '8px',
            boxShadow: `0 4px 16px rgba(0, 0, 0, 0.3), 0 0 0 1px ${SOFT_ROSE.border}`,
            padding: '10px 14px',
            minWidth: '180px',
            maxWidth: '300px',
            fontFamily: TYPOGRAPHY.name.fontFamily,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '6px',
            }}
          >
            {/* Error icon */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              style={{ color: SOFT_ROSE.text, flexShrink: 0 }}
            >
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7 4V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="7" cy="10" r="0.75" fill="currentColor" />
            </svg>
            {/* Title */}
            <span
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: SOFT_ROSE.text,
                letterSpacing: '-0.01em',
              }}
            >
              {parsed.title}
            </span>
            {/* Code badge (if present) */}
            {parsed.code && (
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: TYPOGRAPHY.blockId.fontFamily,
                  color: SOFT_ROSE.muted,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  marginLeft: 'auto',
                }}
              >
                {parsed.code}
              </span>
            )}
          </div>

          {/* Message */}
          <p
            style={{
              fontSize: '12px',
              fontFamily: TYPOGRAPHY.blockId.fontFamily,
              color: SOFT_ROSE.muted,
              lineHeight: 1.4,
              margin: 0,
              wordBreak: 'break-word',
            }}
          >
            {parsed.message}
          </p>
        </div>

        {/* Arrow */}
        <FloatingArrow
          ref={arrowRef}
          context={context}
          fill={SOFT_ROSE.bg}
          stroke={SOFT_ROSE.border}
          strokeWidth={1}
          width={12}
          height={6}
        />
      </div>
    </FloatingPortal>
  );
}

export default ErrorPopover;
