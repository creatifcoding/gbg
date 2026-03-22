/**
 * TMNL Code Editor — Public API
 *
 * Native code editor built on Monaco, themed with VANTA,
 * managed by Effect-TS atoms, with vim mode and Tauri FS integration.
 *
 * @module code-editor
 *
 * @example
 * ```tsx
 * import { CodeEditorLayout } from "@/lib/code-editor"
 *
 * function EditorPage() {
 *   return <CodeEditorLayout style={{ height: '100vh' }} />
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Low-level: just the editor component
 * import { TmnlEditor } from "@/lib/code-editor"
 *
 * function InlineEditor() {
 *   return (
 *     <TmnlEditor
 *       value="const x = 42;"
 *       language="typescript"
 *       style={{ height: '400px' }}
 *     />
 *   )
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Atom state access
 * import {
 *   editorStateAtom,
 *   activeTabAtom,
 *   openTab,
 *   closeTab,
 *   toggleVimMode,
 * } from "@/lib/code-editor"
 * ```
 */

// ─── Schemas ─────────────────────────────────────────────────
export type {
  TabId,
  EditorTab,
  EditorState,
  EditorConfig,
  EditorLayout,
  LspStatus,
  LanguageId,
  IndentStyle,
  CursorPosition,
  StatusLineState,
  FileMetadata,
  VimMode,
} from './schemas'
export { DEFAULT_EDITOR_CONFIG } from './schemas'

// Workspace overlay
export {
  CodeEditorWorkspaceOverlay,
  codeEditorOpenAtom,
  openCodeEditor,
  closeCodeEditor,
  toggleCodeEditor,
} from './overlay'

// Floating panel (for testbeds / standalone use)
export { CodeEditorPanel, CODE_EDITOR_PANEL_TYPE } from './panels/CodeEditorPanel'

// ─── Theme ───────────────────────────────────────────────────
export { VANTA_THEME_ID, VANTA_THEME_DATA, TMNL_EDITOR_OPTIONS } from './theme/vanta-monaco-theme'
export { ALL_SYNTAX_TOKENS } from './theme/vanta-syntax-tokens'

// ─── Atoms ───────────────────────────────────────────────────
export {
  // State atoms
  editorStateAtom,
  editorConfigAtom,
  lspStatusAtom,
  statusLineAtom,
  // Derived atoms
  activeTabAtom,
  tabsAtom,
  hasDirtyTabsAtom,
  tabCountAtom,
  // Tab operations
  openTab,
  closeTab,
  setActiveTab,
  markDirty,
  togglePin,
  closeAllTabs,
  setLayout,
  // Status line operations
  setCursor,
  setSelectionCount,
  setLanguage,
  setVimMode,
  // Config operations
  toggleVimMode,
  setFontSize,
  toggleMinimap,
  toggleWordWrap,
} from './atoms'

// ─── Components ──────────────────────────────────────────────
export { TmnlEditor } from './TmnlEditor'
export type { TmnlEditorProps } from './TmnlEditor'
export { TmnlEditorTabs } from './TmnlEditorTabs'
export type { TmnlEditorTabsProps } from './TmnlEditorTabs'
export { TmnlEditorStatusLine } from './TmnlEditorStatusLine'
export type { TmnlEditorStatusLineProps } from './TmnlEditorStatusLine'
export { CodeEditorLayout } from './CodeEditorLayout'
export type { CodeEditorLayoutProps } from './CodeEditorLayout'

// ─── File Operations ─────────────────────────────────────────
export {
  readFile,
  writeFile,
  openFileInEditor,
  saveActiveFile,
  openFileDialog,
  detectLanguage,
  extractLabel,
  isTauri,
} from './file-ops'
