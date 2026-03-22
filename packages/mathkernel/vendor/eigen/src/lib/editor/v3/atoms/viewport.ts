/**
 * Editor Viewport Atoms
 *
 * Atom-as-State pattern for editor viewport controls:
 * - Zoom level
 * - Scroll position (for TOC sync)
 *
 * NOTE: These atoms are registry-agnostic. They work with whatever registry
 * is provided via React context (PanelRegistryProvider) or passed explicitly.
 *
 * @module editor/v3/atoms/viewport
 */

import { Atom, Registry } from '@effect-atom/atom';

// =============================================================================
// Zoom State
// =============================================================================

/** Zoom level as percentage (100 = 100%) */
export const zoomLevelAtom = Atom.make(100);

/** Zoom bounds */
export const ZOOM_MIN = 50;
export const ZOOM_MAX = 200;
export const ZOOM_STEP = 10;

// =============================================================================
// Scroll State
// =============================================================================

/** Current scroll position (Y offset in pixels) */
export const scrollPositionAtom = Atom.make(0);

/** Active heading ID (for TOC highlighting) */
export const activeHeadingIdAtom = Atom.make<string | null>(null);

// =============================================================================
// Derived Atoms
// =============================================================================

/** Zoom level as decimal (1.0 = 100%) */
export const zoomScaleAtom = Atom.make((get) => {
  return get(zoomLevelAtom) / 100;
});

/** Whether zoom can increase */
export const canZoomInAtom = Atom.make((get) => {
  return get(zoomLevelAtom) < ZOOM_MAX;
});

/** Whether zoom can decrease */
export const canZoomOutAtom = Atom.make((get) => {
  return get(zoomLevelAtom) > ZOOM_MIN;
});

/** Formatted zoom string (e.g., "100%") */
export const zoomLabelAtom = Atom.make((get) => {
  return `${get(zoomLevelAtom)}%`;
});

// =============================================================================
// Zoom Operations Factory
// =============================================================================

/**
 * Create zoom operations bound to a specific registry.
 * Use within React via useSetAtom, or pass registry explicitly.
 */
export const createZoomOps = (registry: Registry.Registry) => ({
  /** Set zoom to specific level */
  setZoom: (level: number) => {
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, level));
    registry.set(zoomLevelAtom, clamped);
  },

  /** Zoom in by ZOOM_STEP */
  zoomIn: () => {
    const current = registry.get(zoomLevelAtom);
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, current + ZOOM_STEP));
    registry.set(zoomLevelAtom, clamped);
  },

  /** Zoom out by ZOOM_STEP */
  zoomOut: () => {
    const current = registry.get(zoomLevelAtom);
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, current - ZOOM_STEP));
    registry.set(zoomLevelAtom, clamped);
  },

  /** Reset to 100% */
  resetZoom: () => {
    registry.set(zoomLevelAtom, 100);
  },
});

// =============================================================================
// Scroll Operations Factory
// =============================================================================

/**
 * Create scroll operations bound to a specific registry.
 */
export const createScrollOps = (registry: Registry.Registry) => ({
  /** Update scroll position (call from scroll event handler) */
  setScrollPosition: (y: number) => {
    registry.set(scrollPositionAtom, y);
  },

  /** Set active heading ID (for TOC highlighting) */
  setActiveHeading: (id: string | null) => {
    registry.set(activeHeadingIdAtom, id);
  },
});
