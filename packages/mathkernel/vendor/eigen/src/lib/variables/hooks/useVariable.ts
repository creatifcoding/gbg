/**
 * TMNL Variables — React Hook
 *
 * useVariable() provides reactive access to variables from React components.
 */

import { useCallback, useMemo } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { Atom } from '@effect-atom/atom'
import { Effect } from 'effect'
import type { VariableDefinition, VariableMetadata, ResolvedValue, ValueSource } from '../types'
import { VariableService } from '../service'
import { getVariableDefinition, getVariableMetadata } from '../define'
import {
  userValuesAtom,
  workspaceValuesAtom,
  editorValuesAtom,
  currentWorkspaceIdAtom,
  currentEditorIdAtom,
  resolveValue,
} from '../atoms'

// ─────────────────────────────────────────────────────────────────────────────
// Hook Return Type
// ─────────────────────────────────────────────────────────────────────────────

export interface UseVariableReturn<A> {
  /** Current value (resolved through scope chain) */
  readonly value: A

  /** Where the current value came from */
  readonly source: ValueSource

  /** Whether value differs from default */
  readonly isModified: boolean

  /** Variable metadata */
  readonly metadata: VariableMetadata | null

  /** Set the variable value */
  readonly set: (value: A) => Promise<void>

  /** Reset to default (remove override) */
  readonly reset: () => Promise<void>

  /** Make variable local to current editor */
  readonly makeLocal: () => Promise<void>
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived Atom for Value Resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a derived atom that resolves a variable's value.
 * Re-computes when any relevant storage changes.
 */
function createVariableValueAtom(variableId: string) {
  return Atom.make((get) => {
    // Subscribe to all value stores to trigger re-computation
    get(userValuesAtom)
    get(workspaceValuesAtom)
    get(editorValuesAtom)
    get(currentWorkspaceIdAtom)
    get(currentEditorIdAtom)

    // Get definition
    const definition = getVariableDefinition(variableId)
    if (!definition) {
      return { value: undefined, source: 'default' as ValueSource, isModified: false }
    }

    // Resolve value
    const resolved = resolveValue(variableId, definition.default, definition.scope)
    return {
      value: resolved.value,
      source: resolved.source,
      isModified: resolved.source !== 'default',
    }
  })
}

// Cache for variable value atoms
const variableAtomCache = new Map<string, ReturnType<typeof createVariableValueAtom>>()

function getVariableValueAtom(variableId: string) {
  let atom = variableAtomCache.get(variableId)
  if (!atom) {
    atom = createVariableValueAtom(variableId)
    variableAtomCache.set(variableId, atom)
  }
  return atom
}

// ─────────────────────────────────────────────────────────────────────────────
// useVariable Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * React hook for accessing and modifying a variable.
 *
 * @example
 * ```tsx
 * function EditorSettings() {
 *   const { value, set, isModified, reset } = useVariable('editor.tabWidth')
 *
 *   return (
 *     <div>
 *       <input
 *         type="number"
 *         value={value}
 *         onChange={(e) => set(Number(e.target.value))}
 *       />
 *       {isModified && <button onClick={reset}>Reset</button>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useVariable<A = unknown>(variableId: string): UseVariableReturn<A> {
  // Get the value atom for this variable
  const valueAtom = useMemo(() => getVariableValueAtom(variableId), [variableId])

  // Subscribe to value changes
  const resolved = useAtomValue(valueAtom)

  // Get metadata (static, doesn't change)
  const metadata = useMemo(() => {
    const def = getVariableDefinition(variableId)
    return def ? getVariableMetadata(def) : null
  }, [variableId])

  // Set callback
  const set = useCallback(
    async (value: A) => {
      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* VariableService
          yield* svc.set(variableId, value)
        }).pipe(
          Effect.provide(VariableService.Default),
          Effect.catchAll((err) => Effect.logError('Failed to set variable', err))
        )
      )
    },
    [variableId]
  )

  // Reset callback
  const reset = useCallback(async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* VariableService
        yield* svc.reset(variableId)
      }).pipe(
        Effect.provide(VariableService.Default),
        Effect.catchAll((err) => Effect.logError('Failed to reset variable', err))
      )
    )
  }, [variableId])

  // Make local callback
  const makeLocal = useCallback(async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* VariableService
        yield* svc.makeLocal(variableId)
      }).pipe(
        Effect.provide(VariableService.Default),
        Effect.catchAll((err) => Effect.logError('Failed to make variable local', err))
      )
    )
  }, [variableId])

  return useMemo(
    () => ({
      value: resolved.value as A,
      source: resolved.source,
      isModified: resolved.isModified,
      metadata,
      set,
      reset,
      makeLocal,
    }),
    [resolved, metadata, set, reset, makeLocal]
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// useVariableValue Hook (Lightweight)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lightweight hook for reading a variable's value only.
 * Use when you don't need set/reset capabilities.
 *
 * @example
 * ```tsx
 * function TabRenderer() {
 *   const tabWidth = useVariableValue<number>('editor.tabWidth')
 *   return <span style={{ width: `${tabWidth}ch` }}>→</span>
 * }
 * ```
 */
export function useVariableValue<A = unknown>(variableId: string): A {
  const valueAtom = useMemo(() => getVariableValueAtom(variableId), [variableId])
  const resolved = useAtomValue(valueAtom)
  return resolved.value as A
}

// ─────────────────────────────────────────────────────────────────────────────
// useVariableMetadata Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for getting variable metadata.
 * Useful for settings UI that shows description, type hints, etc.
 */
export function useVariableMetadata(variableId: string): VariableMetadata | null {
  return useMemo(() => {
    const def = getVariableDefinition(variableId)
    return def ? getVariableMetadata(def) : null
  }, [variableId])
}

// ─────────────────────────────────────────────────────────────────────────────
// useVariableGroups Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for getting all variable groups.
 * Useful for settings UI navigation.
 */
export function useVariableGroups(): readonly string[] {
  // This is static (based on registered variables), no need for atoms
  return useMemo(() => {
    const groups = new Set<string>()
    for (const def of getVariableDefinition.prototype ? [] : []) {
      // This won't work correctly — need to iterate registry
    }
    // Use synchronous Effect
    const result = Effect.runSync(
      Effect.gen(function* () {
        const svc = yield* VariableService
        return yield* svc.groups()
      }).pipe(Effect.provide(VariableService.Default))
    )
    return result
  }, [])
}
