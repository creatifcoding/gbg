/**
 * CodeEditorBlockView Component
 *
 * React node view for CodeEditorBlock in Tiptap editor.
 * Uses EmbeddedBlockWrapper for fold, badges, focus mode (lifts to FocusOverlay).
 * Embeds Monaco via lazy-loaded CodeEditorLayout.
 *
 * Focus mode = full-viewport Monaco outside Tiptap via FocusOverlay portal.
 *
 * @module editor/v3/extensions/blocks/CodeEditorBlock
 */

import React, { Suspense, useEffect, useMemo, useRef, useCallback } from 'react'
import { type NodeViewProps, NodeViewWrapper } from '@tiptap/react'
import { useAtom } from '@effect-atom/atom-react'
import { Code2 } from 'lucide-react'

import {
  VANTA_COLORS,
  VANTA_BORDERS,
} from '@/components/portal/tokens'
import {
  EmbeddedBlockWrapper,
  type BlockBadge,
} from '../EmbeddedBlockWrapper'
import {
  createCodeEditorBlockAtoms,
  disposeCodeEditorBlockAtoms,
  type CodeEditorState,
} from './atoms'

// Lazy load Monaco — it's heavy
const CodeEditorLayout = React.lazy(() =>
  import('@/lib/code-editor/CodeEditorLayout').then(m => ({ default: m.CodeEditorLayout }))
)

// =============================================================================
// Badge Config
// =============================================================================

const CODE_EDITOR_BADGE: BlockBadge = {
  label: 'CODE',
  color: VANTA_COLORS.accent.cyan,
  icon: Code2,
}

// =============================================================================
// Loading / Error
// =============================================================================

function EditorLoading() {
  return (
    <div
      style={{
        width: '100%',
        height: '300px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: VANTA_COLORS.surface.void,
        color: VANTA_COLORS.text.muted,
        fontFamily: '"Share Tech Mono", monospace',
        fontSize: 'var(--tmnl-text-sm, 14px)',
        borderRadius: VANTA_BORDERS.radius.md,
      }}
    >
      Loading Monaco…
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
    console.error('[CodeEditorBlock] Error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '24px',
          background: VANTA_COLORS.surface.void,
          color: VANTA_COLORS.accent.rose,
          fontFamily: '"Share Tech Mono", monospace',
          fontSize: 'var(--tmnl-text-xs, 12px)',
          borderRadius: VANTA_BORDERS.radius.md,
        }}>
          <div style={{ fontSize: 'var(--tmnl-text-sm, 14px)', marginBottom: '8px' }}>
            Editor failed to load
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: VANTA_COLORS.text.muted }}>
            {this.state.error.message}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

// =============================================================================
// View Component
// =============================================================================

export function CodeEditorBlockView({ node, updateAttributes }: NodeViewProps) {
  const blockId = node.attrs.id as string
  const code = node.attrs.code as string
  const language = node.attrs.language as string

  // Create/get per-instance atoms
  const atoms = useMemo(
    () => createCodeEditorBlockAtoms(blockId, { code, language }),
    [blockId],
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => disposeCodeEditorBlockAtoms(blockId)
  }, [blockId])

  // Sync code changes back to Tiptap attributes
  const handleChange = useCallback((newCode: string) => {
    updateAttributes({ code: newCode })
  }, [updateAttributes])

  return (
    <NodeViewWrapper data-type="codeEditorBlock" data-id={blockId}>
      <EmbeddedBlockWrapper
        blockId={blockId}
        badge={CODE_EDITOR_BADGE}
        title={language.toUpperCase()}
        defaultFoldState="expanded"
        focusable
      >
        <div
          style={{
            width: '100%',
            height: '400px',
            overflow: 'hidden',
            background: VANTA_COLORS.surface.void,
            borderRadius: VANTA_BORDERS.radius.md,
          }}
          data-tmnl-code-editor-block
        >
          <EditorErrorBoundary>
            <Suspense fallback={<EditorLoading />}>
              <CodeEditorLayout />
            </Suspense>
          </EditorErrorBoundary>
        </div>
      </EmbeddedBlockWrapper>
    </NodeViewWrapper>
  )
}
