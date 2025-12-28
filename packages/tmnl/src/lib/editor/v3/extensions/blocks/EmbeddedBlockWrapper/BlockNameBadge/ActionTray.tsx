/**
 * ActionTray Component
 *
 * Container for hover action buttons with staggered reveal animation.
 * Features:
 * - Slides in from right on hover (asymmetric timing)
 * - Greenify flash: container-level success feedback
 * - SVG checkmark with stroke path animation
 *
 * @module editor/v3/extensions/blocks/BlockNameBadge/ActionTray
 */

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { animate } from 'animejs';
import { Copy, Hash } from 'lucide-react';
import { ActionButton } from './ActionButton';
import { copyBlockName, copyBlockId } from './clipboard';
import { COLORS } from './constants';
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
  stagger: 30,
  translateDistance: 6,
  exitTranslate: 3,
  successHold: 500,
  greenifyDuration: 100,
  checkmarkDraw: 200,
} as const;

const COLORS_GREENIFY = {
  border: COLORS.underlineEmerald,
  fill: 'rgba(52, 211, 153, 0.12)',
  fillTransparent: 'rgba(52, 211, 153, 0)',
};

const STYLES = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 4px',
    borderRadius: '10px',
    border: '1px solid transparent',
    background: 'transparent',
    transition: 'none', // Controlled by anime.js
  } as React.CSSProperties,
  button: {
    opacity: 0,
    transform: `translateX(${TIMING.translateDistance}px)`,
  } as React.CSSProperties,
  checkmarkContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px', // Same width as 2 buttons + gap
    height: '16px',
  } as React.CSSProperties,
};

// =============================================================================
// Animated Checkmark Component (SVG Path Animation)
// =============================================================================

interface AnimatedCheckmarkProps {
  onComplete?: () => void;
}

const AnimatedCheckmark = forwardRef<SVGSVGElement, AnimatedCheckmarkProps>(
  function AnimatedCheckmark({ onComplete }, ref) {
    const pathRef = useRef<SVGPathElement>(null);

    useEffect(() => {
      if (!pathRef.current) return;

      // Get path length for stroke animation
      const pathLength = pathRef.current.getTotalLength();

      // Set initial state (hidden)
      pathRef.current.style.strokeDasharray = `${pathLength}`;
      pathRef.current.style.strokeDashoffset = `${pathLength}`;

      // Animate stroke drawing
      animate(pathRef.current, {
        strokeDashoffset: [pathLength, 0],
        duration: TIMING.checkmarkDraw,
        easing: 'easeOutQuad',
        complete: onComplete,
      });
    }, [onComplete]);

    return (
      <svg
        ref={ref}
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        style={{ overflow: 'visible' }}
      >
        <path
          ref={pathRef}
          d="M2 6L5 9L10 3"
          stroke={COLORS.underlineEmerald}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }
);

// =============================================================================
// ActionTray Component
// =============================================================================

export const ActionTray = forwardRef<ActionTrayHandle, ActionTrayProps>(
  function ActionTray({ blockId, name, isVisible, className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const button1Ref = useRef<HTMLButtonElement>(null);
    const button2Ref = useRef<HTMLButtonElement>(null);

    const [showSuccess, setShowSuccess] = useState(false);

    // ─────────────────────────────────────────────────────────────
    // Animation Functions
    // ─────────────────────────────────────────────────────────────

    const animateIn = useCallback(() => {
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
    }, []);

    const animateOut = useCallback(() => {
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
    }, []);

    /**
     * Greenify flash animation — container-level success feedback
     */
    const animateGreenify = useCallback(() => {
      if (!containerRef.current) return;

      // Animate container border and background
      animate(containerRef.current, {
        borderColor: ['transparent', COLORS_GREENIFY.border],
        backgroundColor: [COLORS_GREENIFY.fillTransparent, COLORS_GREENIFY.fill],
        duration: TIMING.greenifyDuration,
        easing: 'easeOutQuad',
      });
    }, []);

    /**
     * Reset from greenify state
     */
    const animateGreenifyOut = useCallback(() => {
      if (!containerRef.current) return;

      animate(containerRef.current, {
        borderColor: [COLORS_GREENIFY.border, 'transparent'],
        backgroundColor: [COLORS_GREENIFY.fill, COLORS_GREENIFY.fillTransparent],
        duration: TIMING.greenifyDuration * 1.5,
        easing: 'easeInQuad',
      });
    }, []);

    // Expose animation functions via ref
    useImperativeHandle(ref, () => ({
      animateIn,
      animateOut,
    }));

    // ─────────────────────────────────────────────────────────────
    // Visibility Effect
    // ─────────────────────────────────────────────────────────────

    useEffect(() => {
      if (isVisible && !showSuccess) {
        animateIn();
      } else if (!isVisible && !showSuccess) {
        animateOut();
      }
    }, [isVisible, showSuccess, animateIn, animateOut]);

    // ─────────────────────────────────────────────────────────────
    // Success Handler (shared by both buttons)
    // ─────────────────────────────────────────────────────────────

    const triggerSuccess = useCallback(async (copyFn: () => Promise<void>) => {
      try {
        await copyFn();

        // Show success state
        setShowSuccess(true);
        animateGreenify();

        // Hold success state, then reset
        setTimeout(() => {
          animateGreenifyOut();
          setTimeout(() => {
            setShowSuccess(false);
          }, TIMING.greenifyDuration * 1.5);
        }, TIMING.successHold);
      } catch (err) {
        console.error('Copy failed:', err);
      }
    }, [animateGreenify, animateGreenifyOut]);

    // ─────────────────────────────────────────────────────────────
    // Handlers
    // ─────────────────────────────────────────────────────────────

    const handleCopyName = useCallback(async () => {
      await triggerSuccess(() => copyBlockName(name));
    }, [name, triggerSuccess]);

    const handleCopyId = useCallback(async () => {
      await triggerSuccess(() => copyBlockId(blockId));
    }, [blockId, triggerSuccess]);

    // ─────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          ...STYLES.container,
          pointerEvents: isVisible ? 'auto' : 'none',
        }}
      >
        {showSuccess ? (
          // Success state: show animated checkmark
          <div style={STYLES.checkmarkContainer}>
            <AnimatedCheckmark />
          </div>
        ) : (
          // Normal state: show action buttons
          <>
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
          </>
        )}
      </div>
    );
  }
);

export default ActionTray;
