/**
 * withEditorAI HOC
 *
 * Higher-Order Component that wraps an editor component and:
 * 1. Auto-registers it with EditorRegistry on mount
 * 2. Auto-unregisters on unmount
 * 3. Applies data attributes for debugging
 *
 * @module editor-ai/components/withEditorAI
 */

import React, { useEffect, useRef, useMemo, forwardRef } from 'react'
import type { Editor } from '@tiptap/core'

import { useEditorAIContext } from './EditorAIProvider'
import { TiptapAdapter } from '../adapters'
import type { EditorId } from '../schemas/editor'
import type { EditorOperationsShape } from '../services/EditorOperations'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface WithEditorAIConfig {
  /**
   * Unique editor ID. CRITICAL for state isolation.
   */
  id: EditorId

  /**
   * Human-readable name for debugging.
   */
  name?: string

  /**
   * Custom EditorOperations factory.
   * If not provided, uses TiptapAdapter.fromEditor() when editor ref is available.
   */
  createOperations?: (editor: Editor) => EditorOperationsShape
}

export interface WithEditorAIInjectedProps {
  /**
   * Ref to the underlying editor instance.
   * The wrapped component should call editorRef.current = editor when ready.
   */
  editorRef: React.MutableRefObject<Editor | null>

  /**
   * The assigned editor ID.
   */
  editorAIId: EditorId
}

// -----------------------------------------------------------------------------
// HOC Implementation
// -----------------------------------------------------------------------------

/**
 * Wraps an editor component to auto-register with EditorAI.
 *
 * Usage:
 * ```tsx
 * interface MyEditorProps {
 *   initialContent?: string
 * }
 *
 * function MyEditor({ editorRef, editorAIId, initialContent }: MyEditorProps & WithEditorAIInjectedProps) {
 *   // Set editorRef.current when TipTap editor is ready
 *   return <TiptapEditor onReady={(editor) => { editorRef.current = editor }} />
 * }
 *
 * const AIEnabledEditor = withEditorAI(MyEditor, {
 *   id: 'main-editor' as EditorId,
 *   name: 'Main Editor',
 * })
 *
 * // Use in EditorAIProvider
 * <EditorAIProvider>
 *   <AIEnabledEditor initialContent="Hello" />
 * </EditorAIProvider>
 * ```
 */
export function withEditorAI<P extends object>(
  WrappedComponent: React.ComponentType<P & WithEditorAIInjectedProps>,
  config: WithEditorAIConfig
): React.FC<Omit<P, keyof WithEditorAIInjectedProps>> {
  const displayName =
    WrappedComponent.displayName || WrappedComponent.name || 'Component'

  function WithEditorAIWrapper(props: Omit<P, keyof WithEditorAIInjectedProps>) {
    const { register } = useEditorAIContext()
    const editorRef = useRef<Editor | null>(null)
    const unregisterRef = useRef<(() => void) | null>(null)
    const isRegisteredRef = useRef(false)

    // Create operations from editor when available
    const createOperationsFromEditor = useMemo(() => {
      if (config.createOperations) {
        return config.createOperations
      }
      // Default: use TiptapAdapter
      return (editor: Editor): EditorOperationsShape =>
        TiptapAdapter.fromEditor(editor, config.id)
    }, [])

    // Effect to watch for editor becoming available and register
    useEffect(() => {
      // Check periodically for editor availability
      // This handles async editor initialization
      const checkInterval = setInterval(() => {
        const editor = editorRef.current

        if (editor && !isRegisteredRef.current) {
          // Editor is available, register it
          const operations = createOperationsFromEditor(editor)
          unregisterRef.current = register(config.id, operations)
          isRegisteredRef.current = true
          clearInterval(checkInterval)
        }
      }, 50) // Check every 50ms

      // Also check immediately
      const editor = editorRef.current
      if (editor && !isRegisteredRef.current) {
        const operations = createOperationsFromEditor(editor)
        unregisterRef.current = register(config.id, operations)
        isRegisteredRef.current = true
        clearInterval(checkInterval)
      }

      return () => {
        clearInterval(checkInterval)

        // Unregister on unmount
        if (unregisterRef.current) {
          unregisterRef.current()
          unregisterRef.current = null
          isRegisteredRef.current = false
        }
      }
    }, [register, createOperationsFromEditor])

    // Injected props
    const injectedProps: WithEditorAIInjectedProps = {
      editorRef,
      editorAIId: config.id,
    }

    return (
      <div
        data-editor-ai-id={config.id}
        data-editor-ai-name={config.name ?? config.id}
        style={{ display: 'contents' }}
      >
        <WrappedComponent {...(props as P)} {...injectedProps} />
      </div>
    )
  }

  WithEditorAIWrapper.displayName = `withEditorAI(${displayName})`

  return WithEditorAIWrapper
}

// -----------------------------------------------------------------------------
// Ref-Forwarding Variant
// -----------------------------------------------------------------------------

/**
 * Ref-forwarding version of withEditorAI for components that need ref access.
 */
export function withEditorAIRef<P extends object, R>(
  WrappedComponent: React.ForwardRefExoticComponent<
    React.PropsWithoutRef<P & WithEditorAIInjectedProps> & React.RefAttributes<R>
  >,
  config: WithEditorAIConfig
): React.ForwardRefExoticComponent<
  React.PropsWithoutRef<Omit<P, keyof WithEditorAIInjectedProps>> &
    React.RefAttributes<R>
> {
  const displayName = WrappedComponent.displayName || 'Component'

  const WithEditorAIRefWrapper = forwardRef<
    R,
    Omit<P, keyof WithEditorAIInjectedProps>
  >((props, ref) => {
    const { register } = useEditorAIContext()
    const editorRef = useRef<Editor | null>(null)
    const unregisterRef = useRef<(() => void) | null>(null)
    const isRegisteredRef = useRef(false)

    const createOperationsFromEditor = useMemo(() => {
      if (config.createOperations) {
        return config.createOperations
      }
      return (editor: Editor): EditorOperationsShape =>
        TiptapAdapter.fromEditor(editor, config.id)
    }, [])

    useEffect(() => {
      const checkInterval = setInterval(() => {
        const editor = editorRef.current
        if (editor && !isRegisteredRef.current) {
          const operations = createOperationsFromEditor(editor)
          unregisterRef.current = register(config.id, operations)
          isRegisteredRef.current = true
          clearInterval(checkInterval)
        }
      }, 50)

      const editor = editorRef.current
      if (editor && !isRegisteredRef.current) {
        const operations = createOperationsFromEditor(editor)
        unregisterRef.current = register(config.id, operations)
        isRegisteredRef.current = true
        clearInterval(checkInterval)
      }

      return () => {
        clearInterval(checkInterval)
        if (unregisterRef.current) {
          unregisterRef.current()
          unregisterRef.current = null
          isRegisteredRef.current = false
        }
      }
    }, [register, createOperationsFromEditor])

    const injectedProps: WithEditorAIInjectedProps = {
      editorRef,
      editorAIId: config.id,
    }

    return (
      <div
        data-editor-ai-id={config.id}
        data-editor-ai-name={config.name ?? config.id}
        style={{ display: 'contents' }}
      >
        <WrappedComponent ref={ref} {...(props as P)} {...injectedProps} />
      </div>
    )
  })

  WithEditorAIRefWrapper.displayName = `withEditorAIRef(${displayName})`

  return WithEditorAIRefWrapper
}

export default withEditorAI
