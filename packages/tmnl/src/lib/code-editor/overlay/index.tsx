/**
 * Code Editor Workspace Overlay
 *
 * A simple absolute-positioned overlay that renders inside AppShell.Workspace.
 * Toggled by an atom. No overlay system, no modals, no panels — just a div.
 *
 * Usage in main.tsx:
 *   <AppShell.Workspace>
 *     <RouterProvider ... />
 *     <CodeEditorWorkspaceOverlay />
 *   </AppShell.Workspace>
 *
 * Toggle from anywhere:
 *   import { toggleCodeEditor, codeEditorOpenAtom } from '@/lib/code-editor/overlay'
 *   toggleCodeEditor()
 *
 * @module code-editor/overlay
 */

import React, { Suspense } from 'react'
import { Atom } from '@effect-atom/atom'
import { useAtomValue } from '@effect-atom/atom-react'
import { VANTA_COLORS } from '@/components/portal/tokens'

// Lazy load Monaco
const CodeEditorLayout = React.lazy(() =>
  import('@/lib/code-editor/CodeEditorLayout').then(m => ({ default: m.CodeEditorLayout }))
)

// =============================================================================
// State — single atom
// =============================================================================

export { codeEditorOpenAtom } from './atom'
import { codeEditorOpenAtom } from './atom'

export function toggleCodeEditor() {
  const current = Atom.get(codeEditorOpenAtom)
  // toggle
  Atom.set(codeEditorOpenAtom, !current)
}

export function openCodeEditor() {
  Atom.set(codeEditorOpenAtom, true)
}

export function closeCodeEditor() {
  Atom.set(codeEditorOpenAtom, false)
}

// =============================================================================
// Loading / Error
// =============================================================================

function EditorLoading() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: VANTA_COLORS.surface.void,
        color: VANTA_COLORS.text.muted,
        fontFamily: '"Share Tech Mono", monospace',
        fontSize: 'var(--tmnl-text-sm, 14px)',
      }}
    >
      Loading editor…
    </div>
  )
}

class EditorErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[CodeEditorOverlay] Error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            background: VANTA_COLORS.surface.void,
            padding: '24px',
          }}
        >
          <div style={{
            color: VANTA_COLORS.accent.rose,
            fontSize: 'var(--tmnl-text-base, 16px)',
            fontFamily: '"Share Tech Mono", monospace',
          }}>
            Editor failed to load
          </div>
          <pre style={{
            color: VANTA_COLORS.text.muted,
            fontSize: 'var(--tmnl-text-xs, 12px)',
            fontFamily: '"Share Tech Mono", monospace',
            maxWidth: '80%',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {this.state.error.message}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

// =============================================================================
// Component
// =============================================================================

/**
 * Drop this inside AppShell.Workspace. It renders on top of routes when open.
 */
export function CodeEditorWorkspaceOverlay() {
  const isOpen = useAtomValue(codeEditorOpenAtom)

  // render gate

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        overflow: 'hidden',
        background: VANTA_COLORS.surface.void,
      }}
      data-tmnl-code-editor-overlay
    >
      <EditorErrorBoundary>
        <Suspense fallback={<EditorLoading />}>
          <CodeEditorLayout />
        </Suspense>
      </EditorErrorBoundary>
    </div>
  )
}
