/**
 * Editor v3 Testbed
 *
 * Development testbed for Tiptap + Effect editor integration.
 * Demonstrates atom-based state, operation atoms, and debug overlays.
 *
 * @module testbed/EditorV3Testbed
 */

import React, { useRef, useCallback, useState } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import {
  TiptapEditor,
  type TiptapEditorHandle,
  editorOps,
  wordCountAtom,
  characterCountAtom,
  canUndoAtom,
  canRedoAtom,
  isDirtyAtom,
  activeMarksAtom,
  selectionAtom,
  editorStatusAtom,
  transactionCountAtom,
  isReadyAtom,
  MorphingSaveButton,
  type SaveState,
} from '@/lib/editor/v3';

// =============================================================================
// Toolbar Button
// =============================================================================

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  children,
  title,
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: '0.5rem 0.75rem',
        background: active
          ? 'var(--tmnl-accent-cyan, #4ecdc4)'
          : 'var(--tmnl-surface-2, #2a2a2a)',
        color: active
          ? 'var(--tmnl-surface-0, #1a1a1a)'
          : 'var(--tmnl-text-primary, #e0e0e0)',
        border: 'none',
        borderRadius: '4px',
        fontFamily: 'var(--tmnl-font-mono)',
        fontSize: 'var(--tmnl-text-sm, 14px)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s ease',
      }}
    >
      {children}
    </button>
  );
}

// =============================================================================
// Toolbar
// =============================================================================

function EditorToolbar() {
  const activeMarks = useAtomValue(activeMarksAtom);
  const canUndo = useAtomValue(canUndoAtom);
  const canRedo = useAtomValue(canRedoAtom);
  const isReady = useAtomValue(isReadyAtom);

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        padding: '0.75rem',
        background: 'var(--tmnl-surface-1, #1e1e1e)',
        borderBottom: '1px solid var(--tmnl-surface-3, #3a3a3a)',
        flexWrap: 'wrap',
      }}
    >
      {/* Formatting */}
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        <ToolbarButton
          onClick={() => editorOps.toggleBold()}
          active={activeMarks.has('bold')}
          disabled={!isReady}
          title="Bold (Ctrl+B)"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editorOps.toggleItalic()}
          active={activeMarks.has('italic')}
          disabled={!isReady}
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editorOps.toggleStrike()}
          active={activeMarks.has('strike')}
          disabled={!isReady}
          title="Strikethrough"
        >
          <s>S</s>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editorOps.toggleCode()}
          active={activeMarks.has('code')}
          disabled={!isReady}
          title="Code"
        >
          {'</>'}
        </ToolbarButton>
      </div>

      <div
        style={{
          width: '1px',
          background: 'var(--tmnl-surface-3, #3a3a3a)',
          margin: '0 0.25rem',
        }}
      />

      {/* History */}
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        <ToolbarButton
          onClick={() => editorOps.undo()}
          disabled={!canUndo || !isReady}
          title="Undo (Ctrl+Z)"
        >
          ↩
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editorOps.redo()}
          disabled={!canRedo || !isReady}
          title="Redo (Ctrl+Shift+Z)"
        >
          ↪
        </ToolbarButton>
      </div>

      <div
        style={{
          width: '1px',
          background: 'var(--tmnl-surface-3, #3a3a3a)',
          margin: '0 0.25rem',
        }}
      />

      {/* Selection */}
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        <ToolbarButton
          onClick={() => editorOps.selectAll()}
          disabled={!isReady}
          title="Select All (Ctrl+A)"
        >
          ⊞ All
        </ToolbarButton>
      </div>
    </div>
  );
}

// =============================================================================
// Status Bar
// =============================================================================

function EditorStatusBar() {
  const wordCount = useAtomValue(wordCountAtom);
  const charCount = useAtomValue(characterCountAtom);
  const isDirty = useAtomValue(isDirtyAtom);
  const selection = useAtomValue(selectionAtom);
  const status = useAtomValue(editorStatusAtom);
  const txCount = useAtomValue(transactionCountAtom);

  return (
    <div
      style={{
        display: 'flex',
        gap: '1.5rem',
        padding: '0.5rem 0.75rem',
        background: 'var(--tmnl-surface-0, #1a1a1a)',
        borderTop: '1px solid var(--tmnl-surface-3, #3a3a3a)',
        fontFamily: 'var(--tmnl-font-mono)',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        color: 'var(--tmnl-text-secondary, #a0a0a0)',
      }}
    >
      <span>
        <span style={{ color: 'var(--tmnl-text-muted, #666)' }}>Words:</span>{' '}
        {wordCount}
      </span>
      <span>
        <span style={{ color: 'var(--tmnl-text-muted, #666)' }}>Chars:</span>{' '}
        {charCount}
      </span>
      <span>
        <span style={{ color: 'var(--tmnl-text-muted, #666)' }}>Pos:</span>{' '}
        {selection ? `${selection.from}-${selection.to}` : '–'}
      </span>
      <span>
        <span style={{ color: 'var(--tmnl-text-muted, #666)' }}>TX:</span>{' '}
        {txCount}
      </span>
      <span
        style={{
          color: isDirty
            ? 'var(--tmnl-status-warning, #ffd93d)'
            : 'var(--tmnl-status-success, #6bcb77)',
        }}
      >
        {isDirty ? '● Modified' : '○ Saved'}
      </span>
      <span style={{ marginLeft: 'auto' }}>
        Status:{' '}
        <span
          style={{
            color:
              status === 'ready'
                ? 'var(--tmnl-status-success, #6bcb77)'
                : 'var(--tmnl-text-muted, #666)',
          }}
        >
          {status}
        </span>
      </span>
    </div>
  );
}

// =============================================================================
// Debug Panel
// =============================================================================

function DebugPanel() {
  const activeMarks = useAtomValue(activeMarksAtom);
  const selection = useAtomValue(selectionAtom);
  const status = useAtomValue(editorStatusAtom);
  const canUndo = useAtomValue(canUndoAtom);
  const canRedo = useAtomValue(canRedoAtom);

  return (
    <div
      style={{
        padding: '1rem',
        background: 'var(--tmnl-surface-0, #1a1a1a)',
        borderLeft: '1px solid var(--tmnl-surface-3, #3a3a3a)',
        fontFamily: 'var(--tmnl-font-mono)',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        minWidth: '200px',
        overflow: 'auto',
      }}
    >
      <h3
        style={{
          margin: '0 0 1rem 0',
          color: 'var(--tmnl-accent-cyan, #4ecdc4)',
          fontSize: 'var(--tmnl-text-sm, 14px)',
        }}
      >
        Atom Debug
      </h3>

      <div style={{ marginBottom: '1rem' }}>
        <div
          style={{
            color: 'var(--tmnl-text-muted, #666)',
            marginBottom: '0.25rem',
          }}
        >
          editorStatusAtom
        </div>
        <div style={{ color: 'var(--tmnl-text-primary, #e0e0e0)' }}>
          {status}
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div
          style={{
            color: 'var(--tmnl-text-muted, #666)',
            marginBottom: '0.25rem',
          }}
        >
          activeMarksAtom
        </div>
        <div style={{ color: 'var(--tmnl-text-primary, #e0e0e0)' }}>
          {activeMarks.size > 0 ? Array.from(activeMarks).join(', ') : '(none)'}
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div
          style={{
            color: 'var(--tmnl-text-muted, #666)',
            marginBottom: '0.25rem',
          }}
        >
          selectionAtom
        </div>
        <pre
          style={{
            margin: 0,
            color: 'var(--tmnl-text-primary, #e0e0e0)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {selection ? JSON.stringify(selection, null, 2) : 'null'}
        </pre>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div
          style={{
            color: 'var(--tmnl-text-muted, #666)',
            marginBottom: '0.25rem',
          }}
        >
          History
        </div>
        <div style={{ color: 'var(--tmnl-text-primary, #e0e0e0)' }}>
          undo: {canUndo ? '✓' : '✗'} | redo: {canRedo ? '✓' : '✗'}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Testbed
// =============================================================================

export function EditorV3Testbed() {
  const editorRef = useRef<TiptapEditorHandle>(null);

  const handleReady = useCallback(() => {
    console.log('[EditorV3Testbed] Editor ready');
  }, []);

  const handleChange = useCallback(() => {
    // Content changed - could trigger auto-save here
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--tmnl-surface-0, #1a1a1a)',
        color: 'var(--tmnl-text-primary, #e0e0e0)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '1rem',
          borderBottom: '1px solid var(--tmnl-surface-3, #3a3a3a)',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--tmnl-font-mono)',
            fontSize: 'var(--tmnl-text-lg, 18px)',
            fontWeight: 400,
          }}
        >
          Editor v3 Testbed
          <span
            style={{
              marginLeft: '0.75rem',
              padding: '0.25rem 0.5rem',
              background: 'var(--tmnl-accent-cyan, #4ecdc4)',
              color: 'var(--tmnl-surface-0, #1a1a1a)',
              borderRadius: '4px',
              fontSize: 'var(--tmnl-text-xs, 12px)',
            }}
          >
            Tiptap + Effect
          </span>
        </h1>
        <p
          style={{
            margin: '0.5rem 0 0 0',
            color: 'var(--tmnl-text-secondary, #a0a0a0)',
            fontSize: 'var(--tmnl-text-sm, 14px)',
          }}
        >
          EffectBridge syncs ProseMirror state to effect-atom. Operations via
          editorOps.
        </p>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Editor panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <EditorToolbar />

          <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
            <TiptapEditor
              ref={editorRef}
              placeholder="Start typing..."
              autoFocus
              onReady={handleReady}
              onChange={handleChange}
              style={{
                height: '100%',
                minHeight: '400px',
              }}
            />
          </div>

          <EditorStatusBar />
        </div>

        {/* Debug panel */}
        <DebugPanel />
      </div>
    </div>
  );
}

export default EditorV3Testbed;
