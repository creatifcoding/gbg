/**
 * EditorViewport Types
 *
 * Obsidian-style viewport management with:
 * - Smooth zoom (no stuttering)
 * - Motion blur on scroll (directional, exponential ease)
 * - Per-editor hotkey scopes
 *
 * @module editor/v3/viewport/types
 */

// =============================================================================
// Zoom
// =============================================================================

/** Zoom configuration */
export interface ZoomConfig {
  /** Minimum zoom level (e.g., 0.5 = 50%) */
  readonly min: number;
  /** Maximum zoom level (e.g., 2.0 = 200%) */
  readonly max: number;
  /** Zoom step for +/- operations (e.g., 0.1 = 10%) */
  readonly step: number;
  /** Animation duration in ms */
  readonly animationMs: number;
  /** Easing function */
  readonly easing: 'ease-out' | 'ease-in-out' | 'spring';
}

/** Zoom state */
export interface ZoomState {
  /** Current zoom level (1.0 = 100%) */
  readonly current: number;
  /** Target zoom level (during animation) */
  readonly target: number;
  /** Is animating */
  readonly isAnimating: boolean;
}

// =============================================================================
// Scroll
// =============================================================================

/** Scroll direction for motion blur */
export type ScrollDirection = 'up' | 'down' | 'none';

/** Scroll state */
export interface ScrollState {
  /** Current scroll position (Y) */
  readonly position: number;
  /** Scroll velocity (px/ms) */
  readonly velocity: number;
  /** Direction of scroll */
  readonly direction: ScrollDirection;
  /** Is actively scrolling */
  readonly isScrolling: boolean;
  /** Timestamp of last scroll */
  readonly lastScrollTime: number;
}

/** Motion blur configuration */
export interface MotionBlurConfig {
  /** Enable motion blur */
  readonly enabled: boolean;
  /** Maximum blur amount (px) */
  readonly maxBlur: number;
  /** Velocity threshold to start blur (px/ms) */
  readonly velocityThreshold: number;
  /** Blur decay rate (exponential, 0-1) */
  readonly decayRate: number;
  /** Opacity reduction at max blur (0-1) */
  readonly opacityReduction: number;
}

// =============================================================================
// Hotkeys
// =============================================================================

/** Editor hotkey actions */
export type EditorHotkeyAction =
  | 'scroll.up'
  | 'scroll.down'
  | 'scroll.pageUp'
  | 'scroll.pageDown'
  | 'scroll.top'
  | 'scroll.bottom'
  | 'zoom.in'
  | 'zoom.out'
  | 'zoom.reset'
  | 'zoom.fit'
  | 'toc.next'
  | 'toc.prev'
  | 'toc.toggle';

/** Default hotkey bindings for editor */
export const DEFAULT_EDITOR_HOTKEYS: Record<EditorHotkeyAction, string> = {
  'scroll.up': 'k',
  'scroll.down': 'j',
  'scroll.pageUp': 'ctrl+u',
  'scroll.pageDown': 'ctrl+d',
  'scroll.top': 'g g',
  'scroll.bottom': 'shift+g',
  'zoom.in': 'ctrl+=',
  'zoom.out': 'ctrl+-',
  'zoom.reset': 'ctrl+0',
  'zoom.fit': 'ctrl+shift+0',
  'toc.next': ']',
  'toc.prev': '[',
  'toc.toggle': 'ctrl+shift+e',
};

// =============================================================================
// Viewport State
// =============================================================================

/** Complete viewport state for an editor instance */
export interface ViewportState {
  readonly zoom: ZoomState;
  readonly scroll: ScrollState;
  /** Active heading ID (for TOC sync) */
  readonly activeHeadingId: string | null;
  /** Is viewport focused (receives hotkeys) */
  readonly isFocused: boolean;
}

/** Viewport configuration */
export interface ViewportConfig {
  readonly zoom: ZoomConfig;
  readonly motionBlur: MotionBlurConfig;
  /** Scroll amount for j/k keys (px) */
  readonly scrollLineHeight: number;
  /** Scroll amount for page up/down (fraction of viewport) */
  readonly scrollPageFraction: number;
  /** Smooth scroll duration (ms) */
  readonly smoothScrollMs: number;
}

/** Default viewport configuration */
export const DEFAULT_VIEWPORT_CONFIG: ViewportConfig = {
  zoom: {
    min: 0.5,
    max: 3.0,
    step: 0.1,
    animationMs: 150,
    easing: 'ease-out',
  },
  motionBlur: {
    enabled: true,
    maxBlur: 8,
    velocityThreshold: 0.5,
    decayRate: 0.85,
    opacityReduction: 0.15,
  },
  scrollLineHeight: 40,
  scrollPageFraction: 0.85,
  smoothScrollMs: 200,
};

/** Initial viewport state */
export const INITIAL_VIEWPORT_STATE: ViewportState = {
  zoom: {
    current: 1,
    target: 1,
    isAnimating: false,
  },
  scroll: {
    position: 0,
    velocity: 0,
    direction: 'none',
    isScrolling: false,
    lastScrollTime: 0,
  },
  activeHeadingId: null,
  isFocused: false,
};
