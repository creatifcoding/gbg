/**
 * CodeEditorRoute — Code Editor inside AppShell workspace
 *
 * Renders the TMNL code editor inside the workspace grid cell.
 * Uses 100% width/height to fill the workspace area (NOT 100vw/vh
 * which would overflow the AppShell grid).
 *
 * Available at /editor route.
 *
 * @module routes/CodeEditorRoute
 */

import React, { Suspense } from 'react'
import { VANTA_COLORS } from '@/components/portal/tokens'

// Lazy load the heavy Monaco editor layout to avoid crashing the route on import
const CodeEditorLayout = React.lazy(() =>
  import('@/lib/code-editor/CodeEditorLayout').then(m => ({ default: m.CodeEditorLayout }))
)

function EditorLoadingFallback() {
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
    console.error('[CodeEditorRoute] Error boundary caught:', error, info)
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
            color: VANTA_COLORS.accent.rose,
            fontFamily: '"Share Tech Mono", monospace',
            fontSize: 'var(--tmnl-text-sm, 14px)',
            padding: '24px',
          }}
        >
          <div style={{ color: VANTA_COLORS.text.primary, fontSize: 'var(--tmnl-text-lg, 18px)' }}>
            Editor failed to load
          </div>
          <pre
            style={{
              color: VANTA_COLORS.text.muted,
              fontSize: 'var(--tmnl-text-xs, 12px)',
              maxWidth: '600px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

export function CodeEditorRoute() {
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <EditorErrorBoundary>
        <Suspense fallback={<EditorLoadingFallback />}>
          <CodeEditorLayout />
        </Suspense>
      </EditorErrorBoundary>
    </div>
  )
}

export default CodeEditorRoute
