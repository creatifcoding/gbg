/**
 * useAnnotationPopover Hook
 *
 * Wires IntentExecutor popover requests to the popover system.
 * Handles positioning, anchor tracking, and auto-hide on hover out.
 *
 * Usage:
 * ```tsx
 * function EditorWithPopovers() {
 *   const { anchorRef, isOpen } = useAnnotationPopover({ editor })
 *
 *   return (
 *     <>
 *       <EditorContent editor={editor} />
 *       <AnnotationPopover />
 *     </>
 *   )
 * }
 * ```
 *
 * @module editor/v3/extensions/annotations/hooks/useAnnotationPopover
 */

import { useCallback, useEffect, useRef } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import { posToDOMRect, type Editor } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';

import { activePopoverAtom, isPopoverOpenAtom } from '../atoms';
import { popoverControllerOps } from '../popover-stx';
import type { PopoverRequest } from '../services';
import type { AnnotationId } from '../schemas';

// =============================================================================
// Types
// =============================================================================

export interface UseAnnotationPopoverOptions {
  /** TipTap editor instance */
  editor: Editor | null;

  /** Delay before hiding popover on hover out (ms) */
  hideDelay?: number;

  /** Whether to show popover on hover */
  showOnHover?: boolean;

  /** Whether to show popover on click */
  showOnClick?: boolean;
}

export interface UseAnnotationPopoverReturn {
  /** Whether popover is currently open */
  isOpen: boolean;

  /** Active annotation ID (if popover is open) */
  activeAnnotationId: AnnotationId | null;

  /** Whether popover is pinned */
  isPinned: boolean;

  /** Show popover for an annotation */
  show: (request: PopoverRequest) => void;

  /** Hide the active popover */
  hide: () => void;

  /** Toggle popover for an annotation */
  toggle: (request: PopoverRequest) => void;

  /** Pin the active popover */
  pin: () => void;

  /** Unpin the active popover */
  unpin: () => void;

  /** Handle popover request from IntentExecutor */
  handlePopoverRequest: (request: PopoverRequest) => void;
}

// =============================================================================
// Anchor Utilities
// =============================================================================

interface AnchorRange {
  from: number;
  to: number;
}

function findAnnotationRange(editor: Editor, annotationId: AnnotationId): AnchorRange | null {
  let minFrom: number | null = null;
  let maxTo: number | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;

    const hasAnnotation = node.marks.some(
      (mark) => mark.type.name === 'intentMark' && mark.attrs.id === annotationId
    );

    if (!hasAnnotation) return;

    const from = pos;
    const to = pos + node.nodeSize;

    minFrom = minFrom === null ? from : Math.min(minFrom, from);
    maxTo = maxTo === null ? to : Math.max(maxTo, to);
  });

  if (minFrom === null || maxTo === null) {
    return null;
  }

  return { from: minFrom, to: maxTo };
}

function hasAnnotationInRange(
  editor: Editor,
  annotationId: AnnotationId,
  range: AnchorRange
): boolean {
  let found = false;

  editor.state.doc.nodesBetween(range.from, range.to, (node) => {
    if (found || !node.isText) return;

    if (
      node.marks.some(
        (mark) => mark.type.name === 'intentMark' && mark.attrs.id === annotationId
      )
    ) {
      found = true;
    }
  });

  return found;
}

function mapRange(range: AnchorRange, transaction: Transaction): AnchorRange {
  const mappedFrom = transaction.mapping.map(range.from, -1);
  const mappedTo = transaction.mapping.map(range.to, 1);

  return {
    from: Math.min(mappedFrom, mappedTo),
    to: Math.max(mappedFrom, mappedTo),
  };
}

function toVirtualAnchor(editor: Editor, range: AnchorRange) {
  return {
    _tag: 'virtual' as const,
    getBoundingClientRect: () =>
      posToDOMRect(editor.view, range.from, Math.max(range.from + 1, range.to)),
  };
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useAnnotationPopover(
  options: UseAnnotationPopoverOptions
): UseAnnotationPopoverReturn {
  const { editor, hideDelay = 200, showOnHover = true, showOnClick = true } = options;

  const isOpen = useAtomValue(isPopoverOpenAtom);
  const activePopover = useAtomValue(activePopoverAtom);

  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRangeRef = useRef<AnchorRange | null>(null);

  // Clear hide timeout
  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  // Get virtual anchor rect from position
  const getVirtualAnchor = useCallback((position: { x: number; y: number }) => {
    return {
      _tag: 'virtual' as const,
      getBoundingClientRect: () => ({
        x: position.x,
        y: position.y,
        width: 0,
        height: 0,
        top: position.y,
        right: position.x,
        bottom: position.y,
        left: position.x,
        toJSON: () => ({}),
      }),
    };
  }, []);

  // Get element/range anchor from mark ID
  const getElementAnchor = useCallback(
    (markId: AnnotationId) => {
      if (!editor) return null;

      const range = findAnnotationRange(editor, markId);
      if (range) {
        anchorRangeRef.current = range;
        return toVirtualAnchor(editor, range);
      }

      const element = editor.view.dom.querySelector(
        `[data-annotation-id="${markId}"]`
      ) as HTMLElement | null;

      if (!element) return null;

      return {
        _tag: 'virtual' as const,
        getBoundingClientRect: () => element.getBoundingClientRect(),
      };
    },
    [editor]
  );

  // Show popover
  const show = useCallback(
    (request: PopoverRequest) => {
      clearHideTimeout();

      const anchor =
        request.position
          ? getVirtualAnchor(request.position)
          : getElementAnchor(request.markId);

      if (editor) {
        const range = findAnnotationRange(editor, request.markId);
        if (range) {
          anchorRangeRef.current = range;
        }
      }

      if (!anchor) return;

      if (request.trigger === 'hover') {
        popoverControllerOps.openHover({
          annotationId: request.annotationId,
          markId: request.markId,
          anchor,
          placement: 'top',
          trigger: request.trigger,
        });
      } else {
        popoverControllerOps.openClick({
          annotationId: request.annotationId,
          markId: request.markId,
          anchor,
          placement: 'top',
          trigger: request.trigger,
        });
      }
    },
    [clearHideTimeout, getVirtualAnchor, getElementAnchor, editor]
  );

  // Hide popover with optional delay
  const hide = useCallback(() => {
    // Don't hide if pinned
    if (activePopover?.isPinned) return;

    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      popoverControllerOps.close('manual');
    }, hideDelay);
  }, [activePopover?.isPinned, clearHideTimeout, hideDelay]);

  // Toggle popover
  const toggle = useCallback(
    (request: PopoverRequest) => {
      if (isOpen && activePopover?.annotationId === request.annotationId) {
        popoverControllerOps.close('manual');
      } else {
        show(request);
      }
    },
    [isOpen, activePopover?.annotationId, show]
  );

  // Pin popover
  const pin = useCallback(() => {
    clearHideTimeout();
    popoverControllerOps.pin();
  }, [clearHideTimeout]);

  // Unpin popover
  const unpin = useCallback(() => {
    popoverControllerOps.unpin();
  }, []);

  // Handle popover request from IntentExecutor
  const handlePopoverRequest = useCallback(
    (request: PopoverRequest) => {
      if (request.trigger === 'hover' && !showOnHover) return;
      if (request.trigger === 'click' && !showOnClick) return;

      if (request.trigger === 'click') {
        toggle(request);
      } else {
        show(request);
      }
    },
    [showOnHover, showOnClick, toggle, show]
  );

  // NOTE: Mouse enter/leave tracking is now handled by safePolygon in AnnotationPopover.
  // The safePolygon pattern uses document-level mousemove to create a safe traversal zone
  // between the trigger and popover, which is more reliable than element-level listeners.

  // Wire editor lifecycle events to popover lifecycle and anchor updates.
  useEffect(() => {
    if (!editor) return;

    const refreshAnchorFromRange = () => {
      if (!activePopover?.annotationId) return;

      const current =
        anchorRangeRef.current ??
        findAnnotationRange(editor, activePopover.annotationId);

      if (!current) {
        popoverControllerOps.close('invalid-anchor');
        return;
      }

      anchorRangeRef.current = current;
      popoverControllerOps.updateAnchor(toVirtualAnchor(editor, current));
    };

    const onSelectionUpdate = () => {
      if (!activePopover) return;
      popoverControllerOps.selectionInvalidated();
    };

    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      if (!activePopover?.annotationId) return;

      let nextRange = anchorRangeRef.current
        ? mapRange(anchorRangeRef.current, transaction)
        : null;

      if (nextRange && !hasAnnotationInRange(editor, activePopover.annotationId, nextRange)) {
        nextRange = null;
      }

      if (!nextRange) {
        nextRange = findAnnotationRange(editor, activePopover.annotationId);
      }

      if (!nextRange) {
        popoverControllerOps.close('invalid-anchor');
        return;
      }

      anchorRangeRef.current = nextRange;
      popoverControllerOps.updateAnchor(toVirtualAnchor(editor, nextRange));
    };

    const onBlur = () => {
      if (!activePopover?.isPinned) {
        popoverControllerOps.close('blur');
      }
    };

    editor.on('selectionUpdate', onSelectionUpdate);
    editor.on('transaction', onTransaction);
    editor.on('blur', onBlur);

    refreshAnchorFromRange();

    return () => {
      editor.off('selectionUpdate', onSelectionUpdate);
      editor.off('transaction', onTransaction);
      editor.off('blur', onBlur);
    };
  }, [editor, activePopover]);

  // Keep anchor position fresh through viewport changes.
  useEffect(() => {
    if (!editor || !activePopover?.annotationId) return;

    const updateFromViewport = () => {
      const range =
        anchorRangeRef.current ??
        findAnnotationRange(editor, activePopover.annotationId);

      if (!range) {
        popoverControllerOps.close('invalid-anchor');
        return;
      }

      anchorRangeRef.current = range;
      popoverControllerOps.updateAnchor(toVirtualAnchor(editor, range));
    };

    window.addEventListener('scroll', updateFromViewport, true);
    window.addEventListener('resize', updateFromViewport);

    return () => {
      window.removeEventListener('scroll', updateFromViewport, true);
      window.removeEventListener('resize', updateFromViewport);
    };
  }, [editor, activePopover?.annotationId]);

  useEffect(() => {
    if (!activePopover) {
      anchorRangeRef.current = null;
    }
  }, [activePopover]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearHideTimeout();
      anchorRangeRef.current = null;
    };
  }, [clearHideTimeout]);

  return {
    isOpen,
    activeAnnotationId: activePopover?.annotationId ?? null,
    isPinned: activePopover?.isPinned ?? false,
    show,
    hide,
    toggle,
    pin,
    unpin,
    handlePopoverRequest,
  };
}

export default useAnnotationPopover;
