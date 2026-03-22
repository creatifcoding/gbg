/**
 * IntentExecutor Service
 *
 * Executes intents based on their type. Each intent execution
 * runs in its own fiber for isolation and cancellation.
 *
 * Intent Types:
 * - Hyperlink: Opens external URL
 * - Ultralink: Navigates to document/annotation
 * - Popover: Triggers popover display (emits event)
 * - Action: Runs registered Effect program
 * - Citation: Shows citation popover
 * - Note: Shows note popover
 *
 * @module editor/v3/extensions/annotations/services/IntentExecutor
 */

import { Effect, Context, Layer, Fiber, Option, Ref, HashMap } from 'effect';
import {
  type AnnotationId,
  type IntentPayload,
  type IntentMark,
  isHyperlink,
  isUltralink,
  isPopover,
  isAction,
  isCitation,
  isNote,
  IntentExecutionError,
  IntentNotRegistered,
} from '../schemas';
import { IntentRegistry, type ActionContext } from './IntentRegistry';
import { AnnotationService } from './AnnotationService';

// =============================================================================
// Types
// =============================================================================

/**
 * Execution context for intent dispatch
 */
export interface ExecutionContext {
  /** The mark being activated */
  readonly mark: IntentMark;

  /** How the intent was triggered */
  readonly trigger: 'click' | 'hover' | 'keyboard' | 'programmatic';

  /** The triggering event (if available) */
  readonly event?: MouseEvent | KeyboardEvent;
}

/**
 * Result of intent execution
 */
export interface ExecutionResult {
  /** Whether execution succeeded */
  readonly success: boolean;

  /** Result value (if any) */
  readonly value?: unknown;

  /** Error (if failed) */
  readonly error?: unknown;

  /** Execution duration in ms */
  readonly durationMs: number;
}

/**
 * Popover request emitted when popover intent is triggered
 */
export interface PopoverRequest {
  /** The annotation to show popover for */
  readonly annotationId: AnnotationId;

  /** The mark that triggered the popover */
  readonly markId: AnnotationId;

  /** Trigger position (for positioning) */
  readonly position?: { x: number; y: number };

  /** How it was triggered */
  readonly trigger: 'hover' | 'click';
}

/**
 * Navigation request for ultralinks
 */
export interface NavigationRequest {
  /** Target document ID (if cross-document) */
  readonly documentId?: string;

  /** Target annotation ID (if linking to specific annotation) */
  readonly annotationId?: string;

  /** Anchor within document */
  readonly anchor?: string;
}

/**
 * Event handlers for executor side effects
 */
export interface ExecutorHandlers {
  /** Called when a popover should be shown */
  readonly onPopoverRequest?: (request: PopoverRequest) => void;

  /** Called when navigation is requested */
  readonly onNavigationRequest?: (request: NavigationRequest) => void;

  /** Called when execution starts */
  readonly onExecutionStart?: (markId: AnnotationId, intentType: string) => void;

  /** Called when execution completes */
  readonly onExecutionComplete?: (markId: AnnotationId, result: ExecutionResult) => void;
}

// =============================================================================
// Service Interface
// =============================================================================

export interface IntentExecutorShape {
  /**
   * Execute an intent from a mark
   */
  readonly execute: (context: ExecutionContext) => Effect.Effect<ExecutionResult, IntentExecutionError>;

  /**
   * Execute by annotation ID (looks up mark first)
   */
  readonly executeById: (
    id: AnnotationId,
    trigger: ExecutionContext['trigger'],
    event?: MouseEvent | KeyboardEvent
  ) => Effect.Effect<ExecutionResult, IntentExecutionError>;

  /**
   * Set event handlers
   */
  readonly setHandlers: (handlers: ExecutorHandlers) => Effect.Effect<void>;

  /**
   * Get currently running fibers (for debugging/cancellation)
   */
  readonly getRunningFibers: Effect.Effect<readonly AnnotationId[]>;

  /**
   * Cancel a running intent execution
   */
  readonly cancel: (markId: AnnotationId) => Effect.Effect<boolean>;

  /**
   * Cancel all running executions
   */
  readonly cancelAll: Effect.Effect<number>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class IntentExecutor extends Context.Tag('tmnl/editor/IntentExecutor')<
  IntentExecutor,
  IntentExecutorShape
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

const makeIntentExecutor = Effect.gen(function* () {
  // Running fibers by mark ID
  const fibersRef = yield* Ref.make<HashMap.HashMap<AnnotationId, Fiber.RuntimeFiber<ExecutionResult, IntentExecutionError>>>(
    HashMap.empty()
  );

  // Event handlers
  const handlersRef = yield* Ref.make<ExecutorHandlers>({});

  // Get handlers
  const getHandlers = Ref.get(handlersRef);

  /**
   * Execute a hyperlink intent
   */
  const executeHyperlink = (
    mark: IntentMark,
    intent: IntentPayload & { _tag: 'Hyperlink' }
  ): Effect.Effect<ExecutionResult> =>
    Effect.sync(() => {
      const start = performance.now();
      const target = intent.target ?? '_blank';

      if (target === '_blank') {
        window.open(intent.href, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = intent.href;
      }

      return {
        success: true,
        durationMs: performance.now() - start,
      };
    });

  /**
   * Execute an ultralink intent
   */
  const executeUltralink = (
    mark: IntentMark,
    intent: IntentPayload & { _tag: 'Ultralink' },
    handlers: ExecutorHandlers
  ): Effect.Effect<ExecutionResult> =>
    Effect.sync(() => {
      const start = performance.now();

      if (handlers.onNavigationRequest) {
        handlers.onNavigationRequest({
          documentId: Option.getOrUndefined(intent.documentId),
          annotationId: Option.getOrUndefined(intent.annotationId),
          anchor: Option.getOrUndefined(intent.anchor),
        });
      }

      return {
        success: true,
        durationMs: performance.now() - start,
      };
    });

  /**
   * Execute a popover intent
   */
  const executePopover = (
    mark: IntentMark,
    intent: IntentPayload & { _tag: 'Popover' },
    trigger: ExecutionContext['trigger'],
    handlers: ExecutorHandlers,
    event?: MouseEvent | KeyboardEvent
  ): Effect.Effect<ExecutionResult> =>
    Effect.sync(() => {
      const start = performance.now();

      if (handlers.onPopoverRequest) {
        const position = event && 'clientX' in event
          ? { x: event.clientX, y: event.clientY }
          : undefined;

        handlers.onPopoverRequest({
          annotationId: intent.annotationId,
          markId: mark.id,
          position,
          trigger: trigger === 'hover' ? 'hover' : 'click',
        });
      }

      return {
        success: true,
        durationMs: performance.now() - start,
      };
    });

  /**
   * Execute an action intent
   */
  const executeAction = (
    mark: IntentMark,
    intent: IntentPayload & { _tag: 'Action' },
    event?: MouseEvent | KeyboardEvent
  ): Effect.Effect<ExecutionResult, IntentExecutionError | IntentNotRegistered> =>
    Effect.gen(function* () {
      const start = performance.now();
      const registry = yield* IntentRegistry;

      // Look up the registered action
      const action = yield* registry.get(intent.registryKey);

      // Build action context
      const actionContext: ActionContext = {
        annotationId: mark.id,
        registryKey: intent.registryKey,
        params: Option.getOrUndefined(intent.params),
        event,
      };

      // Execute the program
      const result = yield* Effect.try({
        try: () => action.program(actionContext),
        catch: (error) => IntentExecutionError.of(mark.id, 'Action', error),
      }).pipe(
        Effect.flatten,
        Effect.catchAll((error) =>
          Effect.succeed({ success: false, error, durationMs: performance.now() - start })
        )
      );

      if (typeof result === 'object' && result !== null && 'success' in result) {
        return result as ExecutionResult;
      }

      return {
        success: true,
        value: result,
        durationMs: performance.now() - start,
      };
    });

  /**
   * Execute a citation intent (shows popover with citation info)
   */
  const executeCitation = (
    mark: IntentMark,
    intent: IntentPayload & { _tag: 'Citation' },
    handlers: ExecutorHandlers,
    event?: MouseEvent | KeyboardEvent
  ): Effect.Effect<ExecutionResult> =>
    Effect.sync(() => {
      const start = performance.now();

      if (handlers.onPopoverRequest) {
        const position = event && 'clientX' in event
          ? { x: event.clientX, y: event.clientY }
          : undefined;

        handlers.onPopoverRequest({
          annotationId: intent.annotationId,
          markId: mark.id,
          position,
          trigger: 'click',
        });
      }

      return {
        success: true,
        durationMs: performance.now() - start,
      };
    });

  /**
   * Execute a note intent (shows note popover)
   */
  const executeNote = (
    mark: IntentMark,
    intent: IntentPayload & { _tag: 'Note' },
    handlers: ExecutorHandlers,
    event?: MouseEvent | KeyboardEvent
  ): Effect.Effect<ExecutionResult> =>
    Effect.sync(() => {
      const start = performance.now();

      if (handlers.onPopoverRequest) {
        const position = event && 'clientX' in event
          ? { x: event.clientX, y: event.clientY }
          : undefined;

        handlers.onPopoverRequest({
          annotationId: intent.annotationId,
          markId: mark.id,
          position,
          trigger: 'hover',
        });
      }

      return {
        success: true,
        durationMs: performance.now() - start,
      };
    });

  /**
   * Main execution dispatcher
   */
  const execute: IntentExecutorShape['execute'] = (context) =>
    Effect.gen(function* () {
      const { mark, trigger, event } = context;
      const intent = mark.intent;
      const handlers = yield* getHandlers;

      // Notify start
      if (handlers.onExecutionStart) {
        handlers.onExecutionStart(mark.id, intent._tag);
      }

      // Dispatch based on intent type
      let result: ExecutionResult;

      try {
        if (isHyperlink(intent)) {
          result = yield* executeHyperlink(mark, intent);
        } else if (isUltralink(intent)) {
          result = yield* executeUltralink(mark, intent, handlers);
        } else if (isPopover(intent)) {
          result = yield* executePopover(mark, intent, trigger, handlers, event);
        } else if (isAction(intent)) {
          result = yield* executeAction(mark, intent, event).pipe(
            Effect.catchTag('IntentNotRegistered', (error) =>
              Effect.succeed({
                success: false,
                error,
                durationMs: 0,
              })
            )
          );
        } else if (isCitation(intent)) {
          result = yield* executeCitation(mark, intent, handlers, event);
        } else if (isNote(intent)) {
          result = yield* executeNote(mark, intent, handlers, event);
        } else {
          // Exhaustive check
          const _exhaustive: never = intent;
          result = {
            success: false,
            error: new Error(`Unknown intent type: ${(intent as any)._tag}`),
            durationMs: 0,
          };
        }
      } catch (error) {
        result = {
          success: false,
          error,
          durationMs: 0,
        };
      }

      // Notify complete
      if (handlers.onExecutionComplete) {
        handlers.onExecutionComplete(mark.id, result);
      }

      return result;
    }).pipe(
      Effect.catchAll((error) =>
        Effect.fail(IntentExecutionError.of(context.mark.id, context.mark.intentType, error))
      )
    );

  /**
   * Execute by ID (looks up mark first)
   */
  const executeById: IntentExecutorShape['executeById'] = (id, trigger, event) =>
    Effect.gen(function* () {
      const annotationService = yield* AnnotationService;
      const mark = yield* annotationService.getMark(id).pipe(
        Effect.mapError((error) => IntentExecutionError.of(id, 'unknown', error))
      );

      // Fork execution to a fiber for isolation
      const fiber = yield* Effect.fork(
        execute({ mark, trigger, event })
      );

      // Track the fiber
      yield* Ref.update(fibersRef, (fibers) => HashMap.set(fibers, id, fiber));

      // Wait for result and clean up
      const result = yield* Fiber.join(fiber);

      yield* Ref.update(fibersRef, (fibers) => HashMap.remove(fibers, id));

      return result;
    });

  const setHandlers: IntentExecutorShape['setHandlers'] = (handlers) =>
    Ref.set(handlersRef, handlers);

  const getRunningFibers: IntentExecutorShape['getRunningFibers'] = Effect.gen(function* () {
    const fibers = yield* Ref.get(fibersRef);
    return Array.from(HashMap.keys(fibers));
  });

  const cancel: IntentExecutorShape['cancel'] = (markId) =>
    Effect.gen(function* () {
      const fibers = yield* Ref.get(fibersRef);
      const fiber = HashMap.get(fibers, markId);

      if (Option.isNone(fiber)) {
        return false;
      }

      yield* Fiber.interrupt(fiber.value);
      yield* Ref.update(fibersRef, (f) => HashMap.remove(f, markId));

      return true;
    });

  const cancelAll: IntentExecutorShape['cancelAll'] = Effect.gen(function* () {
    const fibers = yield* Ref.get(fibersRef);
    const fiberList = Array.from(HashMap.values(fibers));

    yield* Effect.forEach(fiberList, (fiber) => Fiber.interrupt(fiber), {
      concurrency: 'unbounded',
    });

    yield* Ref.set(fibersRef, HashMap.empty());

    return fiberList.length;
  });

  return {
    execute,
    executeById,
    setHandlers,
    getRunningFibers,
    cancel,
    cancelAll,
  } satisfies IntentExecutorShape;
});

// =============================================================================
// Layer
// =============================================================================

export const IntentExecutorLive = Layer.effect(IntentExecutor, makeIntentExecutor);

export default IntentExecutor;
