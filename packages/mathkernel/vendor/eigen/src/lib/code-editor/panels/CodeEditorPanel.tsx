/**
 * CodeEditorPanel — Monaco editor as a floating panel
 *
 * Registered with PanelRegistry so it can be spawned via:
 *   openRegisteredPanel('code-editor')
 *
 * @module code-editor/panels/CodeEditorPanel
 */

import React, { Suspense } from 'react'
import { registerPanelType } from '@/lib/floating/PanelRegistry'
import { VANTA_COLORS } from '@/components/portal/tokens'

// Lazy load Monaco — it's heavy
const CodeEditorLayout = React.lazy(() =>
  import('@/lib/code-editor/CodeEditorLayout').then(m => ({ default: m.CodeEditorLayout }))
)

export const CODE_EDITOR_PANEL_TYPE = 'code-editor'

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
    console.error('[CodeEditorPanel] Error:', error, info)
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
            maxWidth: '100%',
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

export function CodeEditorPanel({ panelId }: { panelId: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: VANTA_COLORS.surface.void,
      }}
      data-panel-id={panelId}
      data-tmnl-code-editor-panel
    >
      <EditorErrorBoundary>
        <Suspense fallback={<EditorLoading />}>
          <CodeEditorLayout />
        </Suspense>
      </EditorErrorBoundary>
    </div>
  )
}

// Register at module init — side-effect import from main.tsx or egui/panels
registerPanelType({
  id: CODE_EDITOR_PANEL_TYPE,
  title: 'Code Editor',
  component: CodeEditorPanel,
  defaultDimensions: { width: 900, height: 600 },
  minDimensions: { width: 480, height: 320 },
  resizable: true,
  minimizable: true,
  closable: true,
})
