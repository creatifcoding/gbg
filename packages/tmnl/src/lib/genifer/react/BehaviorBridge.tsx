/**
 * BehaviorBridge — Resolves behavior blocks and sigils at render time.
 *
 * Sits between the UITree and the Renderer:
 *   1. Walks the tree looking for `behavior` and `ref` fields on elements
 *   2. Hydrates BehaviorBlocks into ActionGroupInstances (atoms + dispatch)
 *   3. Resolves sigil props (@state:, @action:, bind:, {{interpolation}})
 *   4. Passes resolved props and handlers to the standard ElementRenderer
 *
 * The bridge is invisible to the Renderer — it just pre-processes the tree.
 * React components get plain props + event handlers. No sigil awareness needed.
 *
 * @module genifer/react/BehaviorBridge
 */

'use client'

import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  type ReactNode,
  type FC,
} from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import * as Atom from '@effect-atom/atom/Atom'
import { Effect, HashMap } from 'effect'

import type { UIElement, UITree } from '../core/schemas'
import {
  interpretBehaviorBlock,
  interpretComponentRef,
  resolveProps,
} from '../decorators/interpreter'
import {
  type ActionGroupInstance,
  getActionGroupInstances,
} from '../decorators/action-group'
import type {
  BehaviorBlock,
  ComponentRef,
} from '../decorators/generation-schema'
import {
  getCodeModeAtom,
  setCodeModeAtom,
} from '../code-mode/shared-atoms'

// =============================================================================
// Context: Active behavior instances per tree
// =============================================================================

interface BehaviorContextValue {
  /** Lookup a hydrated instance by name */
  getInstance: (name: string) => ActionGroupInstance | undefined
  /** Resolve sigil props against an instance */
  resolveElementProps: (
    element: UIElement,
    instanceName?: string,
  ) => { props: Record<string, unknown>; handlers: Record<string, (payload?: unknown) => void> }
}

const BehaviorContext = createContext<BehaviorContextValue>({
  getInstance: () => undefined,
  resolveElementProps: (el) => ({ props: el.props, handlers: {} }),
})

export const useBehavior = () => useContext(BehaviorContext)

// =============================================================================
// BehaviorProvider — Wraps a rendered tree
// =============================================================================

interface BehaviorProviderProps {
  /** The UITree being rendered — scanned for behavior blocks */
  tree: UITree | null
  children: ReactNode
}

/**
 * BehaviorProvider scans the tree for behavior blocks on mount,
 * hydrates them into ActionGroupInstances, and provides a context
 * for resolving sigils during rendering.
 *
 * Usage:
 * ```tsx
 * <BehaviorProvider tree={tree}>
 *   <Renderer tree={tree} />
 * </BehaviorProvider>
 * ```
 */
export const BehaviorProvider: FC<BehaviorProviderProps> = ({ tree, children }) => {
  // Scan tree for behavior blocks and hydrate
  const instances = useMemo(() => {
    if (!tree) return new Map<string, ActionGroupInstance>()

    const found = new Map<string, ActionGroupInstance>()

    // Walk all elements looking for behavior blocks
    const elements = tree.elements
    if (elements && typeof elements === 'object') {
      // Handle both HashMap and plain object
      // Handle both HashMap (Effect) and plain object element maps
      let entries: Array<[string, unknown]>
      if (HashMap.isHashMap(elements)) {
        entries = Array.from(HashMap.toEntries(elements)) as Array<[string, unknown]>
      } else {
        entries = Object.entries(elements as unknown as Record<string, unknown>)
      }

      for (const [_key, element] of entries) {
        const el = element as any
        if (!el) continue

        // Check for behavior block (Tier 2)
        if (el.behavior && typeof el.behavior === 'object' && el.behavior.name) {
          const block = el.behavior as BehaviorBlock
          const instance = interpretBehaviorBlock(block)
          found.set(block.name, instance)
        }

        // Check for component ref (Tier 1)
        if (el.ref && typeof el.ref === 'object' && el.ref.component) {
          const ref = el.ref as ComponentRef
          const result = interpretComponentRef(ref)
          if (result.instance) {
            found.set(ref.component, result.instance)
          }
        }
      }
    }

    return found
  }, [tree])

  // Build context value
  const contextValue = useMemo<BehaviorContextValue>(() => ({
    getInstance: (name: string) => {
      // Check locally-hydrated instances first, then global registry
      return instances.get(name) ?? getActionGroupInstances().get(name)
    },

    resolveElementProps: (element: UIElement, instanceName?: string) => {
      // Determine which behavior instance to resolve against
      let instance: ActionGroupInstance | undefined

      // Check if element has an explicit behavior name
      const elAny = element as any
      if (elAny.behavior?.name) {
        instance = instances.get(elAny.behavior.name) ?? getActionGroupInstances().get(elAny.behavior.name)
      } else if (instanceName) {
        instance = instances.get(instanceName) ?? getActionGroupInstances().get(instanceName)
      }

      // Find nearest ancestor behavior (walk up the tree)
      // For now: check if any prop contains a sigil — if so, find the instance
      if (!instance && element.props) {
        for (const value of Object.values(element.props)) {
          if (typeof value === 'string' && (
            value.startsWith('@state:') ||
            value.startsWith('@action:') ||
            value.startsWith('bind:') ||
            value.includes('{{@state:')
          )) {
            // Use the first found instance (nearest scope)
            instance = instances.values().next().value ?? getActionGroupInstances().values().next().value
            break
          }
        }
      }

      if (!instance) {
        // No ActionGroupInstance found — try resolving sigils against code-mode atoms
        const rawProps = element.props as Record<string, unknown>
        const codeModeResolved = resolveCodeModeProps(rawProps)
        return { props: codeModeResolved.props, handlers: codeModeResolved.handlers }
      }

      const { resolved, handlers } = resolveProps(element.props as Record<string, unknown>, instance)
      return { props: resolved, handlers }
    },
  }), [instances])

  return (
    <BehaviorContext.Provider value={contextValue}>
      {children}
    </BehaviorContext.Provider>
  )
}

// =============================================================================
// Code Mode Prop Resolution (fallback when no ActionGroupInstance)
// =============================================================================

/**
 * Resolves sigil props against the shared code-mode atom store.
 * Handles: @state:key, bind:key, {{@state:key}} interpolation, @action:tag
 */
function resolveCodeModeProps(props: Record<string, unknown>): {
  props: Record<string, unknown>
  handlers: Record<string, (payload?: unknown) => void>
} {
  const resolved: Record<string, unknown> = {}
  const handlers: Record<string, (payload?: unknown) => void> = {}

  for (const [key, value] of Object.entries(props)) {
    if (typeof value !== 'string') {
      resolved[key] = value
      continue
    }

    // @state:fieldName → read from code-mode atom store
    if (value.startsWith('@state:')) {
      const atomKey = value.slice(7) // after '@state:'
      resolved[key] = getCodeModeAtom(atomKey)
      continue
    }

    // bind:fieldName → two-way binding (value + onChange handler)
    if (value.startsWith('bind:')) {
      const atomKey = value.slice(5) // after 'bind:'
      resolved[key] = getCodeModeAtom(atomKey)
      // Create an onChange handler that writes back to the atom
      const handlerKey = `on${key.charAt(0).toUpperCase()}${key.slice(1)}Change`
      handlers[handlerKey] = (newValue?: unknown) => {
        setCodeModeAtom(atomKey, newValue)
      }
      // Also set a generic onChange for input elements
      if (key === 'value') {
        handlers['onChange'] = (eventOrValue?: unknown) => {
          // Handle both React events and plain values
          const v = eventOrValue && typeof eventOrValue === 'object' && 'target' in (eventOrValue as any)
            ? (eventOrValue as any).target.value
            : eventOrValue
          setCodeModeAtom(atomKey, v)
        }
      }
      continue
    }

    // @action:tag → create an onClick/onAction handler
    if (value.startsWith('@action:')) {
      const actionTag = value.slice(8) // after '@action:'
      handlers[key] = (payload?: unknown) => {
        // Emit as dynamic event so code-mode can listen
        import('../code-mode/shared-atoms').then(({ setCodeModeAtom: set }) => {
          // Set a special action atom to signal the action fired
          set(`__action:${actionTag}`, { tag: actionTag, payload, timestamp: Date.now() })
        })
      }
      resolved[key] = undefined // clear the sigil from the prop
      continue
    }

    // {{@state:key}} interpolation within strings
    if (value.includes('{{@state:')) {
      resolved[key] = value.replace(/\{\{@state:([^}]+)\}\}/g, (_match, atomKey) => {
        const v = getCodeModeAtom(atomKey)
        return v !== undefined ? String(v) : ''
      })
      continue
    }

    // No sigil — pass through
    resolved[key] = value
  }

  return { props: resolved, handlers }
}

// =============================================================================
// useBehaviorProps — Hook for components to resolve their own sigils
// =============================================================================

/**
 * Hook for individual rendered components to resolve sigil props.
 *
 * Used by component renderers that are behavior-aware:
 * ```tsx
 * function MyInput({ element }) {
 *   const { props, handlers } = useBehaviorProps(element)
 *   return <input value={props.value} onChange={handlers.onChange} />
 * }
 * ```
 */
export function useBehaviorProps(element: UIElement, instanceName?: string) {
  const { resolveElementProps } = useBehavior()
  return useMemo(
    () => resolveElementProps(element, instanceName),
    [element, instanceName, resolveElementProps],
  )
}

/**
 * Hook for accessing a specific ActionGroup's dispatch from any component.
 *
 * ```tsx
 * const dispatch = useBehaviorDispatch('flight-search')
 * <button onClick={() => dispatch('search')}>Go</button>
 * ```
 */
export function useBehaviorDispatch(instanceName: string) {
  const { getInstance } = useBehavior()
  const instance = getInstance(instanceName)

  return useCallback(
    (tag: string, payload?: unknown) => {
      if (!instance) {
        console.warn(`[BehaviorBridge] No instance '${instanceName}' found`)
        return
      }
      Effect.runPromise(instance.dispatch(tag, payload)).catch(err => {
        console.error(`[BehaviorBridge] dispatch '${tag}' failed:`, err)
      })
    },
    [instance, instanceName],
  )
}

/**
 * Hook for reading a single atom value from a behavior instance.
 *
 * ```tsx
 * const query = useBehaviorState('flight-search', 'query')
 * ```
 */
export function useBehaviorState<T = unknown>(instanceName: string, field: string): T | undefined {
  const { getInstance } = useBehavior()
  const instance = getInstance(instanceName)
  const atom = instance?.atoms.get(field)

  if (atom) {
    // Subscribe to the atom via the instance's registry
    // Note: This reads once. For reactive updates, use useAtomValue with the atom directly.
    return instance!.registry.get(atom) as T
  }

  return undefined
}
