/**
 * EditorAIProvider
 *
 * Context provider that initializes the EditorAI runtime and provides
 * registration hooks for editors.
 *
 * Uses a simplified approach: stores EditorOperationsShape directly in
 * a React ref, rather than building a full Effect runtime. This avoids
 * the complexity of async Layer building while still providing the
 * Effect.Service pattern for type safety.
 *
 * @module editor-ai/components/EditorAIProvider
 */

import React, {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  useState,
} from 'react'
import { Registry } from '@effect-atom/atom-react'
import { Effect, Layer, Option, HashMap, Ref } from 'effect'

import type { EditorOperationsShape } from '../services/EditorOperations'
import type { EditorId } from '../schemas/editor'

// -----------------------------------------------------------------------------
// Internal State
// -----------------------------------------------------------------------------

interface EditorAIState {
  editors: Map<EditorId, EditorOperationsShape>
  focusedId: EditorId | null
}

// -----------------------------------------------------------------------------
// Context Types
// -----------------------------------------------------------------------------

export interface EditorAIContextValue {
  /**
   * Register an editor with the EditorAI system.
   * Returns unregister function for cleanup.
   */
  register: (id: EditorId, operations: EditorOperationsShape) => () => void

  /**
   * Get an editor by ID.
   */
  getEditor: (id: EditorId) => EditorOperationsShape | undefined

  /**
   * Get all registered editor IDs.
   */
  getAllEditorIds: () => readonly EditorId[]

  /**
   * Get the currently focused editor ID.
   */
  getFocusedEditorId: () => EditorId | null

  /**
   * Set the focused editor.
   */
  setFocusedEditor: (id: EditorId | null) => void

  /**
   * Get the focused editor operations.
   */
  getFocusedEditor: () => EditorOperationsShape | undefined

  /**
   * Registry for effect-atom operations.
   */
  registry: Registry

  /**
   * Run an Effect with the editor state.
   * Simplified version that uses the internal state directly.
   */
  runEffect: <A>(
    fn: (state: EditorAIState) => A
  ) => A
}

const EditorAIContext = createContext<EditorAIContextValue | null>(null)

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Access the EditorAI context.
 * Must be used within EditorAIProvider.
 */
export function useEditorAIContext(): EditorAIContextValue {
  const ctx = useContext(EditorAIContext)
  if (!ctx) {
    throw new Error('useEditorAIContext must be used within EditorAIProvider')
  }
  return ctx
}

// -----------------------------------------------------------------------------
// Provider Props
// -----------------------------------------------------------------------------

export interface EditorAIProviderProps {
  children: React.ReactNode

  /**
   * Optional custom registry. If not provided, creates a new one.
   */
  registry?: Registry

  /**
   * Callback when an editor is registered.
   */
  onEditorRegistered?: (id: EditorId) => void

  /**
   * Callback when an editor is unregistered.
   */
  onEditorUnregistered?: (id: EditorId) => void
}

// -----------------------------------------------------------------------------
// Provider Component
// -----------------------------------------------------------------------------

/**
 * EditorAIProvider initializes the EditorAI system and provides context
 * for editor registration and AI operations.
 *
 * Usage:
 * ```tsx
 * <EditorAIProvider>
 *   <MyEditorComponent />
 * </EditorAIProvider>
 * ```
 */
export function EditorAIProvider({
  children,
  registry: externalRegistry,
  onEditorRegistered,
  onEditorUnregistered,
}: EditorAIProviderProps) {
  // Create or use provided registry
  const registry = useMemo(
    () => externalRegistry ?? Registry.make(),
    [externalRegistry]
  )

  // Internal state stored in ref for stability
  const stateRef = useRef<EditorAIState>({
    editors: new Map(),
    focusedId: null,
  })

  // Force update for consumers when state changes
  const [, forceUpdate] = useState(0)

  // Register function
  const register = useCallback(
    (id: EditorId, operations: EditorOperationsShape): (() => void) => {
      stateRef.current.editors.set(id, operations)
      onEditorRegistered?.(id)
      forceUpdate((n) => n + 1)

      console.debug(`[EditorAIProvider] Registered editor: ${id}`)

      // Return unregister function
      return () => {
        stateRef.current.editors.delete(id)

        // Clear focus if this was the focused editor
        if (stateRef.current.focusedId === id) {
          stateRef.current.focusedId = null
        }

        onEditorUnregistered?.(id)
        forceUpdate((n) => n + 1)

        console.debug(`[EditorAIProvider] Unregistered editor: ${id}`)
      }
    },
    [onEditorRegistered, onEditorUnregistered]
  )

  // Getters
  const getEditor = useCallback(
    (id: EditorId): EditorOperationsShape | undefined => {
      return stateRef.current.editors.get(id)
    },
    []
  )

  const getAllEditorIds = useCallback((): readonly EditorId[] => {
    return Array.from(stateRef.current.editors.keys())
  }, [])

  const getFocusedEditorId = useCallback((): EditorId | null => {
    return stateRef.current.focusedId
  }, [])

  const setFocusedEditor = useCallback((id: EditorId | null): void => {
    stateRef.current.focusedId = id
    forceUpdate((n) => n + 1)
    console.debug(`[EditorAIProvider] Focused editor: ${id ?? 'none'}`)
  }, [])

  const getFocusedEditor = useCallback((): EditorOperationsShape | undefined => {
    const focusedId = stateRef.current.focusedId
    if (!focusedId) return undefined
    return stateRef.current.editors.get(focusedId)
  }, [])

  // Run effect with state
  const runEffect = useCallback(<A,>(fn: (state: EditorAIState) => A): A => {
    return fn(stateRef.current)
  }, [])

  // Context value
  const contextValue = useMemo<EditorAIContextValue>(
    () => ({
      register,
      getEditor,
      getAllEditorIds,
      getFocusedEditorId,
      setFocusedEditor,
      getFocusedEditor,
      registry,
      runEffect,
    }),
    [
      register,
      getEditor,
      getAllEditorIds,
      getFocusedEditorId,
      setFocusedEditor,
      getFocusedEditor,
      registry,
      runEffect,
    ]
  )

  return (
    <EditorAIContext.Provider value={contextValue}>
      {children}
    </EditorAIContext.Provider>
  )
}

export default EditorAIProvider
