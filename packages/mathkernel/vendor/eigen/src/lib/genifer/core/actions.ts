/**
 * @fileoverview Action execution system with Effect
 *
 * Uses:
 * - Deferred for confirmation dialogs (pauses execution)
 * - Fiber for cancellable action handlers
 * - Ref for action state management
 * - PubSub for broadcasting action results
 * - Schema.decode for validating action input
 *
 * ALL methods return Effects - no sneaky sync operations!
 */

import {
  Effect,
  Deferred,
  Fiber,
  Ref,
  PubSub,
  Queue,
  Option,
  Exit,
  Cause,
  Data,
  pipe
} from "effect"
import type { Scope } from "effect"
import type {
  ActionConfirm,
  ActionOnSuccess,
  ActionOnError,
  DataModel
} from "./schemas"
import {
  Action,
  ActionConfirm as ActionConfirmClass,
  ResolvedAction,
  NavigateHandler,
  SetDataHandler,
  ChainActionHandler,
  decodeAction
} from "./schemas"
import { resolveDynamicValue, interpolateString } from "./path"

// =============================================================================
// Errors (using Data.TaggedError for proper Effect integration)
// =============================================================================

export class ActionNotFoundError extends Data.TaggedError("ActionNotFoundError")<{
  readonly name: string
}> {}

export class ActionExecutionError extends Data.TaggedError("ActionExecutionError")<{
  readonly name: string
  readonly cause: unknown
}> {}

export class ActionCancelledError extends Data.TaggedError("ActionCancelledError")<{
  readonly name: string
}> {}

export class ActionValidationError extends Data.TaggedError("ActionValidationError")<{
  readonly message: string
  readonly cause: unknown
}> {}

// =============================================================================
// Types
// =============================================================================

/** Action handler function signature - MUST return Effect */
export type ActionHandler<TParams = Record<string, unknown>, TResult = unknown> =
  (params: TParams) => Effect.Effect<TResult, unknown>

// Re-export ResolvedAction (Schema.Class from ./schemas)
export { ResolvedAction }

/** Action execution result */
export type ActionResult =
  | { readonly _tag: "Success"; readonly name: string; readonly result: unknown }
  | { readonly _tag: "Failure"; readonly name: string; readonly error: unknown }
  | { readonly _tag: "Cancelled"; readonly name: string }

/** Action state for tracking */
export interface ActionState {
  readonly pendingConfirmation: Option.Option<{
    readonly action: ResolvedAction
    readonly deferred: Deferred.Deferred<boolean>
  }>
  readonly runningFibers: ReadonlyMap<string, Fiber.RuntimeFiber<unknown, unknown>>
  readonly executionCount: number
}

// =============================================================================
// Action Resolution (Effectual!)
// =============================================================================

/**
 * Resolve all dynamic values in an action - returns Effect
 *
 * Uses Option.match with spread for idiomatic optional property handling
 */
export const resolveAction = (
  action: Action,
  dataModel: DataModel
): Effect.Effect<ResolvedAction, never> =>
  Effect.gen(function* () {
    // Resolve params
    const paramEntries = action.params
      ? yield* Effect.all(
          Object.entries(action.params).map(([key, value]) =>
            pipe(
              resolveDynamicValue(value, dataModel),
              Effect.map((resolved) => [key, resolved] as const)
            )
          )
        )
      : []
    const resolvedParams = Object.fromEntries(paramEntries)

    // Resolve confirm if present (using Effect.when for conditional execution)
    const confirmOption = yield* pipe(
      Effect.all({
        message: interpolateString(action.confirm?.message ?? "", dataModel),
        title: interpolateString(action.confirm?.title ?? "", dataModel)
      }),
      Effect.map(({ message, title }) =>
        new ActionConfirmClass({
          ...action.confirm!,
          message,
          title
        })
      ),
      Effect.when(() => action.confirm !== undefined)
    )

    // Build result using Schema.Class constructor with idiomatic optional property spread
    return new ResolvedAction({
      name: action.name,
      params: resolvedParams,
      // Conditionally spread confirm property using Option.match
      ...Option.match(confirmOption, {
        onNone: () => ({}),
        onSome: (confirm) => ({ confirm })
      }),
      onSuccess: action.onSuccess,
      onError: action.onError
    })
  })

// =============================================================================
// Action Service (using Ref + PubSub + Deferred + Fiber)
// =============================================================================

export interface ActionServiceConfig {
  readonly handlers: Record<string, ActionHandler>
  readonly navigate?: (path: string) => Effect.Effect<void>
  readonly setData: (path: string, value: unknown) => Effect.Effect<void>
}

/**
 * Create an action execution service - returns Effect
 */
export const makeActionService = (config: ActionServiceConfig) =>
  Effect.gen(function* () {
    // State management via Ref
    const stateRef = yield* Ref.make<ActionState>({
      pendingConfirmation: Option.none(),
      runningFibers: new Map(),
      executionCount: 0
    })

    // PubSub for broadcasting action results
    const resultsPubSub = yield* PubSub.bounded<ActionResult>(16)

    // Queue for action requests (allows rate limiting / ordering)
    const actionQueue = yield* Queue.bounded<ResolvedAction>(32)

    /**
     * Request confirmation from user - suspends via Deferred
     */
    const requestConfirmation = (action: ResolvedAction): Effect.Effect<boolean, never> =>
      Effect.gen(function* () {
        const deferred = yield* Deferred.make<boolean>()

        yield* Ref.update(stateRef, (s) => ({
          ...s,
          pendingConfirmation: Option.some({ action, deferred })
        }))

        // Wait for user response (suspends fiber until confirmed/cancelled)
        const confirmed = yield* Deferred.await(deferred)

        // Clear pending confirmation
        yield* Ref.update(stateRef, (s) => ({
          ...s,
          pendingConfirmation: Option.none()
        }))

        return confirmed
      })

    /**
     * Confirm pending action (called by UI) - returns Effect
     */
    const confirm = (): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        if (Option.isSome(state.pendingConfirmation)) {
          yield* Deferred.succeed(state.pendingConfirmation.value.deferred, true)
        }
      })

    /**
     * Cancel pending action (called by UI) - returns Effect
     */
    const cancel = (): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        if (Option.isSome(state.pendingConfirmation)) {
          yield* Deferred.succeed(state.pendingConfirmation.value.deferred, false)
        }
      })

    /**
     * Handle success callback - returns Effect
     */
    const handleSuccess = (
      onSuccess: ActionOnSuccess,
      executeActionFn: (name: string) => Effect.Effect<void, ActionNotFoundError | ActionExecutionError | ActionCancelledError>
    ): Effect.Effect<void, ActionNotFoundError | ActionExecutionError | ActionCancelledError> =>
      Effect.gen(function* () {
        if (onSuccess instanceof NavigateHandler && config.navigate) {
          yield* config.navigate(onSuccess.navigate)
        } else if (onSuccess instanceof SetDataHandler) {
          for (const [path, value] of Object.entries(onSuccess.set)) {
            yield* config.setData(path, value)
          }
        } else if (onSuccess instanceof ChainActionHandler) {
          yield* executeActionFn(onSuccess.action)
        }
      })

    /**
     * Handle error callback - returns Effect
     */
    const handleError = (
      onError: ActionOnError,
      error: unknown,
      executeActionFn: (name: string) => Effect.Effect<void, ActionNotFoundError | ActionExecutionError | ActionCancelledError>
    ): Effect.Effect<void, ActionNotFoundError | ActionExecutionError | ActionCancelledError> =>
      Effect.gen(function* () {
        if (onError instanceof SetDataHandler) {
          for (const [path, value] of Object.entries(onError.set)) {
            // Replace $error.message with actual error
            const resolvedValue =
              typeof value === "string" && value === "$error.message"
                ? (error as Error).message
                : value
            yield* config.setData(path, resolvedValue)
          }
        } else if (onError instanceof ChainActionHandler) {
          yield* executeActionFn(onError.action)
        }
      })

    /**
     * Execute a resolved action - returns Effect
     */
    const executeResolved = (
      action: ResolvedAction
    ): Effect.Effect<void, ActionNotFoundError | ActionExecutionError | ActionCancelledError> =>
      Effect.gen(function* () {
        const handler = config.handlers[action.name]

        if (!handler) {
          return yield* Effect.fail(new ActionNotFoundError({ name: action.name }))
        }

        // Check if confirmation is needed
        if (action.confirm) {
          const confirmed = yield* requestConfirmation(action)
          if (!confirmed) {
            // Broadcast cancellation
            yield* PubSub.publish(resultsPubSub, {
              _tag: "Cancelled",
              name: action.name
            })
            return yield* Effect.fail(new ActionCancelledError({ name: action.name }))
          }
        }

        // Update execution count
        yield* Ref.update(stateRef, (s) => ({
          ...s,
          executionCount: s.executionCount + 1
        }))

        // Fork the action as a fiber for cancellation support
        const fiber = yield* Effect.fork(handler(action.params))

        // Track the fiber
        yield* Ref.update(stateRef, (s) => {
          const newFibers = new Map(s.runningFibers)
          newFibers.set(action.name, fiber)
          return { ...s, runningFibers: newFibers }
        })

        // Wait for completion
        const exit = yield* Fiber.await(fiber)

        // Remove fiber from tracking
        yield* Ref.update(stateRef, (s) => {
          const newFibers = new Map(s.runningFibers)
          newFibers.delete(action.name)
          return { ...s, runningFibers: newFibers }
        })

        // Handle result
        if (Exit.isSuccess(exit)) {
          yield* PubSub.publish(resultsPubSub, {
            _tag: "Success",
            name: action.name,
            result: exit.value
          })

          if (action.onSuccess) {
            yield* handleSuccess(action.onSuccess, (name) =>
              executeResolved(new ResolvedAction({ name, params: {} }))
            )
          }
        } else {
          const error = Cause.squash(exit.cause)

          yield* PubSub.publish(resultsPubSub, {
            _tag: "Failure",
            name: action.name,
            error
          })

          if (action.onError) {
            yield* handleError(action.onError, error, (name) =>
              executeResolved(new ResolvedAction({ name, params: {} }))
            )
          } else {
            return yield* Effect.fail(new ActionExecutionError({
              name: action.name,
              cause: error
            }))
          }
        }
      })

    /**
     * Execute an action (resolves and executes) - returns Effect
     */
    const execute = (
      action: Action,
      dataModel: DataModel
    ): Effect.Effect<void, ActionNotFoundError | ActionExecutionError | ActionCancelledError> =>
      Effect.gen(function* () {
        const resolved = yield* resolveAction(action, dataModel)
        yield* executeResolved(resolved)
      })

    /**
     * Execute from unknown input (validates with Schema!) - returns Effect
     */
    const executeUnknown = (
      input: unknown,
      dataModel: DataModel
    ): Effect.Effect<void, ActionNotFoundError | ActionExecutionError | ActionCancelledError | ActionValidationError> =>
      pipe(
        decodeAction(input),
        Effect.mapError((e) => new ActionValidationError({
          message: "Invalid action input",
          cause: e
        })),
        Effect.flatMap((action) => execute(action, dataModel))
      )

    /**
     * Cancel a running action by name - returns Effect
     */
    const cancelAction = (name: string): Effect.Effect<boolean, never> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const fiber = state.runningFibers.get(name)

        if (fiber) {
          yield* Fiber.interrupt(fiber)
          return true
        }

        return false
      })

    /**
     * Cancel all running actions - returns Effect
     */
    const cancelAll = (): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        for (const fiber of state.runningFibers.values()) {
          yield* Fiber.interrupt(fiber)
        }
      })

    /**
     * Subscribe to action results (requires Scope) - returns Effect
     */
    const subscribe = (): Effect.Effect<Queue.Dequeue<ActionResult>, never, Scope.Scope> =>
      PubSub.subscribe(resultsPubSub)

    /**
     * Get current state - returns Effect
     */
    const getState = (): Effect.Effect<ActionState, never> =>
      Ref.get(stateRef)

    /**
     * Get pending confirmation - returns Effect
     */
    const getPendingConfirmation = (): Effect.Effect<Option.Option<ResolvedAction>, never> =>
      pipe(
        Ref.get(stateRef),
        Effect.map((s) => Option.map(s.pendingConfirmation, (p) => p.action))
      )

    return {
      execute,
      executeUnknown,
      executeResolved,
      confirm,
      cancel,
      cancelAction,
      cancelAll,
      subscribe,
      getState,
      getPendingConfirmation,
      actionQueue,
      resultsPubSub
    }
  })

export type ActionService = Effect.Effect.Success<ReturnType<typeof makeActionService>>

// =============================================================================
// Action Helpers (Builder Pattern - returns Effects for Schema validation)
// =============================================================================

export const actionBuilder = {
  /** Create a simple action - returns Effect */
  simple: (name: string, params?: Record<string, unknown>): Effect.Effect<Action, never> =>
    Effect.succeed(new Action({ name, params: params as any })),

  /** Create an action with confirmation - returns Effect */
  withConfirm: (
    name: string,
    confirm: ActionConfirm,
    params?: Record<string, unknown>
  ): Effect.Effect<Action, never> =>
    Effect.succeed(new Action({ name, params: params as any, confirm })),

  /** Create an action with success handler - returns Effect */
  withSuccess: (
    name: string,
    onSuccess: ActionOnSuccess,
    params?: Record<string, unknown>
  ): Effect.Effect<Action, never> =>
    Effect.succeed(new Action({ name, params: params as any, onSuccess })),

  /** Create and validate from unknown input - returns Effect */
  fromUnknown: (input: unknown): Effect.Effect<Action, ActionValidationError> =>
    pipe(
      decodeAction(input),
      Effect.mapError((e) => new ActionValidationError({
        message: "Invalid action input",
        cause: e
      }))
    )
}
