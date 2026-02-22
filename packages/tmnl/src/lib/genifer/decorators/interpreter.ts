/**
 * Behavior Interpreter — bridges LLM-generated JSON to live atom-backed structures.
 *
 * The LLM outputs BehaviorBlocks (Tier 2) and ComponentRefs (Tier 1).
 * This interpreter reads them and produces the SAME runtime objects
 * that the decorator bootstrap creates:
 *   - ActionGroupInstance (atoms, dispatch, layer)
 *   - Event subscriptions
 *   - RPC registrations
 *
 * Same atoms. Same dispatch. Same React hooks.
 * The only difference is where the definition came from:
 *   - Decorator: human-authored TypeScript class
 *   - Interpreter: LLM-generated JSON
 *
 * @module genifer/decorators/interpreter
 */

import { Context, Effect, Layer } from 'effect'
import * as Atom from '@effect-atom/atom/Atom'
import * as Registry from '@effect-atom/atom/Registry'

import type {
  BehaviorBlock,
  BehaviorProps,
  ComponentRef,
  ActionDef,
  BindingDef,
} from './generation-schema'
import { ActionGroupAtoms, type ActionGroupAtomsOps, type ActionGroupInstance } from './action-group'
import { getComponentRegistry } from './component'
import { getActionGroupInstances, hydrate as hydrateDecorated } from './action-group'
import { subscribeEvent, bootstrapRegistry } from './bootstrap'

// =============================================================================
// Sigil Resolution
// =============================================================================

/** Resolve sigil expressions against a registry + atom map */
function resolveSigil(
  expression: string,
  registry: Registry.Registry,
  atoms: ReadonlyMap<string, Atom.Writable<any, any>>,
  payload?: unknown,
  event?: unknown,
): unknown {
  // @state:fieldName → read atom value
  if (expression.startsWith('@state:')) {
    const field = expression.slice(7)
    const atom = atoms.get(field)
    return atom ? registry.get(atom) : undefined
  }

  // String interpolation: "Hello {{@state:name}}, you have {{@state:count}} items"
  if (expression.includes('{{')) {
    return expression.replace(/\{\{([^}]+)\}\}/g, (_, expr: string) => {
      const trimmed = expr.trim()
      if (trimmed === '$payload') return String(payload ?? '')
      if (trimmed === '$event') return JSON.stringify(event ?? null)
      if (trimmed.startsWith('@state:')) {
        const field = trimmed.slice(7)
        const atom = atoms.get(field)
        return atom ? String(registry.get(atom) ?? '') : ''
      }
      return ''
    })
  }

  // bind:fieldName → resolve to current value (write-back handled by binding layer)
  if (expression.startsWith('bind:')) {
    const field = expression.slice(5)
    const atom = atoms.get(field)
    return atom ? registry.get(atom) : undefined
  }

  // @action:tag → this is a handler reference, not a value
  if (expression.startsWith('@action:')) {
    return expression // Passed through — resolved by the rendering layer
  }

  // Literal value
  return expression
}

/** Deep-resolve all sigils in an object/record */
function resolvePayload(
  obj: Record<string, unknown>,
  registry: Registry.Registry,
  atoms: ReadonlyMap<string, Atom.Writable<any, any>>,
  payload?: unknown,
  event?: unknown,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      resolved[key] = resolveSigil(value, registry, atoms, payload, event)
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      resolved[key] = resolvePayload(value as Record<string, unknown>, registry, atoms, payload, event)
    } else {
      resolved[key] = value
    }
  }
  return resolved
}

// =============================================================================
// Action Executor
// =============================================================================

/**
 * Execute an ActionDef tree against a set of atoms.
 * This is the Tier 2 runtime — reads the JSON DSL and performs real operations.
 */
function executeAction(
  actionDef: ActionDef,
  registry: Registry.Registry,
  atoms: Map<string, Atom.Writable<any, any>>,
  payload?: unknown,
  event?: unknown,
): Effect.Effect<unknown> {
  switch (actionDef._tag) {
    case 'setState': {
      return Effect.sync(() => {
        const values = actionDef.values as Record<string, unknown>
        for (const [field, value] of Object.entries(values)) {
          const atom = atoms.get(field)
          if (!atom) continue
          // Resolve sigils in the value
          if (typeof value === 'string') {
            registry.set(atom, resolveSigil(value, registry, atoms, payload, event))
          } else {
            registry.set(atom, value)
          }
        }
      })
    }

    case 'callRpc': {
      const rpcDef = actionDef
      return Effect.suspend(() => {
        // Set loading if configured
        if (rpcDef.loadingField) {
          const loadAtom = atoms.get(rpcDef.loadingField)
          if (loadAtom) registry.set(loadAtom, true)
        }

        // Resolve payload sigils
        const resolvedPayload = rpcDef.payload
          ? resolvePayload(rpcDef.payload as Record<string, unknown>, registry, atoms, payload, event)
          : {}

        return callRpcByTag(rpcDef.rpc, resolvedPayload).pipe(
          Effect.tap((result) => Effect.sync(() => {
            // Store result
            if (rpcDef.resultField) {
              const resultAtom = atoms.get(rpcDef.resultField)
              if (resultAtom) registry.set(resultAtom, result)
            }
            // Clear error
            if (rpcDef.errorField) {
              const errAtom = atoms.get(rpcDef.errorField)
              if (errAtom) registry.set(errAtom, null)
            }
          })),
          Effect.catchAll((err) => Effect.sync(() => {
            if (rpcDef.errorField) {
              const errAtom = atoms.get(rpcDef.errorField)
              if (errAtom) registry.set(errAtom, String(err))
            }
          })),
          Effect.ensuring(Effect.sync(() => {
            if (rpcDef.loadingField) {
              const loadAtom = atoms.get(rpcDef.loadingField)
              if (loadAtom) registry.set(loadAtom, false)
            }
          })),
        )
      })
    }

    case 'emitEvent': {
      return Effect.sync(() => {
        const resolvedPayload = actionDef.payload
          ? resolvePayload(actionDef.payload as Record<string, unknown>, registry, atoms, payload, event)
          : {}
        // Write to bootstrap eventLogAtom for backward compat
        const r = bootstrapRegistry
        const log = r.get(eventLogAtom)
        r.set(eventLogAtom as Atom.Writable<any, any>, [
          ...log,
          { tag: actionDef.event, payload: resolvedPayload, timestamp: Date.now() },
        ])
        // Also emit via DynamicEventService if available (notifies subscribers)
        try {
          const { emitDynamicEvent } = require('../services/DynamicEventService')
          Effect.runSync(emitDynamicEvent(actionDef.event, resolvedPayload, 'interpreter'))
        } catch { /* DynamicEventService not available — that's ok */ }
      })
    }

    case 'navigate': {
      return Effect.sync(() => {
        const resolved = resolveSigil(actionDef.to, registry, atoms, payload, event)
        // Navigation integration point — dispatch to router
        console.log('[genifer:navigate]', resolved)
        // In production, this dispatches to the app router
      })
    }

    case 'sequence': {
      const seqActions = actionDef.actions as readonly ActionDef[]
      return Effect.forEach(
        seqActions,
        (sub: ActionDef) => executeAction(sub, registry, atoms, payload, event),
        { concurrency: 1 },
      ).pipe(Effect.asVoid)
    }

    case 'conditional': {
      const condDef = actionDef
      return Effect.suspend(() => {
        const fieldAtom = atoms.get(condDef.field)
        const fieldValue = fieldAtom ? registry.get(fieldAtom) : undefined

        let condition = false
        switch (condDef.op) {
          case 'eq': condition = fieldValue === condDef.value; break
          case 'neq': condition = fieldValue !== condDef.value; break
          case 'gt': condition = (fieldValue as number) > (condDef.value as number); break
          case 'lt': condition = (fieldValue as number) < (condDef.value as number); break
          case 'gte': condition = (fieldValue as number) >= (condDef.value as number); break
          case 'lte': condition = (fieldValue as number) <= (condDef.value as number); break
          case 'empty': condition = !fieldValue || (Array.isArray(fieldValue) && fieldValue.length === 0); break
          case 'notEmpty': condition = !!fieldValue && !(Array.isArray(fieldValue) && fieldValue.length === 0); break
          case 'contains': condition = String(fieldValue).includes(String(condDef.value)); break
          case 'matches': condition = new RegExp(String(condDef.value)).test(String(fieldValue)); break
        }

        if (condition) {
          return executeAction(condDef.then as ActionDef, registry, atoms, payload, event)
        } else if (condDef.else) {
          return executeAction(condDef.else as ActionDef, registry, atoms, payload, event)
        }
        return Effect.void
      })
    }

    default: {
      const _exhaustive: never = actionDef
      return Effect.void
    }
  }
}

// Import the event log atom for emitting events
import { eventLogAtom } from './bootstrap'

// =============================================================================
// RPC Dispatch (pluggable)
// =============================================================================

/** Global RPC executor — bridges to decorated @rpc handlers and DynamicRpcService */
let _rpcExecutor: (tag: string, payload: unknown) => Effect.Effect<unknown> =
  (_tag, _payload) => Effect.succeed(undefined)

/** Set the global RPC executor. Called during app bootstrap. */
export function setRpcExecutor(fn: (tag: string, payload: unknown) => Effect.Effect<unknown>): void {
  _rpcExecutor = fn
}

function callRpcByTag(tag: string, payload: unknown): Effect.Effect<unknown> {
  return _rpcExecutor(tag, payload)
}

// =============================================================================
// TIER 1: interpretComponentRef
// =============================================================================

/**
 * Resolve a ComponentRef to an ActionGroupInstance + component metadata.
 *
 * 1. Looks up @component registry by name
 * 2. Hydrates the associated @actionGroup (if any)
 * 3. Applies templateOverrides to state defaults
 * 4. Returns the live instance + renderer info
 */
export function interpretComponentRef(ref: ComponentRef): {
  instance: ActionGroupInstance | undefined
  componentMeta: unknown
  resolvedProps: Record<string, unknown>
} {
  const componentReg = getComponentRegistry()
  const meta = componentReg.get(ref.component)

  // Check for existing decorated ActionGroup
  const groupName = ref.actionGroup ?? ref.component.toLowerCase()
  let instance = hydrateDecorated(groupName)

  // Apply template overrides if present
  if (instance && ref.templateOverrides) {
    const overrides = ref.templateOverrides as Record<string, unknown>
    for (const [field, value] of Object.entries(overrides)) {
      const atom = instance.atoms.get(field)
      if (atom) instance.registry.set(atom, value)
    }
  }

  return {
    instance,
    componentMeta: meta,
    resolvedProps: (ref.props ?? {}) as Record<string, unknown>,
  }
}

// =============================================================================
// TIER 2: interpretBehaviorBlock
// =============================================================================

/**
 * Interpret a BehaviorBlock into a live ActionGroupInstance.
 *
 * Creates the SAME structure as decorator hydrate():
 *   - Writable atoms per state field
 *   - dispatch() resolves action tags to ActionDef execution
 *   - Event subscriptions wired to the bus
 *   - ActionGroupAtoms ops + Layer for Effect context
 *
 * The React hooks (useActionGroup, useActionGroupState, etc.) work identically
 * whether the instance came from decorators or from this interpreter.
 */
export function interpretBehaviorBlock(block: BehaviorBlock): ActionGroupInstance {
  // Check for existing instance with this name
  const existing = getActionGroupInstances().get(block.name)
  if (existing) return existing

  // Create a dedicated Registry
  const registry = Registry.make()

  // Create writable atoms for each state field
  const atoms = new Map<string, Atom.Writable<any, any>>()
  for (const stateDef of block.state) {
    atoms.set(stateDef.field, Atom.make(stateDef.initial))
  }

  // Build ActionGroupAtoms ops
  const ops: ActionGroupAtomsOps = {
    get: <T>(field: string) =>
      Effect.sync(() => {
        const a = atoms.get(field)
        if (!a) throw new Error(`BehaviorBlock '${block.name}': no state field '${field}'`)
        return registry.get(a) as T
      }),

    set: <T>(field: string, value: T) =>
      Effect.sync(() => {
        const a = atoms.get(field)
        if (!a) throw new Error(`BehaviorBlock '${block.name}': no state field '${field}'`)
        registry.set(a, value)
      }),

    update: <T>(field: string, fn: (current: T) => T) =>
      Effect.sync(() => {
        const a = atoms.get(field)
        if (!a) throw new Error(`BehaviorBlock '${block.name}': no state field '${field}'`)
        const current = registry.get(a) as T
        registry.set(a, fn(current))
      }),

    atom: <T>(field: string) => {
      const a = atoms.get(field)
      if (!a) throw new Error(`BehaviorBlock '${block.name}': no state field '${field}'`)
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

  const layer = Layer.succeed(ActionGroupAtoms, ops)

  // Build dispatch function
  const dispatch = (tag: string, payload?: unknown): Effect.Effect<void> => {
    const actionDef = (block.actions as Record<string, ActionDef>)[tag]
    if (!actionDef) {
      return Effect.logError(`BehaviorBlock '${block.name}': no action '${tag}'`)
    }
    return executeAction(actionDef, registry, atoms, payload).pipe(Effect.asVoid)
  }

  // Wire event subscriptions
  for (const sub of block.subscriptions) {
    subscribeEvent(sub.event, (eventPayload) => {
      Effect.runPromise(
        executeAction(sub.action, registry, atoms, undefined, eventPayload)
      ).catch(err => {
        console.error(`BehaviorBlock '${block.name}' subscription '${sub.event}' failed:`, err)
      })
    })
  }

  const instance: ActionGroupInstance = {
    name: block.name,
    ctor: Object, // No backing class — JSON-defined
    atoms,
    derived: new Map(), // No @computed in JSON DSL — use code blocks for derived state
    registry,
    dispatch,
    ops,
    layer,
  }

  // Register so React hooks can find it
  getActionGroupInstances().set(block.name, instance)

  return instance
}

// =============================================================================
// COMPOSITE: interpretBehaviorProps
// =============================================================================

/**
 * Interpret all behavior tiers on a UITree node.
 *
 * Called during rendering to resolve:
 *   - Tier 1: Component references → hydrate and render
 *   - Tier 2: Behavior blocks → create atoms + actions
 *   - Tier 3: Code blocks → sandboxed execution (delegated to CodeModeService)
 *   - Bindings → resolved against active atoms
 */
export function interpretBehaviorProps(
  behaviorProps: BehaviorProps,
): {
  instance: ActionGroupInstance | undefined
  componentMeta: unknown
  resolvedBindings: Map<string, unknown>
} {
  let instance: ActionGroupInstance | undefined
  let componentMeta: unknown

  // Tier 1: Component reference
  if (behaviorProps.ref) {
    const result = interpretComponentRef(behaviorProps.ref)
    instance = result.instance
    componentMeta = result.componentMeta
  }

  // Tier 2: Behavior block (may override or extend Tier 1)
  if (behaviorProps.behavior) {
    instance = interpretBehaviorBlock(behaviorProps.behavior)
  }

  // Tier 3: Code blocks — delegated to CodeModeService (not yet implemented)
  // behaviorProps.codeBlocks handled by separate service

  // Resolve bindings
  const resolvedBindings = new Map<string, unknown>()
  if (instance && behaviorProps.bindings.length > 0) {
    for (const binding of behaviorProps.bindings) {
      resolvedBindings.set(
        binding.prop,
        resolveSigil(binding.expression, instance.registry, instance.atoms)
      )
    }
  }

  return { instance, componentMeta, resolvedBindings }
}

// =============================================================================
// Convenience: resolve sigils in a props object
// =============================================================================

/**
 * Walk a props object and resolve all sigil strings.
 * Used by the rendering layer to bind UI elements to atoms.
 *
 * Returns both resolved values and action handlers (for onClick etc.)
 */
export function resolveProps(
  props: Record<string, unknown>,
  instance: ActionGroupInstance,
): {
  resolved: Record<string, unknown>
  handlers: Record<string, (payload?: unknown) => void>
} {
  const resolved: Record<string, unknown> = {}
  const handlers: Record<string, (payload?: unknown) => void> = {}

  for (const [key, value] of Object.entries(props)) {
    if (typeof value !== 'string') {
      resolved[key] = value
      continue
    }

    // @action:tag → create an event handler
    if (value.startsWith('@action:')) {
      const tag = value.slice(8)
      handlers[key] = (payload?: unknown) => {
        Effect.runPromise(instance.dispatch(tag, payload)).catch(err => {
          console.error(`Action '${tag}' failed:`, err)
        })
      }
      continue
    }

    // @state:field → read atom value
    if (value.startsWith('@state:')) {
      const field = value.slice(7)
      const atom = instance.atoms.get(field)
      resolved[key] = atom ? instance.registry.get(atom) : undefined
      continue
    }

    // bind:field → value + onChange handler
    if (value.startsWith('bind:')) {
      const field = value.slice(5)
      const atom = instance.atoms.get(field)
      if (atom) {
        resolved[key] = instance.registry.get(atom)
        handlers[`on${key.charAt(0).toUpperCase()}${key.slice(1)}Change`] = (newValue?: unknown) => {
          instance.registry.set(atom, newValue)
        }
      }
      continue
    }

    // {{...}} interpolation
    if (value.includes('{{')) {
      resolved[key] = resolveSigil(value, instance.registry, instance.atoms)
      continue
    }

    // Literal
    resolved[key] = value
  }

  return { resolved, handlers }
}
