/**
 * IntentRegistry Service
 *
 * Registry for Action intent programs. Action intents reference
 * registered Effect programs by key, enabling extensible behavior.
 *
 * Pattern:
 * - Register Effect programs with unique keys
 * - Action intents store registryKey + params
 * - IntentExecutor looks up and runs programs
 *
 * @module editor/v3/extensions/annotations/services/IntentRegistry
 */

import { Effect, Context, Layer, Ref, Option, HashMap } from 'effect';
import type { AnnotationId } from '../schemas';
import { IntentNotRegistered } from '../schemas';

// =============================================================================
// Types
// =============================================================================

/**
 * Context passed to action programs
 */
export interface ActionContext {
  /** The annotation ID that triggered this action */
  readonly annotationId: AnnotationId;

  /** The registry key used to invoke this action */
  readonly registryKey: string;

  /** Parameters passed from the intent */
  readonly params: unknown;

  /** The triggering event (if available) */
  readonly event?: MouseEvent | KeyboardEvent;
}

/**
 * An action program is an Effect that receives ActionContext
 *
 * Programs can:
 * - Return a value (success)
 * - Fail with an error
 * - Perform side effects
 * - Access other services via Effect.Service
 */
export type ActionProgram<R = never, E = never, A = void> = (
  context: ActionContext
) => Effect.Effect<A, E, R>;

/**
 * Registered action with metadata
 */
export interface RegisteredAction {
  /** Unique key for this action */
  readonly key: string;

  /** Human-readable name */
  readonly name: string;

  /** Description for UI/documentation */
  readonly description?: string;

  /** The Effect program to execute */
  readonly program: ActionProgram<any, any, any>;

  /** Icon identifier for UI */
  readonly icon?: string;

  /** Keyboard shortcut hint */
  readonly shortcut?: string;
}

// =============================================================================
// Service Interface
// =============================================================================

export interface IntentRegistryShape {
  /**
   * Register an action program
   */
  readonly register: (action: RegisteredAction) => Effect.Effect<void>;

  /**
   * Unregister an action by key
   */
  readonly unregister: (key: string) => Effect.Effect<void>;

  /**
   * Get a registered action by key
   */
  readonly get: (key: string) => Effect.Effect<RegisteredAction, IntentNotRegistered>;

  /**
   * Get a registered action (returns Option)
   */
  readonly find: (key: string) => Effect.Effect<Option.Option<RegisteredAction>>;

  /**
   * Check if an action is registered
   */
  readonly has: (key: string) => Effect.Effect<boolean>;

  /**
   * Get all registered actions
   */
  readonly getAll: Effect.Effect<readonly RegisteredAction[]>;

  /**
   * Get action keys
   */
  readonly keys: Effect.Effect<readonly string[]>;

  /**
   * Clear all registrations (for testing)
   */
  readonly clear: Effect.Effect<void>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class IntentRegistry extends Context.Tag('tmnl/editor/IntentRegistry')<
  IntentRegistry,
  IntentRegistryShape
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

const makeIntentRegistry = Effect.gen(function* () {
  // Registry state
  const registryRef = yield* Ref.make<HashMap.HashMap<string, RegisteredAction>>(
    HashMap.empty()
  );

  const register: IntentRegistryShape['register'] = (action) =>
    Ref.update(registryRef, (registry) => HashMap.set(registry, action.key, action));

  const unregister: IntentRegistryShape['unregister'] = (key) =>
    Ref.update(registryRef, (registry) => HashMap.remove(registry, key));

  const get: IntentRegistryShape['get'] = (key) =>
    Effect.gen(function* () {
      const registry = yield* Ref.get(registryRef);
      const action = HashMap.get(registry, key);

      if (Option.isNone(action)) {
        return yield* Effect.fail(IntentNotRegistered.of(key));
      }

      return action.value;
    });

  const find: IntentRegistryShape['find'] = (key) =>
    Effect.gen(function* () {
      const registry = yield* Ref.get(registryRef);
      return HashMap.get(registry, key);
    });

  const has: IntentRegistryShape['has'] = (key) =>
    Effect.gen(function* () {
      const registry = yield* Ref.get(registryRef);
      return HashMap.has(registry, key);
    });

  const getAll: IntentRegistryShape['getAll'] = Effect.gen(function* () {
    const registry = yield* Ref.get(registryRef);
    return HashMap.values(registry).pipe((iter) => Array.from(iter));
  });

  const keys: IntentRegistryShape['keys'] = Effect.gen(function* () {
    const registry = yield* Ref.get(registryRef);
    return HashMap.keys(registry).pipe((iter) => Array.from(iter));
  });

  const clear: IntentRegistryShape['clear'] = Ref.set(registryRef, HashMap.empty());

  return {
    register,
    unregister,
    get,
    find,
    has,
    getAll,
    keys,
    clear,
  } satisfies IntentRegistryShape;
});

// =============================================================================
// Layer
// =============================================================================

export const IntentRegistryLive = Layer.effect(IntentRegistry, makeIntentRegistry);

// =============================================================================
// Built-in Actions
// =============================================================================

/**
 * Built-in action: Copy text to clipboard
 */
export const copyToClipboardAction: RegisteredAction = {
  key: 'builtin:copy-to-clipboard',
  name: 'Copy to Clipboard',
  description: 'Copy the annotated text to clipboard',
  icon: 'clipboard',
  program: (ctx) =>
    Effect.gen(function* () {
      const text = ctx.params as string | undefined;
      if (text) {
        yield* Effect.promise(() => navigator.clipboard.writeText(text));
      }
    }),
};

/**
 * Built-in action: Log to console (for debugging)
 */
export const logAction: RegisteredAction = {
  key: 'builtin:log',
  name: 'Log',
  description: 'Log annotation details to console',
  icon: 'terminal',
  program: (ctx) =>
    Effect.sync(() => {
      console.log('[IntentRegistry] Action triggered:', {
        annotationId: ctx.annotationId,
        registryKey: ctx.registryKey,
        params: ctx.params,
      });
    }),
};

/**
 * Built-in action: Open URL in new tab
 */
export const openUrlAction: RegisteredAction = {
  key: 'builtin:open-url',
  name: 'Open URL',
  description: 'Open a URL in a new browser tab',
  icon: 'external-link',
  program: (ctx) =>
    Effect.sync(() => {
      const url = ctx.params as string | undefined;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }),
};

/**
 * Register all built-in actions
 */
export const registerBuiltinActions = Effect.gen(function* () {
  const registry = yield* IntentRegistry;
  yield* registry.register(copyToClipboardAction);
  yield* registry.register(logAction);
  yield* registry.register(openUrlAction);
});

export default IntentRegistry;
