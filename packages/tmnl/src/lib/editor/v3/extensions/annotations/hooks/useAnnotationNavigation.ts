/**
 * useAnnotationNavigation Hook
 *
 * Keyboard navigation for annotations in the editor.
 * Provides next/prev navigation, jump to first/last, and selection controls.
 *
 * @module editor/v3/extensions/annotations/hooks/useAnnotationNavigation
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import type { Editor } from '@tiptap/react';

import {
  marksArrayAtom,
  selectedAnnotationIdAtom,
  visibleMarkIdsAtom,
  selectionOps,
} from '../atoms';
import type { AnnotationId, IntentMark } from '../schemas';

// =============================================================================
// Types
// =============================================================================

export interface UseAnnotationNavigationOptions {
  /**
   * TipTap editor instance
   */
  editor: Editor | null;

  /**
   * Enable keyboard shortcuts
   * @default true
   */
  enableShortcuts?: boolean;

  /**
   * Only navigate visible annotations
   * @default true
   */
  visibleOnly?: boolean;

  /**
   * Focus editor after navigation
   * @default true
   */
  focusOnNavigate?: boolean;

  /**
   * Scroll annotation into view
   * @default true
   */
  scrollIntoView?: boolean;

  /**
   * Callback when annotation is navigated to
   */
  onNavigate?: (mark: IntentMark, direction: 'next' | 'prev' | 'first' | 'last') => void;
}

export interface UseAnnotationNavigationReturn {
  /**
   * Navigate to next annotation
   */
  navigateNext: () => void;

  /**
   * Navigate to previous annotation
   */
  navigatePrev: () => void;

  /**
   * Navigate to first annotation
   */
  navigateFirst: () => void;

  /**
   * Navigate to last annotation
   */
  navigateLast: () => void;

  /**
   * Navigate to specific annotation by ID
   */
  navigateTo: (id: AnnotationId) => void;

  /**
   * Clear current selection
   */
  clearSelection: () => void;

  /**
   * Currently selected annotation ID
   */
  selectedId: AnnotationId | null;

  /**
   * Current navigation index (0-based)
   */
  currentIndex: number;

  /**
   * Total navigable annotations
   */
  totalCount: number;

  /**
   * Can navigate to next
   */
  hasNext: boolean;

  /**
   * Can navigate to previous
   */
  hasPrev: boolean;

  /**
   * Sorted marks for navigation
   */
  sortedMarks: readonly IntentMark[];
}

// =============================================================================
// Keyboard Shortcut Configuration
// =============================================================================

const SHORTCUTS = {
  next: ['n', 'ArrowDown'],
  prev: ['p', 'ArrowUp'],
  first: ['Home'],
  last: ['End'],
  clear: ['Escape'],
} as const;

// =============================================================================
// Hook Implementation
// =============================================================================

export function useAnnotationNavigation(
  options: UseAnnotationNavigationOptions
): UseAnnotationNavigationReturn {
  const {
    editor,
    enableShortcuts = true,
    visibleOnly = true,
    focusOnNavigate = true,
    scrollIntoView = true,
    onNavigate,
  } = options;

  // Subscribe to annotation state
  const allMarks = useAtomValue(marksArrayAtom);
  const visibleIds = useAtomValue(visibleMarkIdsAtom);
  const selectedId = useAtomValue(selectedAnnotationIdAtom);

  // Sort marks by document position for consistent navigation order
  const sortedMarks = useMemo(() => {
    let marks = [...allMarks];

    // Filter to visible only if enabled
    if (visibleOnly) {
      marks = marks.filter((m) => visibleIds.has(m.id));
    }

    // Sort by from position (document order)
    return marks.sort((a, b) => a.from - b.from);
  }, [allMarks, visibleIds, visibleOnly]);

  // Compute current index
  const currentIndex = useMemo(() => {
    if (!selectedId) return -1;
    return sortedMarks.findIndex((m) => m.id === selectedId);
  }, [selectedId, sortedMarks]);

  const totalCount = sortedMarks.length;
  const hasNext = currentIndex < totalCount - 1;
  const hasPrev = currentIndex > 0;

  // Focus editor at annotation position
  const focusAtMark = useCallback(
    (mark: IntentMark) => {
      if (!editor) return;

      // Set cursor to start of annotation
      editor.commands.setTextSelection(mark.from);

      if (focusOnNavigate) {
        editor.commands.focus();
      }

      if (scrollIntoView) {
        // Scroll the mark into view
        editor.commands.scrollIntoView();
      }
    },
    [editor, focusOnNavigate, scrollIntoView]
  );

  // Navigation handlers
  const navigateTo = useCallback(
    (id: AnnotationId) => {
      const mark = sortedMarks.find((m) => m.id === id);
      if (!mark) return;

      selectionOps.select(id);
      focusAtMark(mark);
    },
    [sortedMarks, focusAtMark]
  );

  const navigateNext = useCallback(() => {
    if (totalCount === 0) return;

    const nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, totalCount - 1);
    const mark = sortedMarks[nextIndex];
    if (!mark) return;

    selectionOps.select(mark.id);
    focusAtMark(mark);
    onNavigate?.(mark, 'next');
  }, [currentIndex, totalCount, sortedMarks, focusAtMark, onNavigate]);

  const navigatePrev = useCallback(() => {
    if (totalCount === 0) return;

    const prevIndex = currentIndex < 0 ? totalCount - 1 : Math.max(currentIndex - 1, 0);
    const mark = sortedMarks[prevIndex];
    if (!mark) return;

    selectionOps.select(mark.id);
    focusAtMark(mark);
    onNavigate?.(mark, 'prev');
  }, [currentIndex, totalCount, sortedMarks, focusAtMark, onNavigate]);

  const navigateFirst = useCallback(() => {
    const mark = sortedMarks[0];
    if (!mark) return;

    selectionOps.select(mark.id);
    focusAtMark(mark);
    onNavigate?.(mark, 'first');
  }, [sortedMarks, focusAtMark, onNavigate]);

  const navigateLast = useCallback(() => {
    const mark = sortedMarks[totalCount - 1];
    if (!mark) return;

    selectionOps.select(mark.id);
    focusAtMark(mark);
    onNavigate?.(mark, 'last');
  }, [sortedMarks, totalCount, focusAtMark, onNavigate]);

  const clearSelection = useCallback(() => {
    selectionOps.clearSelection();
  }, []);

  // Keyboard event handler
  useEffect(() => {
    if (!enableShortcuts || !editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle when editor or document is focused, not in other inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow navigation in contenteditable (the editor itself)
        if (!target.closest('.ProseMirror')) {
          return;
        }
      }

      // Require Alt modifier for navigation to avoid conflicts
      if (!event.altKey) return;

      const key = event.key;

      if (SHORTCUTS.next.includes(key)) {
        event.preventDefault();
        navigateNext();
      } else if (SHORTCUTS.prev.includes(key)) {
        event.preventDefault();
        navigatePrev();
      } else if (SHORTCUTS.first.includes(key)) {
        event.preventDefault();
        navigateFirst();
      } else if (SHORTCUTS.last.includes(key)) {
        event.preventDefault();
        navigateLast();
      } else if (SHORTCUTS.clear.includes(key)) {
        event.preventDefault();
        clearSelection();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    enableShortcuts,
    editor,
    navigateNext,
    navigatePrev,
    navigateFirst,
    navigateLast,
    clearSelection,
  ]);

  return {
    navigateNext,
    navigatePrev,
    navigateFirst,
    navigateLast,
    navigateTo,
    clearSelection,
    selectedId,
    currentIndex,
    totalCount,
    hasNext,
    hasPrev,
    sortedMarks,
  };
}

export default useAnnotationNavigation;
