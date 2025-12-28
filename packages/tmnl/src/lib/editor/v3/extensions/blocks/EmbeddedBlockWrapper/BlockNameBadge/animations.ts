/**
 * BlockNameBadge Animations
 *
 * Raw anime.js animation functions for state transitions.
 * Each function targets specific refs and matches STORYBOARD.md timing.
 *
 * @module editor/v3/extensions/blocks/BlockNameBadge/animations
 */

import { animate, createTimeline, type JSAnimation } from 'animejs';
import { TIMING, EASING, COLORS, GEOMETRY } from './constants';
import type { AnimationRefs } from './types';

// =============================================================================
// Animation Tracking
// =============================================================================

/**
 * Track active animations for cleanup.
 * Keyed by animation name for targeted stopping.
 */
const activeAnimations = new Map<string, JSAnimation>();

/**
 * Stop a specific animation by key.
 */
const stopAnimation = (key: string): void => {
  const anim = activeAnimations.get(key);
  if (anim) {
    anim.pause();
    activeAnimations.delete(key);
  }
};

/**
 * Track an animation for later cleanup.
 */
const trackAnimation = (key: string, anim: JSAnimation): void => {
  stopAnimation(key); // Stop existing first
  activeAnimations.set(key, anim);
};

// =============================================================================
// TRANSITION: DISPLAY → EDITING (150ms)
// =============================================================================

/**
 * Animate from display to editing state.
 *
 * - "@" prefix fades out (80ms)
 * - Caret fades in (80ms, crossfade with prefix)
 * - Underline intensifies: muted → cyan (150ms)
 * - Name text holds position (no animation)
 */
export const animateDisplayToEditing = (refs: AnimationRefs): Promise<void> => {
  return new Promise((resolve) => {
    const { prefixRef, caretRef, underlineRef } = refs;

    // 1. "@" prefix fades out
    if (prefixRef.current) {
      animate(prefixRef.current, {
        opacity: [COLORS.prefixOpacity, 0],
        duration: TIMING.prefixFadeOut,
        easing: EASING.out,
      });
    }

    // 2. Caret fades in (crossfade with prefix)
    if (caretRef.current) {
      animate(caretRef.current, {
        opacity: [0, 1],
        duration: TIMING.caretFadeIn,
        delay: TIMING.caretFadeInDelay,
        easing: EASING.out,
      });
    }

    // 3. Underline intensifies
    if (underlineRef.current) {
      const anim = animate(underlineRef.current, {
        backgroundColor: [COLORS.underlineMuted, COLORS.underlineCyan],
        opacity: [0.3, 1],
        duration: TIMING.displayToEditing,
        easing: EASING.out,
        onComplete: () => resolve(),
      });
      trackAnimation('underline-intensify', anim);
    } else {
      resolve();
    }
  });
};

// =============================================================================
// TRANSITION: EDITING → SUBMITTING (100ms)
// =============================================================================

/**
 * Animate from editing to submitting state.
 *
 * - Caret fades out (100ms)
 * - Text dims slightly to 80% opacity (100ms)
 * - Shimmer animation starts (CSS class)
 */
export const animateEditingToSubmitting = (refs: AnimationRefs): Promise<void> => {
  return new Promise((resolve) => {
    const { caretRef, nameRef, underlineRef } = refs;

    // 1. Caret fades out
    if (caretRef.current) {
      animate(caretRef.current, {
        opacity: [1, 0],
        duration: TIMING.editingToSubmitting,
        easing: EASING.out,
      });
    }

    // 2. Text dims
    if (nameRef.current) {
      animate(nameRef.current, {
        opacity: [1, 0.8],
        duration: TIMING.editingToSubmitting,
        easing: EASING.out,
      });
    }

    // 3. Start shimmer (CSS handles the loop)
    startSubmittingShimmer(underlineRef);

    setTimeout(resolve, TIMING.editingToSubmitting);
  });
};

// =============================================================================
// STATE: SUBMITTING (Shimmer Loop)
// =============================================================================

/**
 * Start shimmer animation on underline.
 * Uses CSS class for infinite loop.
 */
export const startSubmittingShimmer = (
  underlineRef: React.RefObject<HTMLDivElement>
): void => {
  if (underlineRef.current) {
    underlineRef.current.classList.add('badge-shimmer-active');
  }
};

/**
 * Stop shimmer animation on underline.
 */
export const stopSubmittingShimmer = (
  underlineRef: React.RefObject<HTMLDivElement>
): void => {
  if (underlineRef.current) {
    underlineRef.current.classList.remove('badge-shimmer-active');
  }
};

// =============================================================================
// TRANSITION: SUBMITTING → SUCCESS (300ms sequence)
// =============================================================================

/**
 * Animate from submitting to success state.
 *
 * Sequence:
 * 1. Text collapses/fades (100ms)
 * 2. Checkmark scales up with spring bounce (150ms, delayed 100ms)
 * 3. Underline turns emerald
 */
export const animateSubmittingToSuccess = (refs: AnimationRefs): Promise<void> => {
  return new Promise((resolve) => {
    const { nameRef, checkmarkRef, underlineRef } = refs;

    // Stop shimmer first
    stopSubmittingShimmer(underlineRef);

    // 1. Text collapses/fades
    if (nameRef.current) {
      animate(nameRef.current, {
        opacity: [0.8, 0],
        scale: [1, 0.9],
        duration: 100,
        easing: EASING.in,
      });
    }

    // 2. Checkmark scales in with spring bounce
    if (checkmarkRef.current) {
      const anim = animate(checkmarkRef.current, {
        scale: [0, 1.1, 1],
        opacity: [0, 1],
        duration: TIMING.checkmarkScaleIn,
        delay: TIMING.checkmarkScaleInDelay,
        easing: EASING.spring,
        onComplete: () => resolve(),
      });
      trackAnimation('checkmark-in', anim);
    }

    // 3. Underline turns emerald
    if (underlineRef.current) {
      animate(underlineRef.current, {
        backgroundColor: [COLORS.underlineCyan, COLORS.underlineEmerald],
        duration: TIMING.submittingToSuccess,
        delay: TIMING.checkmarkScaleInDelay,
        easing: EASING.out,
      });
    }
  });
};

// =============================================================================
// TRANSITION: SUCCESS → DISPLAY (300ms)
// =============================================================================

/**
 * Animate from success back to display state.
 *
 * - Checkmark slides left + shrinks + fades (150ms)
 * - New "@name" slides in from right (150ms, delayed 100ms)
 * - Underline fades back to muted
 */
export const animateSuccessToDisplay = (refs: AnimationRefs): Promise<void> => {
  return new Promise((resolve) => {
    const { checkmarkRef, nameRef, prefixRef, underlineRef } = refs;

    // 1. Checkmark slides out
    if (checkmarkRef.current) {
      animate(checkmarkRef.current, {
        translateX: [0, -GEOMETRY.slideDistance],
        scale: [1, 0.5],
        opacity: [1, 0],
        duration: TIMING.checkmarkSlideOut,
        easing: EASING.in,
      });
    }

    // 2. Prefix slides in from right
    if (prefixRef.current) {
      animate(prefixRef.current, {
        translateX: [GEOMETRY.slideDistance, 0],
        opacity: [0, COLORS.prefixOpacity],
        duration: TIMING.slideInDuration,
        delay: TIMING.slideInDelay,
        easing: EASING.out,
      });
    }

    // 3. Name slides in from right
    if (nameRef.current) {
      animate(nameRef.current, {
        translateX: [GEOMETRY.slideDistance, 0],
        opacity: [0, 1],
        scale: [0.9, 1],
        duration: TIMING.slideInDuration,
        delay: TIMING.slideInDelay,
        easing: EASING.out,
      });
    }

    // 4. Underline fades back to muted
    if (underlineRef.current) {
      const anim = animate(underlineRef.current, {
        backgroundColor: [COLORS.underlineEmerald, COLORS.underlineMuted],
        opacity: [1, 0.3],
        duration: TIMING.slideInDuration,
        delay: TIMING.slideInDelay,
        easing: EASING.out,
        onComplete: () => resolve(),
      });
      trackAnimation('underline-fade', anim);
    } else {
      setTimeout(resolve, TIMING.slideInDuration + TIMING.slideInDelay);
    }
  });
};

// =============================================================================
// ERROR ENTRY (shake + rose underline)
// =============================================================================

/**
 * Animate error state entry.
 *
 * - Badge shakes (300ms)
 * - Underline turns rose
 * - Error message fades in
 */
export const animateError = (refs: AnimationRefs): Promise<void> => {
  return new Promise((resolve) => {
    const { badgeRef, underlineRef, errorRef } = refs;

    // Stop shimmer if still running
    stopSubmittingShimmer(underlineRef);

    // 1. Shake the badge
    if (badgeRef.current) {
      const amplitude = GEOMETRY.shakeAmplitude;
      animate(badgeRef.current, {
        translateX: [0, -amplitude, amplitude, -amplitude * 0.75, amplitude * 0.75, -amplitude * 0.5, amplitude * 0.5, 0],
        duration: TIMING.errorShake,
        easing: EASING.out,
      });
    }

    // 2. Underline turns rose
    if (underlineRef.current) {
      animate(underlineRef.current, {
        backgroundColor: COLORS.underlineRose,
        opacity: 1,
        duration: 100,
        easing: EASING.out,
      });
    }

    // 3. Error message fades in
    if (errorRef.current) {
      const anim = animate(errorRef.current, {
        opacity: [0, 1],
        translateX: [10, 0],
        duration: 150,
        delay: 100,
        easing: EASING.out,
        onComplete: () => resolve(),
      });
      trackAnimation('error-in', anim);
    } else {
      setTimeout(resolve, TIMING.errorShake);
    }
  });
};

// =============================================================================
// TRANSITION: ERROR → EDITING (200ms)
// =============================================================================

/**
 * Animate from error back to editing state.
 *
 * - Error indicator fades out
 * - Underline transitions rose → cyan
 * - Caret reappears
 */
export const animateErrorToEditing = (refs: AnimationRefs): Promise<void> => {
  return new Promise((resolve) => {
    const { errorRef, underlineRef, caretRef } = refs;

    // 1. Error indicator fades out
    if (errorRef.current) {
      animate(errorRef.current, {
        opacity: [1, 0],
        duration: 100,
        easing: EASING.out,
      });
    }

    // 2. Underline transitions rose → cyan
    if (underlineRef.current) {
      animate(underlineRef.current, {
        backgroundColor: [COLORS.underlineRose, COLORS.underlineCyan],
        duration: 150,
        easing: EASING.out,
      });
    }

    // 3. Caret reappears
    if (caretRef.current) {
      const anim = animate(caretRef.current, {
        opacity: [0, 1],
        duration: 100,
        delay: 50,
        easing: EASING.out,
        onComplete: () => resolve(),
      });
      trackAnimation('caret-reappear', anim);
    } else {
      setTimeout(resolve, TIMING.errorToEditing);
    }
  });
};

// =============================================================================
// CARET PULSE (Continuous during editing)
// =============================================================================

/**
 * Start caret pulse animation.
 * Continuous blink while in editing state.
 */
export const startCaretPulse = (
  caretRef: React.RefObject<HTMLDivElement>
): void => {
  if (!caretRef.current) return;

  // Use CSS class for pulse animation
  caretRef.current.classList.add('badge-caret-pulse');
};

/**
 * Stop caret pulse animation.
 */
export const stopCaretPulse = (
  caretRef: React.RefObject<HTMLDivElement>
): void => {
  if (!caretRef.current) return;

  caretRef.current.classList.remove('badge-caret-pulse');
};

// =============================================================================
// CLEANUP
// =============================================================================

/**
 * Clean up all active animations.
 * Call on unmount or state reset.
 */
export const cleanupAllAnimations = (): void => {
  activeAnimations.forEach((anim) => anim.pause());
  activeAnimations.clear();
};

/**
 * Reset element transforms.
 * Useful when canceling or resetting state.
 */
export const resetElementTransforms = (refs: AnimationRefs): void => {
  const elements = [
    refs.badgeRef.current,
    refs.nameRef.current,
    refs.prefixRef.current,
    refs.checkmarkRef.current,
    refs.errorRef.current,
  ];

  elements.forEach((el) => {
    if (el) {
      el.style.transform = '';
      el.style.opacity = '';
    }
  });
};
