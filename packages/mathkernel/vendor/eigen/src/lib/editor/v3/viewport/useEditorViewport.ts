/**
 * useEditorViewport
 *
 * Lightweight viewport management hook for editor panels:
 * - Smooth zoom with CSS transforms (no re-layout)
 * - Per-editor hotkey scope
 * - TOC scroll navigation
 *
 * NOTE: Motion blur was removed for performance — it caused stutter when zoomed.
 *
 * @module editor/v3/viewport/useEditorViewport
 */

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  useMemo,
  type RefObject,
} from 'react';
import type { Editor } from '@tiptap/core';
import {
  type ViewportState,
  type ViewportConfig,
  DEFAULT_VIEWPORT_CONFIG,
} from './types';

// =============================================================================
// Types
// =============================================================================

export interface UseEditorViewportOptions {
  /** Unique editor ID (for scoped hotkeys) — DEPRECATED, unused */
  editorId?: string;
  /** TipTap editor instance */
  editor: Editor | null;
  /** Scroll container ref */
  scrollContainerRef: RefObject<HTMLElement | null>;
  /** Content container ref (for zoom transform) — DEPRECATED, unused */
  contentRef?: RefObject<HTMLElement | null>;
  /** Viewport configuration overrides */
  config?: Partial<ViewportConfig>;
  /** Callback when zoom changes */
  onZoomChange?: (zoom: number) => void;
  /** Callback when active heading changes */
  onActiveHeadingChange?: (headingId: string | null) => void;
}

export interface UseEditorViewportResult {
  /** Current viewport state */
  state: ViewportState;
  /** Zoom operations */
  zoom: {
    current: number;
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
    setZoom: (level: number) => void;
    canZoomIn: boolean;
    canZoomOut: boolean;
    label: string;
  };
  /** Scroll operations */
  scroll: {
    scrollTo: (y: number, smooth?: boolean) => void;
    /** Scroll to heading by ProseMirror position */
    scrollToHeading: (pos: number) => void;
    scrollToTop: () => void;
    scrollToBottom: () => void;
    pageUp: () => void;
    pageDown: () => void;
    lineUp: () => void;
    lineDown: () => void;
  };
  /** Motion blur CSS style (DEPRECATED - returns empty object) */
  motionBlurStyle: React.CSSProperties;
  /** Zoom transform CSS style (apply to content) */
  zoomStyle: React.CSSProperties;
  /** Focus the viewport (activates hotkeys) */
  focus: () => void;
  /** Blur the viewport (deactivates hotkeys) */
  blur: () => void;
  /** Is viewport focused */
  isFocused: boolean;
}

// =============================================================================
// Easing Functions
// =============================================================================

/** Exponential ease-out (no ringing) */
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** Clamp value between min and max */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// =============================================================================
// Hook
// =============================================================================

export function useEditorViewport({
  editor,
  scrollContainerRef,
  config: configOverrides,
  onZoomChange,
  onActiveHeadingChange,
}: UseEditorViewportOptions): UseEditorViewportResult {
  // Merge config with defaults
  const config = useMemo<ViewportConfig>(
    () => ({
      ...DEFAULT_VIEWPORT_CONFIG,
      ...configOverrides,
      zoom: { ...DEFAULT_VIEWPORT_CONFIG.zoom, ...configOverrides?.zoom },
      motionBlur: {
        ...DEFAULT_VIEWPORT_CONFIG.motionBlur,
        ...configOverrides?.motionBlur,
      },
    }),
    [configOverrides]
  );

  // ---------------------------------------------------------------------------
  // State (minimal - only what's needed for React rendering)
  // ---------------------------------------------------------------------------

  const [zoomState, setZoomState] = useState({
    current: 1,
    target: 1,
    isAnimating: false,
  });
  const [isFocused, setIsFocused] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);

  // Animation frame ref for zoom
  const zoomAnimationRef = useRef<number | null>(null);

  // ---------------------------------------------------------------------------
  // Zoom
  // ---------------------------------------------------------------------------

  const animateZoom = useCallback(
    (targetZoom: number) => {
      const startZoom = zoomState.current;
      const startTime = performance.now();
      const duration = config.zoom.animationMs;

      // Cancel any existing animation
      if (zoomAnimationRef.current) {
        cancelAnimationFrame(zoomAnimationRef.current);
      }

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutExpo(progress);

        const newZoom = startZoom + (targetZoom - startZoom) * easedProgress;

        setZoomState({
          current: newZoom,
          target: targetZoom,
          isAnimating: progress < 1,
        });

        if (progress < 1) {
          zoomAnimationRef.current = requestAnimationFrame(animate);
        } else {
          zoomAnimationRef.current = null;
          onZoomChange?.(targetZoom);
        }
      };

      zoomAnimationRef.current = requestAnimationFrame(animate);
    },
    [zoomState.current, config.zoom.animationMs, onZoomChange]
  );

  const setZoom = useCallback(
    (level: number) => {
      const clamped = clamp(level, config.zoom.min, config.zoom.max);
      animateZoom(clamped);
    },
    [config.zoom.min, config.zoom.max, animateZoom]
  );

  const zoomIn = useCallback(() => {
    setZoom(zoomState.current + config.zoom.step);
  }, [zoomState.current, config.zoom.step, setZoom]);

  const zoomOut = useCallback(() => {
    setZoom(zoomState.current - config.zoom.step);
  }, [zoomState.current, config.zoom.step, setZoom]);

  const resetZoom = useCallback(() => {
    setZoom(1);
  }, [setZoom]);

  // ---------------------------------------------------------------------------
  // Scroll Operations (no velocity tracking - just navigation)
  // ---------------------------------------------------------------------------

  const scrollTo = useCallback(
    (y: number, smooth = true) => {
      const container = scrollContainerRef.current;
      if (!container) return;

      container.scrollTo({
        top: y,
        behavior: smooth ? 'smooth' : 'auto',
      });
    },
    [scrollContainerRef]
  );

  /**
   * Scroll to a heading by ProseMirror position.
   */
  const scrollToHeading = useCallback(
    (pos: number) => {
      if (!editor?.view?.state?.doc) return;

      const view = editor.view;
      const domNode = view.nodeDOM(pos);

      if (!(domNode instanceof HTMLElement)) {
        // Fallback: just focus
        editor.commands.focus(pos);
        return;
      }

      // Scroll into view (works with CSS transforms)
      domNode.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Apply offset after scroll animation
      const container = scrollContainerRef.current;
      if (container) {
        setTimeout(() => {
          container.scrollBy({ top: -80, behavior: 'smooth' });
        }, 300);
      }

      // Track active heading
      const docNode = view.state.doc.nodeAt(pos);
      if (docNode?.type.name === 'heading') {
        const slug = docNode.textContent
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        setActiveHeadingId(slug);
        onActiveHeadingChange?.(slug);
      }

      editor.commands.focus(pos);
    },
    [editor, scrollContainerRef, onActiveHeadingChange]
  );

  const scrollToTop = useCallback(() => scrollTo(0), [scrollTo]);

  const scrollToBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      scrollTo(container.scrollHeight);
    }
  }, [scrollContainerRef, scrollTo]);

  const pageUp = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      const pageHeight = container.clientHeight * config.scrollPageFraction;
      scrollTo(container.scrollTop - pageHeight);
    }
  }, [scrollContainerRef, config.scrollPageFraction, scrollTo]);

  const pageDown = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      const pageHeight = container.clientHeight * config.scrollPageFraction;
      scrollTo(container.scrollTop + pageHeight);
    }
  }, [scrollContainerRef, config.scrollPageFraction, scrollTo]);

  const lineUp = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      scrollTo(container.scrollTop - config.scrollLineHeight);
    }
  }, [scrollContainerRef, config.scrollLineHeight, scrollTo]);

  const lineDown = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      scrollTo(container.scrollTop + config.scrollLineHeight);
    }
  }, [scrollContainerRef, config.scrollLineHeight, scrollTo]);

  // ---------------------------------------------------------------------------
  // Hotkey Handler (scroll + zoom)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isFocused) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if in input/textarea/contentEditable — let the editor handle typing
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Only intercept Ctrl/Cmd combinations (zoom) in editable elements
        // Never intercept plain j/k/g/G — those are for typing!
        if (!e.ctrlKey && !e.metaKey) return;
      }

      // Scroll hotkeys (vim-style)
      switch (e.key) {
        case 'j':
          e.preventDefault();
          lineDown();
          break;
        case 'k':
          e.preventDefault();
          lineUp();
          break;
        case 'G':
          e.preventDefault();
          scrollToBottom();
          break;
      }

      // Ctrl/Cmd + key combinations
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          // Scroll: Ctrl+U / Ctrl+D for page up/down
          case 'u':
            e.preventDefault();
            pageUp();
            break;
          case 'd':
            e.preventDefault();
            pageDown();
            break;
          // Zoom: Ctrl+= / Ctrl+- / Ctrl+0
          case '=':
          case '+':
            e.preventDefault();
            zoomIn();
            break;
          case '-':
            e.preventDefault();
            zoomOut();
            break;
          case '0':
            e.preventDefault();
            resetZoom();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isFocused,
    lineUp,
    lineDown,
    pageUp,
    pageDown,
    scrollToTop,
    scrollToBottom,
    zoomIn,
    zoomOut,
    resetZoom,
  ]);

  // ---------------------------------------------------------------------------
  // Focus Management
  // ---------------------------------------------------------------------------

  const focus = useCallback(() => setIsFocused(true), []);
  const blur = useCallback(() => setIsFocused(false), []);

  // Auto-focus on scroll container click
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleFocus = () => setIsFocused(true);
    const handleBlur = (e: FocusEvent) => {
      // Only blur if focus moved outside the container
      if (!container.contains(e.relatedTarget as Node)) {
        setIsFocused(false);
      }
    };

    container.addEventListener('focusin', handleFocus);
    container.addEventListener('focusout', handleBlur);
    container.addEventListener('click', handleFocus);

    return () => {
      container.removeEventListener('focusin', handleFocus);
      container.removeEventListener('focusout', handleBlur);
      container.removeEventListener('click', handleFocus);
    };
  }, [scrollContainerRef]);

  // ---------------------------------------------------------------------------
  // Computed Styles
  // ---------------------------------------------------------------------------

  // Motion blur disabled — returns empty object for backwards compatibility
  const motionBlurStyle = useMemo<React.CSSProperties>(() => ({}), []);

  const zoomStyle = useMemo<React.CSSProperties>(() => {
    const scale = zoomState.current;

    // When scale = 1, no transform needed
    if (scale === 1) {
      return {
        transform: 'none',
        width: '100%',
        minHeight: '100%',
      };
    }

    // Transform-based zoom with proper centering
    const isZoomIn = scale > 1;

    return {
      transform: `scale(${scale})`,
      transformOrigin: 'top center',
      width: isZoomIn ? `${100 / scale}%` : '100%',
      minHeight: isZoomIn ? `${100 / scale}%` : '100%',
      marginLeft: isZoomIn ? 'auto' : undefined,
      marginRight: isZoomIn ? 'auto' : undefined,
      willChange: zoomState.isAnimating ? 'transform' : 'auto',
      transition: zoomState.isAnimating ? 'none' : 'transform 0.1s ease-out',
    };
  }, [zoomState.current, zoomState.isAnimating]);

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (zoomAnimationRef.current)
        cancelAnimationFrame(zoomAnimationRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Construct ViewportState for backwards compatibility
  // ---------------------------------------------------------------------------

  const state = useMemo<ViewportState>(
    () => ({
      zoom: zoomState,
      scroll: {
        position: 0,
        velocity: 0,
        direction: 'none',
        isScrolling: false,
        lastScrollTime: 0,
      },
      activeHeadingId,
      isFocused,
    }),
    [zoomState, activeHeadingId, isFocused]
  );

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    state,
    zoom: {
      current: zoomState.current,
      zoomIn,
      zoomOut,
      reset: resetZoom,
      setZoom,
      canZoomIn: zoomState.current < config.zoom.max,
      canZoomOut: zoomState.current > config.zoom.min,
      label: `${Math.round(zoomState.current * 100)}%`,
    },
    scroll: {
      scrollTo,
      scrollToHeading,
      scrollToTop,
      scrollToBottom,
      pageUp,
      pageDown,
      lineUp,
      lineDown,
    },
    motionBlurStyle,
    zoomStyle,
    focus,
    blur,
    isFocused,
  };
}
