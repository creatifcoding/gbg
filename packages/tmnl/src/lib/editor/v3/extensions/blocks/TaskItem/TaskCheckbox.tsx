/**
 * TaskCheckbox Component
 *
 * Animated checkbox with iridescent sheen effect.
 * Uses XState for state management, anime.js for animations.
 *
 * Animation Scene (ASCII):
 * ┌──────────────────────────────────────────────────────────────┐
 * │  Frame 0: IDLE                                                │
 * │  ┌──┐  Task item text                                        │
 * │  └──┘                                                         │
 * │                                                                │
 * │  Frame 1-3: HOVER/FOCUS → Sheen sweep                        │
 * │  ░░┌──┐░░ → ┌░░┐░░ → ┌──┐░░                                  │
 * │                                                                │
 * │  Frame 4: TOGGLE → Sparkle burst                              │
 * │  ┌✓ ┐ ✧ ✦                                                     │
 * │  └──┘ ✧                                                        │
 * │                                                                │
 * │  Frame 5: CHECKED → Subtle glow                               │
 * │  ┌✓ ┐  T̶a̶s̶k̶ ̶c̶o̶m̶p̶l̶e̶t̶e̶                                         │
 * └──────────────────────────────────────────────────────────────┘
 *
 * @module editor/v3/extensions/blocks/TaskItem/TaskCheckbox
 */

import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useMachine } from '@xstate/react';
import { animate, createTimeline, stagger } from 'animejs';

import { taskCheckboxMachine } from './machine';
import {
  checkboxWrapperStyle,
  checkboxInputStyle,
  checkboxVisualStyle,
  checkboxVisualHoverStyle,
  checkboxVisualCheckedStyle,
  checkmarkStyle,
  checkmarkVisibleStyle,
  sparkleContainerStyle,
  sparkleStyle,
  sheenOverlayStyle,
  glowOverlayStyle,
  CHECKBOX_TIMING,
} from './styles';

// =============================================================================
// Types
// =============================================================================

interface TaskCheckboxProps {
  /** Current checked state */
  checked: boolean;
  /** Callback when checkbox is toggled */
  onToggle: (checked: boolean) => void;
  /** Whether checkbox is disabled */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function TaskCheckbox({
  checked,
  onToggle,
  disabled = false,
  className,
}: TaskCheckboxProps) {
  const wrapperRef = useRef<HTMLLabelElement>(null);
  const sheenRef = useRef<HTMLSpanElement>(null);
  const sparkleContainerRef = useRef<HTMLDivElement>(null);

  const [state, send] = useMachine(taskCheckboxMachine, {
    input: { checked },
  });

  // Sync external checked state with machine
  useEffect(() => {
    if (state.context.checked !== checked) {
      send({ type: 'SET_CHECKED', checked });
    }
  }, [checked, send, state.context.checked]);

  // ==========================================================================
  // Sheen Animation (anime.js)
  // ==========================================================================

  useEffect(() => {
    if (!state.context.sheenActive || !sheenRef.current) return;

    const sheen = sheenRef.current;

    // Animate sheen gradient position: -100% → 200%
    const animation = animate(sheen, {
      backgroundPosition: ['-100% 0', '200% 0'],
      duration: CHECKBOX_TIMING.sheenDuration,
      easing: CHECKBOX_TIMING.sheenEase,
      complete: () => {
        send({ type: 'SHEEN_END' });
      },
    });

    return () => {
      animation.pause();
    };
  }, [state.context.sheenActive, send]);

  // ==========================================================================
  // Sparkle Burst Animation (anime.js)
  // ==========================================================================

  useEffect(() => {
    if (!state.context.sparkleActive || !sparkleContainerRef.current) return;

    const container = sparkleContainerRef.current;

    // Clear existing sparkles
    container.innerHTML = '';

    // Create sparkle particles
    const sparkleCount = 8;
    const sparkles: HTMLDivElement[] = [];

    for (let i = 0; i < sparkleCount; i++) {
      const sparkle = document.createElement('div');
      Object.assign(sparkle.style, sparkleStyle);
      sparkle.style.left = '50%';
      sparkle.style.top = '50%';
      sparkle.style.opacity = '1';
      container.appendChild(sparkle);
      sparkles.push(sparkle);
    }

    // Animate sparkles outward
    const tl = createTimeline({
      autoplay: true,
    });

    sparkles.forEach((sparkle, i) => {
      const angle = (i / sparkleCount) * Math.PI * 2;
      const distance = 16 + Math.random() * 8;
      const endX = Math.cos(angle) * distance;
      const endY = Math.sin(angle) * distance;

      tl.add(sparkle, {
        translateX: [0, endX],
        translateY: [0, endY],
        opacity: [1, 0],
        scale: [1, 0.3],
        duration: CHECKBOX_TIMING.sparkleDuration,
        easing: 'easeOutQuad',
      }, stagger(20, { start: 0 })[i]);
    });

    // Cleanup after animation
    const timeout = setTimeout(() => {
      send({ type: 'SPARKLE_END' });
    }, CHECKBOX_TIMING.sparkleDuration + 100);

    return () => {
      clearTimeout(timeout);
      tl.pause();
    };
  }, [state.context.sparkleActive, send]);

  // ==========================================================================
  // Event Handlers
  // ==========================================================================

  const handleMouseEnter = useCallback(() => {
    if (!disabled) send({ type: 'HOVER' });
  }, [disabled, send]);

  const handleMouseLeave = useCallback(() => {
    if (!disabled) send({ type: 'LEAVE' });
  }, [disabled, send]);

  const handleFocus = useCallback(() => {
    if (!disabled) send({ type: 'FOCUS' });
  }, [disabled, send]);

  const handleBlur = useCallback(() => {
    if (!disabled) send({ type: 'BLUR' });
  }, [disabled, send]);

  const handleChange = useCallback(() => {
    if (disabled) return;

    send({ type: 'TOGGLE' });
    onToggle(!state.context.checked);
  }, [disabled, send, onToggle, state.context.checked]);

  // ==========================================================================
  // Computed Styles
  // ==========================================================================

  const isHovering = state.value === 'hovering' || state.value === 'focused';
  const isChecked = state.context.checked;
  const isToggling = state.value === 'toggling';

  const visualStyle = useMemo(() => ({
    ...checkboxVisualStyle,
    ...(isHovering ? checkboxVisualHoverStyle : {}),
    ...(isChecked ? checkboxVisualCheckedStyle : {}),
    ...(isToggling ? { transform: `scale(${CHECKBOX_TIMING.checkScale})` } : {}),
  }), [isHovering, isChecked, isToggling]);

  const checkStyle = useMemo(() => ({
    ...checkmarkStyle,
    ...(isChecked ? checkmarkVisibleStyle : {}),
  }), [isChecked]);

  const sheenStyle = useMemo(() => ({
    ...sheenOverlayStyle,
    opacity: state.context.sheenActive ? 1 : 0,
  }), [state.context.sheenActive]);

  const glowStyle = useMemo(() => ({
    ...glowOverlayStyle,
    opacity: isChecked ? 1 : 0,
  }), [isChecked]);

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <label
      ref={wrapperRef}
      className={className}
      style={checkboxWrapperStyle}
      data-state={state.value}
      data-checked={isChecked}
      data-sheen={state.context.sheenActive}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Sheen overlay */}
      <span ref={sheenRef} style={sheenStyle} />

      {/* Glow overlay */}
      <span style={glowStyle} />

      {/* Native checkbox (hidden, for accessibility) */}
      <input
        type="checkbox"
        style={checkboxInputStyle}
        checked={isChecked}
        disabled={disabled}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />

      {/* Custom visual checkbox */}
      <span style={visualStyle}>
        {/* Check mark SVG */}
        <svg viewBox="0 0 12 12" aria-hidden="true" style={checkStyle}>
          <polyline points="2,6 5,9 10,3" />
        </svg>
      </span>

      {/* Sparkle burst container */}
      <div ref={sparkleContainerRef} style={sparkleContainerStyle} />
    </label>
  );
}

export default TaskCheckbox;
