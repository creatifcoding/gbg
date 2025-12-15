/**
 * TMNL Variables v2 — React Hooks
 *
 * React hooks for accessing and modifying variables.
 *
 * @example
 * ```typescript
 * import { useVariable, useVariableValue } from '@/lib/variables/v2'
 *
 * function EditorSettings() {
 *   // Full access with mutations
 *   const { value, set, reset, source, isModified } = useVariable('editor.tabWidth')
 *
 *   // Read-only value
 *   const fontSize = useVariableValue('editor.fontSize')
 *
 *   return (
 *     <div>
 *       <input value={value} onChange={(e) => set(Number(e.target.value))} />
 *       {isModified && <button onClick={reset}>Reset</button>}
 *     </div>
 *   )
 * }
 * ```
 */

import { useCallback, useEffect, useMemo } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { Effect, Option, Schema } from 'effect'
import { Atom } from '@effect-atom/atom'
import * as Variable from './Variable'
import * as scope from './internal/scope'
import * as internal from './internal/core'

// ─────────────────────────────────────────────────────────────────────────────
// Variable Atoms (using Atom.family for parameterized access)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atom family for resolved variable values.
 * Each variable ID gets its own derived atom that subscribes to all scope atoms.
 */
export const variableAtom = Atom.family((variableId: string) =>
  Atom.make((get) => {
    // Subscribe to all scope atoms for reactivity
    get(scope.userScopeAtom)
    get(scope.workspaceScopesAtom)
    get(scope.editorScopesAtom)
    get(scope.currentWorkspaceAtom)
    get(scope.currentEditorAtom)

    // Get definition
    const def = internal.getVariableDefinition(variableId)
    if (Option.isNone(def)) {
      return undefined
    }

    // Resolve value using scope chain
    return scope.resolveValueSync(variableId, def.value)
  })
)

// ─────────────────────────────────────────────────────────────────────────────
// useVariable — Full Access Hook
// ─────────────────────────────────────────────────────────────────────────────

export interface UseVariableReturn<A> {
  /** Current value (undefined if not found) */
  readonly value: A | undefined
  /** Where the value came from */
  readonly source: scope.ValueSource | undefined
  /** Whether value differs from default */
  readonly isModified: boolean
  /** Variable metadata */
  readonly metadata: {
    readonly id: string
    readonly description: string
    readonly hasComputedDefault: boolean
  } | undefined
  /** Set the value (user scope) */
  readonly set: (value: A) => Promise<void>
  /** Reset to default (remove user customization) */
  readonly reset: () => void
  /** Make buffer-local (copy to editor scope) */
  readonly makeLocal: () => Promise<void>
}

/**
 * Hook for full variable access with mutations.
 *
 * @example
 * ```typescript
 * const { value, set, reset, source, isModified } = useVariable('editor.tabWidth')
 * ```
 */
export function useVariable<A = unknown>(variableId: string): UseVariableReturn<A> {
  // Subscribe to value changes via Atom.family
  const resolved = useAtomValue(variableAtom(variableId))

  // Get metadata (static, doesn't change)
  const metadata = useMemo(() => {
    const desc = Variable.describe(variableId)
    return Option.isSome(desc) ? desc.value : undefined
  }, [variableId])

  // Mutations
  const set = useCallback(
    async (value: A) => {
      await Effect.runPromise(Variable.set(variableId, value))
    },
    [variableId]
  )

  const reset = useCallback(() => {
    scope.removeUserValue(variableId)
  }, [variableId])

  const makeLocal = useCallback(async () => {
    await Effect.runPromise(Variable.makeLocal(variableId))
  }, [variableId])

  return useMemo(
    () => ({
      value: resolved?.value as A | undefined,
      source: resolved?.source,
      isModified: resolved?.isModified ?? false,
      metadata,
      set,
      reset,
      makeLocal,
    }),
    [resolved, metadata, set, reset, makeLocal]
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// useVariableValue — Read-Only Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for read-only variable value access.
 * Simpler API when you don't need mutations.
 *
 * @example
 * ```typescript
 * const fontSize = useVariableValue<number>('editor.fontSize')
 * ```
 */
export function useVariableValue<A = unknown>(variableId: string): A | undefined {
  const { value } = useVariable<A>(variableId)
  return value
}

/**
 * Hook for read-only variable value with type assertion.
 *
 * @example
 * ```typescript
 * const fontSize = useVariableValueAs('editor.fontSize', Schema.Number)
 * ```
 */
export function useVariableValueAs<A>(
  variableId: string,
  schema: Schema.Schema<A, unknown>
): A | undefined {
  const value = useVariableValue(variableId)
  if (value === undefined) return undefined

  const decoded = Schema.decodeUnknownEither(schema)(value)
  return decoded._tag === 'Right' ? decoded.right : undefined
}

// ─────────────────────────────────────────────────────────────────────────────
// useVariableGroups — List Groups
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook to get all variable groups.
 *
 * @example
 * ```typescript
 * const groups = useVariableGroups()
 * // → ['editor', 'appearance', 'keybindings']
 * ```
 */
export function useVariableGroups(): ReadonlyArray<string> {
  return useMemo(() => Variable.groups(), [])
}

// ─────────────────────────────────────────────────────────────────────────────
// useVariableList — List Variables
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook to list variables, optionally filtered by group.
 *
 * @example
 * ```typescript
 * const allVars = useVariableList()
 * const editorVars = useVariableList('editor')
 * ```
 */
export function useVariableList(group?: string): ReadonlyArray<string> {
  return useMemo(
    () => (group ? Variable.listByGroup(group) : Variable.list()),
    [group]
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// useVariablePersistence — Persistence Hook
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'tmnl:variables:v2:user'

/**
 * Hook to setup variable persistence.
 * Call once at app root.
 *
 * @example
 * ```typescript
 * function App() {
 *   useVariablePersistence()
 *   return <YourApp />
 * }
 * ```
 */
export function useVariablePersistence(options?: { debounceMs?: number }): void {
  const debounceMs = options?.debounceMs ?? 1000

  // Load on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (typeof parsed === 'object' && parsed !== null) {
          scope.setUserScopeFromObject(parsed)
        }
      }
    } catch (e) {
      console.warn('[useVariablePersistence] Failed to load:', e)
    }
  }, [])

  // Subscribe to user scope changes
  const userScope = useAtomValue(scope.userScopeAtom)

  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userScope))
      } catch (e) {
        console.warn('[useVariablePersistence] Failed to save:', e)
      }
    }, debounceMs)

    return () => clearTimeout(timeout)
  }, [userScope, debounceMs])
}

// ─────────────────────────────────────────────────────────────────────────────
// Context Hooks — For Setting Current Editor/Workspace
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook to set the current editor context.
 * Variables with 'editor' scope will use this.
 *
 * @example
 * ```typescript
 * function Editor({ id }: { id: string }) {
 *   useEditorContext(id as EditorId)
 *   // Variables now resolve in this editor's scope
 * }
 * ```
 */
export function useEditorContext(editorId: scope.EditorId | null): void {
  useEffect(() => {
    scope.setCurrentEditor(editorId)
    return () => {
      if (editorId) {
        scope.clearEditorScope(editorId)
      }
      scope.setCurrentEditor(null)
    }
  }, [editorId])
}

/**
 * Hook to set the current workspace context.
 * Variables with 'workspace' scope will use this.
 *
 * @example
 * ```typescript
 * function Workspace({ id }: { id: string }) {
 *   useWorkspaceContext(id as WorkspaceId)
 *   // Variables now resolve in this workspace's scope
 * }
 * ```
 */
export function useWorkspaceContext(workspaceId: scope.WorkspaceId | null): void {
  useEffect(() => {
    scope.setCurrentWorkspace(workspaceId)
    return () => scope.setCurrentWorkspace(null)
  }, [workspaceId])
}
