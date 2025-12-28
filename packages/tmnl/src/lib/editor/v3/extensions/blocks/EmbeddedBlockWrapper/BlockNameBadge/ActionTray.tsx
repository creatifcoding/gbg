/**
 * ActionTray Component
 *
 * Container for hover action buttons with staggered reveal animation.
 * Slides in from right on hover, exits faster than entry (asymmetric timing).
 *
 * Animation Spec (from STORYBOARD.md):
 * - Enter: 100ms per button, 40ms stagger, ease-out
 * - Exit: 50ms all buttons, ease-in
 *
 * @module editor/v3/extensions/blocks/BlockNameBadge/ActionTray
 */

import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { animate } from 'animejs';
import { Copy, Hash } from 'lucide-react';
import { ActionButton } from './ActionButton';
import { copyBlockName, copyBlockId } from './clipboard';
import type { BlockId } from '../shared';

// =============================================================================
// Types
// =============================================================================

export interface ActionTrayProps {
  /** Block ID for copy operation */
  blockId: BlockId;

  /** Current block name (null if unnamed) */
  name: string | null;

  /** Whether tray is visible */
  isVisible: boolean;

  /** Optional className */
  className?: string;
}

export interface ActionTrayHandle {
  /** Force show animation */
  animateIn: () => void;

  /** Force hide animation */
  animateOut: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const TIMING = {
  enterDuration: 100,
  exitDuration: 50,
  stagger: 40,
  translateDistance: 8,
  exitTranslate: 4,
} as const;

const STYLES = {
  container: {
    position: 'absolute' as const,
    right: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    gap: '6px',
    paddingLeft: '8px', // Space from name
  },
  button: {
    // Initial hidden state for animation
    opacity: 0,
    transform: `translateX(${TIMING.translateDistance}px)`,
  },
};

// =============================================================================
// ActionTray Component
// =============================================================================

export const ActionTray = forwardRef<ActionTrayHandle, ActionTrayProps>(
  function ActionTray({ blockId, name, isVisible, className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const button1Ref = useRef<HTMLButtonElement>(null);
    const button2Ref = useRef<HTMLButtonElement>(null);

    // ─────────────────────────────────────────────────────────────
    // Animation Functions
    // ─────────────────────────────────────────────────────────────

    const animateIn = () => {
      const buttons = [button1Ref.current, button2Ref.current].filter(Boolean);

      buttons.forEach((button, index) => {
        if (!button) return;

        animate(button, {
          opacity: [0, 1],
          translateX: [TIMING.translateDistance, 0],
          duration: TIMING.enterDuration,
          delay: index * TIMING.stagger,
          easing: 'easeOutQuad',
        });
      });
    };

    const animateOut = () => {
      const buttons = [button1Ref.current, button2Ref.current].filter(Boolean);

      buttons.forEach((button) => {
        if (!button) return;

        animate(button, {
          opacity: [1, 0],
          translateX: [0, TIMING.exitTranslate],
          duration: TIMING.exitDuration,
          easing: 'easeInQuad',
        });
      });
    };

    // Expose animation functions via ref
    useImperativeHandle(ref, () => ({
      animateIn,
      animateOut,
    }));

    // ─────────────────────────────────────────────────────────────
    // Visibility Effect
    // ─────────────────────────────────────────────────────────────

    useEffect(() => {
      if (isVisible) {
        animateIn();
      } else {
        animateOut();
      }
    }, [isVisible]);

    // ─────────────────────────────────────────────────────────────
    // Handlers
    // ─────────────────────────────────────────────────────────────

    const handleCopyName = async () => {
      await copyBlockName(name);
    };

    const handleCopyId = async () => {
      await copyBlockId(blockId);
    };

    // ─────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────

    // Always render but visually hidden initially (for animation)
    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          ...STYLES.container,
          pointerEvents: isVisible ? 'auto' : 'none',
        }}
      >
        <ActionButton
          ref={button1Ref}
          icon={Copy}
          onClick={handleCopyName}
          label="Copy block name"
          style={STYLES.button}
        />
        <ActionButton
          ref={button2Ref}
          icon={Hash}
          onClick={handleCopyId}
          label="Copy block ID"
          style={STYLES.button}
        />
      </div>
    );
  }
);

export default ActionTray;
