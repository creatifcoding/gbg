/**
 * useAnnotations Hook
 *
 * Combined hook that wires all annotation system components together:
 * - Intent execution (click/hover/keyboard on marks)
 * - Popover display (automatic wiring)
 * - Navigation handling
 *
 * This is the primary hook for integrating the annotation system.
 *
 * @example
 * ```tsx
 * function EditorWithAnnotations({ editor }) {
 *   const annotations = useAnnotations({
 *     editor,
 *     onNavigate: (req) => router.push(req.documentId),
 *   });
 *
 *   return (
 *     <>
 *       <EditorContent editor={editor} />
 *       <AnnotationPopover />
 *     </>
 *   );
 * }
 * ```
 *
 * @module editor/v3/extensions/annotations/hooks/useAnnotations
 */

import { useCallback, useMemo } from 'react';
import type { Editor } from '@tiptap/core';

import { useIntentExecution, type UseIntentExecutionReturn } from './useIntentExecution';
import { useAnnotationPopover, type UseAnnotationPopoverReturn } from './useAnnotationPopover';
import type { NavigationRequest, PopoverRequest } from '../services';
import type { AnnotationId } from '../schemas';

// =============================================================================
// Types
// =============================================================================

export interface UseAnnotationsOptions {
  /** TipTap editor instance */
  editor: Editor | null;

  /** Called when navigation is requested (ultralinks) */
  onNavigate?: (request: NavigationRequest) => void;

  /** Called when intent execution starts */
  onExecutionStart?: (markId: AnnotationId, intentType: string) => void;

  /** Called when intent execution completes */
  onExecutionComplete?: (markId: AnnotationId, success: boolean, error?: unknown) => void;

  /** Whether to show popovers on hover (default: true) */
  showPopoverOnHover?: boolean;

  /** Whether to show popovers on click (default: true) */
  showPopoverOnClick?: boolean;

  /** Hover delay before showing popover (ms, default: 300) */
  hoverDelay?: number;

  /** Delay before hiding popover on hover out (ms, default: 200) */
  hideDelay?: number;

  /** Whether to register built-in actions (default: true) */
  registerBuiltins?: boolean;
}

export interface UseAnnotationsReturn {
  /** Intent execution controls */
  intent: UseIntentExecutionReturn;

  /** Popover controls */
  popover: UseAnnotationPopoverReturn;

  /** Manually trigger intent execution for a mark */
  execute: (markId: AnnotationId, trigger: 'click' | 'hover' | 'keyboard') => Promise<void>;

  /** Show popover for an annotation */
  showPopover: (request: PopoverRequest) => void;

  /** Hide the active popover */
  hidePopover: () => void;

  /** Pin the active popover */
  pinPopover: () => void;

  /** Register a custom action */
  registerAction: UseIntentExecutionReturn['registerAction'];
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useAnnotations(options: UseAnnotationsOptions): UseAnnotationsReturn {
  const {
    editor,
    onNavigate,
    onExecutionStart,
    onExecutionComplete,
    showPopoverOnHover = true,
    showPopoverOnClick = true,
    hoverDelay = 300,
    hideDelay = 200,
    registerBuiltins = true,
  } = options;

  // Initialize popover hook first (we need handlePopoverRequest)
  const popover = useAnnotationPopover({
    editor,
    hideDelay,
    showOnHover: showPopoverOnHover,
    showOnClick: showPopoverOnClick,
  });

  // Wire intent execution to popover system
  const intent = useIntentExecution({
    editor,
    onPopoverRequest: popover.handlePopoverRequest,
    onNavigationRequest: onNavigate,
    onExecutionStart,
    onExecutionComplete,
    hoverDelay,
    registerBuiltins,
  });

  // Convenience methods
  const execute = useCallback(
    async (markId: AnnotationId, trigger: 'click' | 'hover' | 'keyboard') => {
      await intent.execute(markId, trigger);
    },
    [intent]
  );

  const showPopover = useCallback(
    (request: PopoverRequest) => {
      popover.show(request);
    },
    [popover]
  );

  const hidePopover = useCallback(() => {
    popover.hide();
  }, [popover]);

  const pinPopover = useCallback(() => {
    popover.pin();
  }, [popover]);

  return useMemo(
    () => ({
      intent,
      popover,
      execute,
      showPopover,
      hidePopover,
      pinPopover,
      registerAction: intent.registerAction,
    }),
    [intent, popover, execute, showPopover, hidePopover, pinPopover]
  );
}

export default useAnnotations;
