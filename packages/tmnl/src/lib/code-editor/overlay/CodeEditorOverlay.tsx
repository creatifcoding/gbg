/**
 * CodeEditorOverlay — Monaco editor rendered inside AppShell.Workspace
 *
 * Uses a simple atom toggle + absolute positioning inside the workspace.
 * No routing needed, no floating panel system needed.
 *
 * Usage:
 *   import { codeEditorOpen } from '@/lib/code-editor/overlay/CodeEditorOverlay'
 *   import { overlayRegistry } from '@/lib/overlays/atoms'
 *
 *   // Open:
 *   overlayRegistry.set(codeEditorOpen, true)
 *
 *   // Or from a React component:
 *   const { openCodeEditor } = useCodeEditorOverlay()
 *   openCodeEditor()
 *
 * Mount <CodeEditorWorkspaceOverlay /> inside AppShell.Workspace.
 *
 * @module code-editor/overlay/CodeEditorOverlay
 */

import React, { Suspense, useCallback } from 'react'
import { Atom } from '@effect-atom/atom'
import { useAtomValue } from '@effect-atom/atom-react'
import { overlayRegistry } from '@/lib/overlays/atoms'
import { VANTA_COLORS } from '@/components/portal/tokens'

// =============================================================================
// State atom
// =============================================================================

/** Whether the code editor overlay is visible in the workspace */
export const codeEditorOpen = Atom.make(false)

// =============================================================================
// Imperative API (for commands / non-React contexts)
// =============================================================================

export function openCodeEditor(): void {
  overlayRegistry.set(codeEditorOpen, true)
}

export function closeCodeEditor(): void {
  overlayRegistry.set(codeEditorOpen, false)
}

export function toggleCodeEditor(): void {
  const current = overlayRegistry.get(codeEditorOpen)
  overlayRegistry.set(codeEditorOpen, !current)
}

// =============================================================================
// Hook
// =============================================================================

export function useCodeEditorOverlay() {
  const isOpen = useAtomValue(codeEditorOpen, { registry: overlayRegistry })

  const open = useCallback(() => overlayRegistry.set(codeEditorOpen, true), [])
  const close = useCallback(() => overlayRegistry.set(codeEditorOpen, false), [])
  const toggle = useCallback(() => {
    overlayRegistry.set(codeEditorOpen, !overlayRegistry.get(codeEditorOpen))
  }, [])

  return { isOpen, openCodeEditor: open, closeCodeEditor: close, toggleCodeEditor: toggle }
}

// =============================================================================
// Lazy Monaco
// =============================================================================

const CodeEditorLayout = React.lazy(() =>
  import('@/lib/code-editor/CodeEditorLayout').then(m => ({ default: m.CodeEditorLayout }))
)

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
            fontFamily: '"Share Tech Mono", mon