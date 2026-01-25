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
import type { Editor } from '@tiptap/core';

import { popoverOps, activePopoverAtom, isPopoverOpenAtom } from '../atoms';
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
// Hook Implementation
// =============================================================================

export function useAnnotationPopover(
  options: UseAnnotationPopoverOptions
): UseAnnotationPopoverReturn {
  const { editor, hideDelay = 200, showOnHover = true, showOnClick = true } = options;

  const isOpen = useAtomValue(isPopoverOpenAtom);
  const activePopover = useAtomValue(activePopoverAtom);

  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentMarkElementRef = useRef<HTMLElement | null>(null);

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

  // Get element anchor from mark ID
  const getElementAnchor = useCallback(
    (markId: AnnotationId) => {
      if (!editor) return null;

      const element = editor.view.dom.querySelector(
        `[data-annotation-id="${markId}"]`
      ) as HTMLElement | null;

      if (!element) return null;

      currentMarkElementRef.current = element;

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

      if (!anchor) return;

      popoverOps.show({
        annotationId: request.annotationId,
        markId: request.markId,
        anchor,
        placement: 'top',
        trigger: request.trigger,
      });
    },
    [clearHideTimeout, getVirtualAnchor, getElementAnchor]
  );

  // Hide popover with optional delay
  const hide = useCallback(() => {
    // Don't hide if pinned
    if (activePopover?.isPinned) return;

    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      popoverOps.hide();
    }, hideDelay);
  }, [activePopover?.isPinned, clearHideTimeout, hideDelay]);

  // Toggle popover
  const toggle = useCallback(
    (request: PopoverRequest) => {
      if (isOpen && activePopover?.annotationId === request.annotationId) {
        popoverOps.hide();
      } else {
        show(request);
      }
    },
    [isOpen, activePopover?.annotationId, show]
  );

  // Pin popover
  const pin = useCallback(() => {
    clearHideTimeout();
    popoverOps.pin();
  }, [clearHideTimeout]);

  // Unpin popover
  const unpin = useCallback(() => {
    popoverOps.unpin();
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

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearHideTimeout();
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
