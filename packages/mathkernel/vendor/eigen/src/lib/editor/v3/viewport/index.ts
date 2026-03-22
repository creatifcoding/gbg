/**
 * EditorViewport
 *
 * Viewport management for editor panels:
 * - Smooth zoom with CSS transforms (useEditorViewport)
 * - Motion blur on scroll
 * - Per-editor hotkey scopes
 * - TOC navigation
 *
 * @module editor/v3/viewport
 */

// Types
export type {
  ZoomConfig,
  ZoomState,
  ScrollDirection,
  ScrollState,
  MotionBlurConfig,
  EditorHotkeyAction,
  ViewportState,
  ViewportConfig,
} from './types';

export {
  DEFAULT_EDITOR_HOTKEYS,
  DEFAULT_VIEWPORT_CONFIG,
  INITIAL_VIEWPORT_STATE,
} from './types';

// Primary viewport hook (transform: scale zoom + hotkeys + motion blur)
export {
  useEditorViewport,
  type UseEditorViewportOptions,
  type UseEditorViewportResult,
} from './useEditorViewport';

// Scoped hotkeys for editor panels
export {
  useEditorScopedHotkeys,
  type EditorHotkeyBinding,
  type UseEditorScopedHotkeysOptions,
  type UseEditorScopedHotkeysResult,
} from './useEditorScopedHotkeys';

// Components
export { ZoomIndicator, type ZoomIndicatorProps } from './ZoomIndicator';
