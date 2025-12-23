/**
 * Editor
 *
 * Main block editor component.
 * Renders document blocks with selection and editing support.
 *
 * @module editor/components/Editor
 */

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BlockRenderer } from "./BlockRenderer";
import { useEditor } from "../hooks/useEditor";
import type { BlockId } from "../schemas/block";

// =============================================================================
// Editor Toolbar
// =============================================================================

function EditorToolbar() {
  const editor = useEditor();

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-800 bg-neutral-900/50">
      {/* Block insertion */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => editor.addParagraph()}
          className="px-2 py-1 text-xs font-mono text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
          title="Add Paragraph"
        >
          P
        </button>
        <button
          onClick={() => editor.addHeading("", 2)}
          className="px-2 py-1 text-xs font-mono text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
          title="Add Heading"
        >
          H2
        </button>
        <button
          onClick={() => editor.addCodeBlock()}
          className="px-2 py-1 text-xs font-mono text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
          title="Add Code Block"
        >
          {"</>"}
        </button>
      </div>

      <div className="w-px h-4 bg-neutral-700" />

      {/* History */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => editor.undo()}
          disabled={!editor.canUndo}
          className="px-2 py-1 text-xs font-mono text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
        >
          ↩
        </button>
        <button
          onClick={() => editor.redo()}
          disabled={!editor.canRedo}
          className="px-2 py-1 text-xs font-mono text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo (Ctrl+Shift+Z)"
        >
          ↪
        </button>
      </div>

      <div className="w-px h-4 bg-neutral-700" />

      {/* Mode toggle */}
      <button
        onClick={() => editor.toggleMode()}
        className="px-2 py-1 text-xs font-mono text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
        title="Toggle Mode"
      >
        {editor.mode === "page" ? "📄 Page" : "🎨 Canvas"}
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Status */}
      <div className="flex items-center gap-2">
        {editor.isDirty && (
          <span className="text-xs text-amber-400">● Unsaved</span>
        )}
        <span className="text-xs text-neutral-500 font-mono">
          {editor.blocks.length} blocks
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// Editor Content
// =============================================================================

interface EditorContentProps {
  selectedBlockId: BlockId | null;
  onSelectBlock: (id: BlockId) => void;
}

function EditorContent({ selectedBlockId, onSelectBlock }: EditorContentProps) {
  const editor = useEditor();

  if (editor.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-500">Loading editor...</div>
      </div>
    );
  }

  if (editor.error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">Error loading editor</div>
      </div>
    );
  }

  if (editor.blocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-neutral-500">Empty document</div>
        <button
          onClick={() => editor.addParagraph("Start typing...")}
          className="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-500 text-white rounded transition-colors"
        >
          Add first block
        </button>
      </div>
    );
  }

  return (
    <div className="py-4 space-y-1">
      <AnimatePresence mode="popLayout">
        {editor.blocks.map((block) => (
          <BlockRenderer
            key={block.id}
            block={block}
            selectedBlockId={selectedBlockId}
            onSelectBlock={onSelectBlock}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// Editor
// =============================================================================

export interface EditorProps {
  className?: string;
}

/**
 * Editor - main block editor component
 */
export function Editor({ className = "" }: EditorProps) {
  const editor = useEditor();
  const [selectedBlockId, setSelectedBlockId] = useState<BlockId | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z
      if (e.ctrlKey && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        editor.undo();
      }
      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.ctrlKey && e.shiftKey && e.key === "z") || (e.ctrlKey && e.key === "y")) {
        e.preventDefault();
        editor.redo();
      }
      // Escape: clear selection
      if (e.key === "Escape") {
        setSelectedBlockId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editor]);

  const handleSelectBlock = useCallback((id: BlockId) => {
    setSelectedBlockId(id);
  }, []);

  return (
    <div
      className={`tmnl-editor flex flex-col h-full bg-neutral-950 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div>
          <h1 className="text-lg font-semibold text-neutral-100">
            {editor.document?.meta.title || "Untitled"}
          </h1>
          <p className="text-xs text-neutral-500 font-mono">
            {editor.document?.meta.updatedAt
              ? `Updated ${new Date(editor.document.meta.updatedAt).toLocaleDateString()}`
              : "New document"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 text-xs font-mono rounded ${
              editor.mode === "page"
                ? "bg-blue-500/10 text-blue-400"
                : "bg-purple-500/10 text-purple-400"
            }`}
          >
            {editor.mode.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <EditorToolbar />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <EditorContent
            selectedBlockId={selectedBlockId}
            onSelectBlock={handleSelectBlock}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-neutral-800 text-xs text-neutral-600 flex items-center justify-between">
        <span>TMNL Block Editor v0.1</span>
        <span>
          Press <kbd className="px-1 py-0.5 bg-neutral-800 rounded">Ctrl+Z</kbd> to undo
        </span>
      </div>
    </div>
  );
}

export default Editor;
