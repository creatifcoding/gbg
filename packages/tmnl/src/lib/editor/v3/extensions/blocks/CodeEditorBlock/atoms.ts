/**
 * CodeEditorBlock Atoms
 *
 * Per-instance atom state for Monaco editor blocks.
 * Follows DataGridBlock pattern: create/get/dispose lifecycle.
 *
 * @module editor/v3/extensions/blocks/CodeEditorBlock/atoms
 */

import { Atom } from '@effect-atom/atom'

// =============================================================================
// Types
// =============================================================================

export interface CodeEditorState {
  /** Source code content */
  code: string
  /** Language mode */
  language: string
  /** File path (if associated with a file) */
  filePath: string | null
  /** Whether content has unsaved changes */
  dirty: boolean
  /** Vim mode state */
  vimMode: 'normal' | 'insert' | 'visual' | 'replace' | 'command'
  /** Cursor position */
  cursor: { line: number; column: number }
}

export interface CodeEditorBlockAtoms {
  state: ReturnType<typeof Atom.make<CodeEditorState>>
}

// =============================================================================
// Defaults
// =============================================================================

export const DEFAULT_CODE = `// TMNL Code Editor
// Press 'i' to enter insert mode (Vim)

function hello() {
  console.log("Hello from TMNL");
}
`

export const DEFAULT_LANGUAGE = 'typescript'

const DEFAULT_STATE: CodeEditorState = {
  code: DEFAULT_CODE,
  language: DEFAULT_LANGUAGE,
  filePath: null,
  dirty: false,
  vimMode: 'normal',
  cursor: { line: 1, column: 1 },
}

// =============================================================================
// Instance Registry
// =============================================================================

const atomsMap = new Map<string, CodeEditorBlockAtoms>()

/**
 * Create atoms for a new CodeEditorBlock instance.
 */
export function createCodeEditorBlockAtoms(
  blockId: string,
  initialState?: Partial<CodeEditorState>,
): CodeEditorBlockAtoms {
  const existing = atomsMap.get(blockId)
  if (existing) return existing

  const atoms: CodeEditorBlockAtoms = {
    state: Atom.make<CodeEditorState>({ ...DEFAULT_STATE, ...initialState }),
  }

  atomsMap.set(blockId, atoms)
  return atoms
}

/**
 * Get atoms for an existing CodeEditorBlock instance.
 */
export function getCodeEditorBlockAtoms(blockId: string): CodeEditorBlockAtoms | undefined {
  return atomsMap.get(blockId)
}

/**
 * Dispose atoms when block is removed.
 */
export function disposeCodeEditorBlockAtoms(blockId: string): void {
  atomsMap.delete(blockId)
}
