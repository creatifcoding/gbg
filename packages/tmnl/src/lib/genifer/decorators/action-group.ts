/**
 * @actionGroup decorator family
 *
 * Classes with REAL methods that operate on atoms.
 * @state fields → Atom.make() instances (reactive, subscribable)
 * @action methods → read/write those atoms, call services, return Effects
 * @computed getters → derived atoms, auto-recalculate
 *
 * The class IS the atom store. Methods ARE the mutations.
 * React subscribes via useAtomValue. Everything is connected.
 *
 * Usage:
 *   @actionGroup('flight-search')
 *   class FlightSearch extends Schema.Class<FlightSearch>('FlightSearch')({
 *     query: Schema.optionalWith(Schema.String, { default: () => '' }),
 *     results: Schema.optionalWith(Schema.Array(FlightSchema), { default: () => [] }),
 *     loading: Schema.optionalWith(Schema.Boolean, { default: () => false }),
 *   }) {
 *     @action('search', { type: 'callRpc', debounceMs: 300 })
 *     search() {
 *       return Effect.gen(function*(this: FlightSearch) {
 *         const atoms = yield* ActionGroupAtoms
 *         yield* atoms.set('loading', true)
 *         const query = yield* atoms.get('query')
 *         const rpc = yield* DynamicRpcService
 *         const results = yield* rpc.call('opensky/SearchFlights', { query })
 *         yield* atoms.set('results', results)
 *         yield* atoms.set('loading', false)
 *       })
 *     }
 *
 *     @action('clear')
 *     clear() {
 *       return Effect.gen(function*(this: FlightSearch) {
 *         const atoms = yield* ActionGroupAtoms
 *         yield* atoms.set('query', '')
 *         yield* atoms.set('results', [])
 *       })
 *     }
 *
 *     @computed
 *     get resultCount() { return this.results.length }
 *   }
 *
 * @module genifer/decorators/action-group
 */

import 'reflect-metadata'
import { Context, Effect, Layer } from 'effect'
import * as Atom from '@effect-atom/atom/Atom'
import * as Registry from '@effect-atom/atom/Registry'
import {
  ActionGroupId,
  ActionId,
  StateId,
  ComputedId,
  type ActionGroupAnnotation,
  type ActionAnnotation,
  type StateAnnotation,
} from './annotations'

// =============================================================================
// ActionGroupAtoms — Service Tag for atom access inside @action methods
// =============================================================================

/**
 * Injected into @action methods via Effect context.
 * Provides typed atom read/write for the owning ActionGroup's state.
 */
export interface ActionGroupAtomsOps {
  /** Get current value of a state field */
  readonly get: <T>(field: string) => Effect.Effect<T>
  /** Set a state field — triggers React re-renders on subscribers */
  readonly set: <T>(field: string, value: T) => Effect.Effect<void>
  /** Update a state field with a function */
  readonly update: <T>(field: string, fn: (current: T) => T) => Effect.Effect<void>
  /** Get the raw Atom for a field (for direct subscription) */
  readonly atom: <T>(field: string) => Atom.Atom<T>
  /** Get all state as a snapshot */
  readonly snapshot: () => Effect.Effect<Record<string, unknown>>
}

export class ActionGroupAtoms extends Context.Tag('genifer/ActionGroupAtoms')<
  ActionGroupAtoms,
  ActionGroupAtomsOps
>() {}

// =============================================================================
// ActionGroupInstance — A live, hydrated group with atoms
// =============================================================================

export interface ActionGroupInstance {
  /** Group name (e.g., "flight-search") */
  readonly name: string
  /** The Schema.Class constructor */
  readonly ctor: Function
  /** Live writable atoms keyed by field name */
  readonly atoms: ReadonlyMap<string, Atom.Writable<any, any>>
  /** Derived read-only atoms keyed by getter name */
  readonly derived: ReadonlyMap<string, Atom.Atom<any>>
  /** The atom Registry for this group */
  readonly registry: Registry.Registry
  /** Execute an action by tag */
  readonly dispatch: (tag: string, payload?: unknown) => Effect.Effect<void>
  /** Get the ActionGroupAtoms ops for this instance */
  readonly ops: ActionGroupAtomsOps
  /** Layer that provides ActionGroupAtoms for this instance */
  readonly layer: Layer.Layer<ActionGroupAtoms>
}

// =============================================================================
// Registry
// =============================================================================

interface ActionRegistration {
  readonly tag: string
  readonly method: string
  readonly type?: string
  readonly debounceMs?: number
  readonly descriptor: PropertyDescriptor
}

interface StateRegistration {
  readonly field: string
  readonly defaultValue: unknown
  readonly reactive: boolean
}

interface ActionGroupRegistration {
  readonly ctor: Function
  readonly meta: ActionGroupAnnotation
  readonly actions: ReadonlyMap<string, ActionRegistration>
  readonly stateFields: ReadonlyMap<string, StateRegistration>
  readonly computedGetters: readonly string[]
}

const _registry = new Map<string, ActionGroupRegistration>()
const _instances = new Map<string, ActionGroupInstance>()

export function getActionGroupRegistry(): ReadonlyMap<string, ActionGroupRegistration> {
  return _registry
}

export function getActionGroupInstances(): ReadonlyMap<string, ActionGroupInstance> {
  return _instances
}

export function getActionGroupMeta(target: Function): ActionGroupAnnotation | undefined {
  return Reflect.getMetadata(ActionGroupId, target)
}

export function getActionMeta(target: Object, method: string): ActionAnnotation | undefined {
  return Reflect.getMetadata(ActionId, target, method)
}

export function getStateMeta(target: Object, field: string): StateAnnotation | undefined {
  return Reflect.getMetadata(StateId, target, field)
}

// =============================================================================
// hydrate — Create a live ActionGroupInstance from a registration
// =============================================================================

/**
 * Hydrate an ActionGroup class into a live instance with atoms.
 *
 * Creates:
 *   - One Writable atom per @state field (initialized with defaultValue)
 *   - One derived Atom per @computed getter
 *   - A Registry for this group's atoms
 *   - A dispatch function that resolves @action tags to methods
 *   - An ActionGroupAtoms ops object for Effect context injection
 *   - A Layer that provides ActionGroupAtoms
 */
export function hydrate(name: string): ActionGroupInstance | undefined {
  // Return cached instance if already hydrated
  if (_instances.has(name)) return _instances.get(name)!

  const reg = _registry.get(name)
  if (!reg) return undefined

  // Create a dedicated Registry for this ActionGroup
  const registry = Registry.make()

  // Create writable atoms for each @state field
  const atoms = new Map<string, Atom.Writable<any, any>>()
  for (const [field, stateReg] of Array.from(reg.stateFields.entries())) {
    const writable = Atom.make(stateReg.defaultValue)
    atoms.set(field, writable)
  }

  // Build ops — uses registry.get/set for proper atom access
  const ops: ActionGroupAtomsOps = {
    get: <T>(field: string) =>
      Effect.sync(() => {
        const a = atoms.get(field)
        if (!a) throw new Error(`ActionGroup '${name}': no state field '${field}'`)
        return registry.get(a) as T
      }),

    set: <T>(field: string, value: T) =>
      Effect.sync(() => {
        const a = atoms.get(field)
        if (!a) throw new Error(`ActionGroup '${name}': no state field '${field}'`)
        registry.set(a, value)
      }),

    update: <T>(field: string, fn: (current: T) => T) =>
      Effect.sync(() => {
        const a = atoms.get(field)
        if (!a) throw new Error(`ActionGroup '${name}': no state field '${field}'`)
        const current = registry.get(a) as T
        registry.set(a, fn(current))
      }),

    atom: <T>(field: string) => {
      const a = atoms.get(field)
      if (!a) throw new Error(`ActionGroup '${name}': no state field '${field}'`)
      return a as unknown as Atom.Atom<T>
    },

    snapshot: () =>
      Effect.sync(() => {
        const snap: Record<string, unknown> = {}
        for (const [field, a] of Array.from(atoms.entries())) {
          snap[field] = registry.get(a)
        }
        return snap
      }),
  }

  // Build layer
  const layer = Layer.succeed(ActionGroupAtoms, ops)

  // Create derived atoms for @computed getters
  const derived = new Map<string, Atom.Atom<any>>()
  for (const getter of reg.computedGetters) {
    derived.set(getter, Atom.make((get: Atom.Context) => {
      // Build a proxy object that reads from atoms via the get context
      const proxy: Record<string, unknown> = {}
      for (const [field, a] of Array.from(atoms.entries())) {
        proxy[field] = get(a)
      }
      // Call the getter on a temporary proxy
      const proto = reg.ctor.prototype
      const desc = Object.getOwnPropertyDescriptor(proto, getter)
      if (desc?.get) {
        return desc.get.call(proxy)
      }
      return undefined
    }))
  }

  // Build dispatch
  const dispatch = (tag: string, payload?: unknown): Effect.Effect<void> => {
    const actionReg = reg.actions.get(tag)
    if (!actionReg) {
      return Effect.logError(`ActionGroup '${name}': no action '${tag}'`)
    }

    // Create a temporary instance to call the method on
    const proto = Object.create(reg.ctor.prototype)

    // Call the method — it returns an Effect that uses ActionGroupAtoms
    const method = proto[actionReg.method]
    if (typeof method !== 'function') {
      return Effect.logError(`ActionGroup '${name}': method '${actionReg.method}' not found`)
    }

    const result = method.call(proto, payload)

    // If it returns an Effect, provide the ActionGroupAtoms layer
    if (result && Effect.isEffect(result)) {
      return (Effect.provide(result, layer) as Effect.Effect<unknown>).pipe(Effect.asVoid)
    }

    // If it returns a plain object, treat as partial state update
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      return Effect.sync(() => {
        for (const [key, value] of Object.entries(result as Record<string, unknown>)) {
          const a = atoms.get(key)
          if (a) registry.set(a, value)
        }
      })
    }

    return Effect.void
  }

  const instance: ActionGroupInstance = {
    name,
    ctor: reg.ctor,
    atoms,
    derived,
    registry,
    dispatch,
    ops,
    layer,
  }

  _instances.set(name, instance)
  return instance
}

// =============================================================================
// @actionGroup — Class Decorator
// =============================================================================

export interface ActionGroupOptions {
  readonly description?: string
}

/**
 * @actionGroup — Register a Schema.Class as a live ActionGroup.
 *
 * Class fields → atoms. @action methods → dispatchers. @computed → derived atoms.
 * Call hydrate(name) to create the live instance with real atom state.
 */
export function actionGroup(name: string, options?: ActionGroupOptions) {
  return function <T extends Function>(constructor: T): T {
    const meta: ActionGroupAnnotation = {
      name,
      description: options?.description,
    }

    Reflect.defineMetadata(ActionGroupId, meta, constructor)

    // Apply to Schema AST
    const ast = (constructor as any).ast
    if (ast) {
      const targetAst = ast.to ?? ast
      targetAst.annotations = {
        ...(targetAst.annotations ?? {}),
        [ActionGroupId]: meta,
      }
    }

    // Collect @action methods from prototype
    const actions = new Map<string, ActionRegistration>()
    const proto = constructor.prototype
    const actionMethods: string[] = Reflect.getMetadata('genifer:action_methods', proto) ?? []
    for (const method of actionMethods) {
      const actionMeta: ActionAnnotation | undefined = Reflect.getMetadata(ActionId, proto, method)
      if (actionMeta) {
        const desc = Object.getOwnPropertyDescriptor(proto, method)
        actions.set(actionMeta.tag, {
          tag: actionMeta.tag,
          method,
          type: actionMeta.type,
          debounceMs: actionMeta.debounceMs,
          descriptor: desc!,
        })
      }
    }

    // Collect @state fields
    const stateFields = new Map<string, StateRegistration>()
    const stateKeys: string[] = Reflect.getMetadata('genifer:state_fields', proto) ?? []
    for (const field of stateKeys) {
      const stateMeta: StateAnnotation | undefined = Reflect.getMetadata(StateId, proto, field)
      if (stateMeta) {
        stateFields.set(field, {
          field: stateMeta.field,
          defaultValue: stateMeta.defaultValue,
          reactive: stateMeta.reactive ?? true,
        })
      }
    }

    // Also infer state from Schema.Class fields with defaults
    const fields = (constructor as any).fields
    if (fields) {
      for (const [key, fieldSchema] of Object.entries(fields)) {
        if (!stateFields.has(key)) {
          // Auto-register Schema.Class fields as state (reactive by default)
          stateFields.set(key, {
            field: key,
            defaultValue: undefined, // Schema default handles it
            reactive: true,
          })
        }
      }
    }

    // Collect @computed getters
    const computedGetters: string[] = Reflect.getMetadata('genifer:computed_getters', proto) ?? []

    _registry.set(name, {
      ctor: constructor,
      meta,
      actions,
      stateFields,
      computedGetters,
    })

    return constructor
  }
}

// =============================================================================
// @action — Method Decorator
// =============================================================================

export interface ActionOptions {
  readonly type?: 'setState' | 'emitEvent' | 'callRpc' | 'navigate'
  readonly debounceMs?: number
  readonly description?: string
}

/**
 * @action — Mark a method as a dispatchable action.
 *
 * The method body is REAL code that:
 *   - yield* ActionGroupAtoms to read/write state atoms
 *   - yield* any Effect service (HttpClient, DynamicRpcService, etc.)
 *   - Returns an Effect (preferred) or a plain object (partial state update)
 *
 * ```ts
 * @action('search', { type: 'callRpc', debounceMs: 300 })
 * search() {
 *   return Effect.gen(function*() {
 *     const atoms = yield* ActionGroupAtoms
 *     yield* atoms.set('loading', true)
 *     const query = yield* atoms.get('query')
 *     const http = yield* HttpClient.HttpClient
 *     const res = yield* http.get(`https://api.example.com/search?q=${query}`)
 *     const data = yield* res.json
 *     yield* atoms.set('results', data)
 *     yield* atoms.set('loading', false)
 *   })
 * }
 * ```
 */
export function action(tag: string, options?: ActionOptions): MethodDecorator {
  return function (target: Object, propertyKey: string | symbol, _descriptor: PropertyDescriptor): void {
    const meta: ActionAnnotation = {
      tag,
      type: options?.type,
      debounceMs: options?.debounceMs,
    }

    Reflect.defineMetadata(ActionId, meta, target, propertyKey as string)

    const existing: string[] = Reflect.getMetadata('genifer:action_methods', target) ?? []
    Reflect.defineMetadata('genifer:action_methods', [...existing, propertyKey as string], target)
  }
}

// =============================================================================
// @state — Property Decorator
// =============================================================================

export interface StateOptions {
  readonly defaultValue?: unknown
  readonly reactive?: boolean
}

/**
 * @state — Declare an explicit state field with atom binding.
 *
 * Schema.Class fields are auto-registered as state. Use @state explicitly
 * when you need custom default values or want to mark a field as non-reactive.
 *
 * Each @state field becomes an Atom.make() at hydration time.
 * React components subscribe via useAtomValue(instance.atoms.get('fieldName')).
 */
export function state(options?: StateOptions): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol): void {
    const meta: StateAnnotation = {
      field: propertyKey as string,
      defaultValue: options?.defaultValue,
      reactive: options?.reactive ?? true,
    }

    Reflect.defineMetadata(StateId, meta, target, propertyKey as string)

    const existing: string[] = Reflect.getMetadata('genifer:state_fields', target) ?? []
    Reflect.defineMetadata('genifer:state_fields', [...existing, propertyKey as string], target)
  }
}

// =============================================================================
// @computed — Getter Decorator (derived atom)
// =============================================================================

/**
 * @computed — Derive a value from state. Becomes a derived Atom.
 *
 * When any dependency @state atom changes, the computed re-evaluates.
 * React subscribes to the derived atom the same way as regular state.
 */
export function computed(target: Object, propertyKey: string | symbol, _descriptor: PropertyDescriptor): void {
  Reflect.defineMetadata(ComputedId, true, target, propertyKey as string)

  const existing: string[] = Reflect.getMetadata('genifer:computed_getters', target) ?? []
  Reflect.defineMetadata('genifer:computed_getters', [...existing, propertyKey as string], target)
}
