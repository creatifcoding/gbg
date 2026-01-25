/**
 * useIntentExecution Hook
 *
 * Wires IntentExecutor to TipTap editor events.
 * Handles click, hover, and keyboard activation of intent marks.
 *
 * @module editor/v3/extensions/annotations/hooks/useIntentExecution
 */

import { useCallback, useEffect, useRef } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import { Effect, Layer } from 'effect';
import type { Editor } from '@tiptap/core';

import {
  IntentExecutor,
  IntentExecutorLive,
  IntentRegistry,
  IntentRegistryLive,
  registerBuiltinActions,
  type ExecutorHandlers,
  type PopoverRequest,
  type NavigationRequest,
} from '../services';
import { AnnotationService, AnnotationServiceLive } from '../services';
import { annotationRuntimeAtom, hoveredAnnotationIdAtom, selectionOps } from '../atoms';
import type { AnnotationId, IntentMark } from '../schemas';

// =============================================================================
// Types
// =============================================================================

export interface UseIntentExecutionOptions {
  /** TipTap editor instance */
  editor: Editor | null;

  /** Called when popover should be shown */
  onPopoverRequest?: (request: PopoverRequest) => void;

  /** Called when navigation is requested */
  onNavigationRequest?: (request: NavigationRequest) => void;

  /** Called when execution starts */
  onExecutionStart?: (markId: AnnotationId, intentType: string) => void;

  /** Called when execution completes */
  onExecutionComplete?: (markId: AnnotationId, success: boolean, error?: unknown) => void;

  /** Hover delay in ms before triggering hover intent */
  hoverDelay?: number;

  /** Whether to register built-in actions */
  registerBuiltins?: boolean;
}

export interface UseIntentExecutionReturn {
  /** Manually trigger intent execution for a mark */
  execute: (markId: AnnotationId, trigger: 'click' | 'hover' | 'keyboard') => Promise<void>;

  /** Cancel a running execution */
  cancel: (markId: AnnotationId) => Promise<boolean>;

  /** Cancel all running executions */
  cancelAll: () => Promise<number>;

  /** Register a custom action */
  registerAction: (action: {
    key: string;
    name: string;
    description?: string;
    program: (ctx: { annotationId: AnnotationId; params: unknown }) => Effect.Effect<void>;
  }) => Promise<void>;
}

// =============================================================================
// Combined Layer
// =============================================================================

const IntentSystemLive = Layer.mergeAll(
  AnnotationServiceLive,
  IntentRegistryLive,
  IntentExecutorLive
);

// =============================================================================
// Hook Implementation
// =============================================================================

export function useIntentExecution(
  options: UseIntentExecutionOptions
): UseIntentExecutionReturn {
  const {
    editor,
    onPopoverRequest,
    onNavigationRequest,
    onExecutionStart,
    onExecutionComplete,
    hoverDelay = 300,
    registerBuiltins = true,
  } = options;

  // Track hover timeout
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveredIdRef = useRef<AnnotationId | null>(null);

  // Track initialization
  const initializedRef = useRef(false);

  // Initialize executor handlers and builtins
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const handlers: ExecutorHandlers = {
      onPopoverRequest,
      onNavigationRequest,
      onExecutionStart,
      onExecutionComplete: (markId, result) => {
        onExecutionComplete?.(markId, result.success, result.error);
      },
    };

    // Set handlers and register builtins
    const setup = Effect.gen(function* () {
      const executor = yield* IntentExecutor;
      yield* executor.setHandlers(handlers);

      if (registerBuiltins) {
        yield* registerBuiltinActions;
      }
    });

    Effect.runPromise(Effect.provide(setup, IntentSystemLive)).catch(console.error);
  }, [onPopoverRequest, onNavigationRequest, onExecutionStart, onExecutionComplete, registerBuiltins]);

  // Handle mark click
  const handleMarkClick = useCallback(
    (markId: AnnotationId, event: MouseEvent) => {
      // Clear any hover timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }

      const executeClick = Effect.gen(function* () {
        const executor = yield* IntentExecutor;
        yield* executor.executeById(markId, 'click', event);
      });

      Effect.runPromise(Effect.provide(executeClick, IntentSystemLive)).catch(console.error);
    },
    []
  );

  // Handle mark hover enter
  const handleMarkHoverEnter = useCallback(
    (markId: AnnotationId, event: MouseEvent) => {
      // Update hovered state
      selectionOps.hover(markId);
      hoveredIdRef.current = markId;

      // Set timeout for hover intent
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }

      hoverTimeoutRef.current = setTimeout(() => {
        // Only execute if still hovering the same mark
        if (hoveredIdRef.current === markId) {
          const executeHover = Effect.gen(function* () {
            const executor = yield* IntentExecutor;
            const annotationService = yield* AnnotationService;

            // Check if this mark has a hover-triggered intent
            const mark = yield* annotationService.findMark(markId);
            if (mark._tag === 'Some') {
              const intent = mark.value.intent;
              // Only auto-trigger for hover-friendly intents
              if (
                intent._tag === 'Popover' ||
                intent._tag === 'Note' ||
                (intent._tag === 'Popover' && intent.interaction === 'hover')
              ) {
                yield* executor.executeById(markId, 'hover', event);
              }
            }
          });

          Effect.runPromise(Effect.provide(executeHover, IntentSystemLive)).catch(console.error);
        }
      }, hoverDelay);
    },
    [hoverDelay]
  );

  // Handle mark hover leave
  const handleMarkHoverLeave = useCallback(
    (markId: AnnotationId) => {
      // Clear hover state
      if (hoveredIdRef.current === markId) {
        selectionOps.hover(null);
        hoveredIdRef.current = null;
      }

      // Clear hover timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
    },
    []
  );

  // NOTE: Editor-level event listeners for hover/click have been DISABLED.
  // IntentMarkView now handles all hover/click events directly on the mark elements,
  // and AnnotationPopover uses safePolygon for hover-to-popover traversal.
  //
  // This hook's execute/cancel/registerAction APIs are still available for
  // programmatic intent execution.
  //
  // If you need editor-level event handling (e.g., for keyboard navigation),
  // add it here but DO NOT add mouseover/mouseout handlers - they conflict
  // with IntentMarkView's handlers and safePolygon.
  useEffect(() => {
    return () => {
      // Clean up timeout on unmount
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Public API
  const execute = useCallback(
    async (markId: AnnotationId, trigger: 'click' | 'hover' | 'keyboard') => {
      const executeIntent = Effect.gen(function* () {
        const executor = yield* IntentExecutor;
        yield* executor.executeById(markId, trigger);
      });

      await Effect.runPromise(Effect.provide(executeIntent, IntentSystemLive));
    },
    []
  );

  const cancel = useCallback(async (markId: AnnotationId) => {
    const cancelIntent = Effect.gen(function* () {
      const executor = yield* IntentExecutor;
      return yield* executor.cancel(markId);
    });

    return Effect.runPromise(Effect.provide(cancelIntent, IntentSystemLive));
  }, []);

  const cancelAll = useCallback(async () => {
    const cancelAllIntents = Effect.gen(function* () {
      const executor = yield* IntentExecutor;
      return yield* executor.cancelAll;
    });

    return Effect.runPromise(Effect.provide(cancelAllIntents, IntentSystemLive));
  }, []);

  const registerAction = useCallback(
    async (action: {
      key: string;
      name: string;
      description?: string;
      program: (ctx: { annotationId: AnnotationId; params: unknown }) => Effect.Effect<void>;
    }) => {
      const register = Effect.gen(function* () {
        const registry = yield* IntentRegistry;
        yield* registry.register({
          key: action.key,
          name: action.name,
          description: action.description,
          program: (ctx) => action.program({ annotationId: ctx.annotationId, params: ctx.params }),
        });
      });

      await Effect.runPromise(Effect.provide(register, IntentSystemLive));
    },
    []
  );

  return {
    execute,
    cancel,
    cancelAll,
    registerAction,
  };
}

export default useIntentExecution;
