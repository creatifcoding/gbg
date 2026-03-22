/**
 * CodeEditorLayout — Complete Editor Surface
 *
 * Composes TmnlEditor + TmnlEditorTabs + TmnlEditorStatusLine
 * into a full editor experience. This is the component that gets
 * wired into routing and the layer system.
 *
 * @module code-editor/CodeEditorLayout
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import type * as monaco from 'monaco-editor'
import { VANTA_COLORS } from '@/components/portal/tokens'
import { TmnlEditor } from './TmnlEditor'
import { TmnlEditorTabs } from './TmnlEditorTabs'
import { TmnlEditorStatusLine } from './TmnlEditorStatusLine'
import {
  activeTabAtom,
  editorStateAtom,
  openTab,
} from './atoms'
import { openFileInEditor, openFileDialog, isTauri } from './file-ops'
import type { TabId } from './schemas'

// =============================================================================
// Welcome Screen (shown when no tabs are open)
// =============================================================================

function WelcomeScreen({ onOpenFile }: { onOpenFile: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: '16px',
        color: VANTA_COLORS.text.muted,
        fontFamily: '"Share Tech Mono", monospace',
      }}
    >
      <div
        style={{
          fontSize: 'var(--tmnl-text-lg, 18px)',
          color: VANTA_COLORS.text.tertiary,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        TMNL Editor
      </div>

      <div
        style={{
          fontSize: 'var(--tmnl-text-sm, 14px)',
          color: VANTA_COLORS.text.muted,
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        <div>Open a file to begin editing</div>
        <div style={{ marginTop: '8px', color: VANTA_COLORS.text.tertiary }}>
          {isTauri() ? (
            <button
              onClick={onOpenFile}
              style={{
                background: 'transparent',
                border: `1px solid ${VANTA_COLORS.surface.border}`,
                color: VANTA_COLORS.accent.cyan,
                padding: '8px 16px',
                fontFamily: '"Share Tech Mono", monospace',
                fontSize: 'var(--tmnl-text-sm, 14px)',
                cursor: 'pointer',
                borderRadius: '2px',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = VANTA_COLORS.accent.cyan
                e.currentTarget.style.boxShadow = `0 0 8px ${VANTA_COLORS.accent.cyanGlow}`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = VANTA_COLORS.surface.border
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              Open File…
            </button>
          ) : (
            'Running in browser — file access requires Tauri'
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: '24px',
          fontSize: 'var(--tmnl-text-xs, 12px)',
          color: VANTA_COLORS.text.muted,
          textAlign: 'center',
          lineHeight: 1.8,
        }}
      >
        <div>Vim mode enabled — press <span style={{ color: VANTA_COLORS.accent.cyan }}>i</span> to insert</div>
        <div>Press <span style={{ color: VANTA_COLORS.accent.cyan }}>Esc</span> to return to normal mode</div>
      </div>
    </div>
  )
}

// =============================================================================
// Editor Layout
// =============================================================================

export interface CodeEditorLayoutProps {
  /** Initial file to open */
  initialFilePath?: string
  /** Height of the entire editor surface */
  style?: React.CSSProperties
  /** Class name for the container */
  className?: string
}

export function CodeEditorLayout({
  initialFilePath,
  style,
  className,
}: CodeEditorLayoutProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const [content, setContent] = useState('')
  const [ready, setReady] = useState(false)

  // Atom subscriptions
  const activeResult = useAtomValue(activeTabAtom)
  const activeTab =
    activeResult && 'value' in activeResult ? activeResult.value : null

  const stateResult = useAtomValue(editorStateAtom)
  const state =
    stateResult && 'value' in stateResult ? stateResult.value : null

  // Open initial file on mount
  useEffect(() => {
    if (initialFilePath) {
      openFileInEditor(initialFilePath).then(setContent).catch(console.error)
    }
  }, [initialFilePath])

  // Handle editor ready
  const handleReady = useCallback((editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor
    setReady(true)
  }, [])

  // Handle file open dialog
  const handleOpenFile = useCallback(async () => {
    const result = await openFileDialog()
    if (result) setContent(result)
  }, [])

  // Handle content changes
  const handleChange = useCallback((value: string) => {
    setContent(value)
  }, [])

  const hasTabs = state && state.tabs.length > 0

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: VANTA_COLORS.surface.void,
        overflow: 'hidden',
        ...style,
      }}
      data-tmnl-code-editor-layout
    >
      {/* Tab bar */}
      <TmnlEditorTabs height={32} />

      {/* Editor area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {hasTabs ? (
          <TmnlEditor
            value={content}
            uri={activeTab?.uri ?? 'file:///untitled'}
            language={activeTab?.language ?? 'typescript'}
            tabId={activeTab?.id as TabId | undefined}
            onChange={handleChange}
            onReady={handleReady}
          />
        ) : (
          <WelcomeScreen onOpenFile={handleOpenFile} />
        )}
      </div>

      {/* Status line */}
      <TmnlEditorStatusLine height={24} />
    </div>
  )
}

export default CodeEditorLayout
