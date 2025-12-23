/**
 * EditorTestbed
 *
 * Testbed for the TMNL Block Editor.
 * Demonstrates block editing, undo/redo, and mode switching.
 *
 * @module testbed/EditorTestbed
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Editor, useEditor } from "@/lib/editor";
import { createDocument, createParagraph, createHeading, createCodeBlock } from "@/lib/editor";
import type { Document } from "@/lib/editor";

// =============================================================================
// Sample Documents
// =============================================================================

const SAMPLE_DOCUMENT: Document = {
  id: crypto.randomUUID() as any,
  meta: {
    title: "Welcome to TMNL Editor",
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  },
  blocks: [
    createHeading("Welcome to TMNL Block Editor", 1),
    createParagraph("This is a native block-based document editor inspired by AFFiNE's BlockSuite, but implemented entirely with Effect + React."),
    createHeading("Features", 2),
    createParagraph("• Effect.Service architecture with Atom-as-State pattern"),
    createParagraph("• Schema-validated block types using Effect Schema"),
    createParagraph("• Undo/Redo history with configurable stack size"),
    createParagraph("• Page mode (linear) and Canvas mode (freeform)"),
    createHeading("Try It Out", 2),
    createParagraph("Click on any block to select it. Use the toolbar above to add new blocks. Press Ctrl+Z to undo, Ctrl+Shift+Z to redo."),
    createCodeBlock(`// EditorService with Atom-as-State
class EditorService extends Effect.Service<EditorService>()(
  "tmnl/EditorService",
  {
    effect: Effect.gen(function* () {
      const stateAtom = Atom.make<EditorState>({
        document: createDocument(),
        selection: null,
        mode: "page",
        history: { past: [], future: [] },
        isDirty: false,
      });

      return {
        atoms: { state: stateAtom },
        addBlock: (block) => Effect.sync(() => { ... }),
        // ...
      };
    }),
  }
) {}`, "typescript"),
  ],
};

// =============================================================================
// Sidebar Panel
// =============================================================================

function SidebarPanel() {
  const editor = useEditor();

  return (
    <div className="w-64 border-r border-neutral-800 flex flex-col bg-neutral-900/50">
      <div className="p-4 border-b border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-200">Document Info</h2>
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        {/* Document stats */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-500">Blocks</span>
            <span className="text-neutral-200 font-mono">{editor.blocks.length}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-neutral-500">Mode</span>
            <span className="text-teal-400 font-mono">{editor.mode}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-neutral-500">Dirty</span>
            <span className={`font-mono ${editor.isDirty ? "text-amber-400" : "text-neutral-400"}`}>
              {editor.isDirty ? "Yes" : "No"}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-neutral-500">Can Undo</span>
            <span className={`font-mono ${editor.canUndo ? "text-emerald-400" : "text-neutral-400"}`}>
              {editor.canUndo ? "Yes" : "No"}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-neutral-500">Can Redo</span>
            <span className={`font-mono ${editor.canRedo ? "text-emerald-400" : "text-neutral-400"}`}>
              {editor.canRedo ? "Yes" : "No"}
            </span>
          </div>
        </div>

        {/* Block type breakdown */}
        <div>
          <h3 className="text-xs font-medium text-neutral-400 mb-2">Block Types</h3>
          <div className="space-y-1">
            {Object.entries(
              editor.blocks.reduce((acc, block) => {
                acc[block._tag] = (acc[block._tag] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([type, count]) => (
              <div key={type} className="flex justify-between text-xs">
                <span className="text-neutral-500">{type}</span>
                <span className="text-neutral-200 font-mono">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-neutral-800 space-y-2">
        <button
          onClick={() => editor.createNew("New Document")}
          className="w-full px-3 py-2 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded transition-colors"
        >
          New Document
        </button>
        <button
          onClick={() => editor.loadDocument(SAMPLE_DOCUMENT)}
          className="w-full px-3 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-500 text-white rounded transition-colors"
        >
          Load Sample
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// EditorTestbed
// =============================================================================

export function EditorTestbed() {
  return (
    <div className="h-screen flex bg-neutral-950">
      {/* Sidebar */}
      <SidebarPanel />

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        <Editor className="flex-1" />
      </div>
    </div>
  );
}

export default EditorTestbed;
