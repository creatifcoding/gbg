/**
 * Code Editor File Operations
 *
 * Bridges Tauri's native FS commands to the editor's atom state.
 * Uses existing TMNL file_browser commands for read/write,
 * and @tauri-apps/plugin-dialog for open/save dialogs.
 *
 * @module code-editor/file-ops
 */

import { invoke } from '@tauri-apps/api/core'
import { openTab, markDirty, activeTabAtom, editorStateAtom } from './atoms'
import { Atom } from '@effect-atom/atom'
import type { TabId } from './schemas'

// =============================================================================
// Language Detection
// =============================================================================

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescriptreact',
  '.js': 'javascript',
  '.jsx': 'javascriptreact',
  '.rs': 'rust',
  '.py': 'python',
  '.lua': 'lua',
  '.css': 'css',
  '.scss': 'scss',
  '.html': 'html',
  '.htm': 'html',
  '.json': 'json',
  '.jsonc': 'json',
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.nix': 'nix',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.fish': 'shell',
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  '.xml': 'xml',
  '.svg': 'xml',
  '.txt': 'plaintext',
}

/**
 * Detect language from file path extension.
 */
export function detectLanguage(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  return EXTENSION_TO_LANGUAGE[ext] ?? 'plaintext'
}

/**
 * Extract filename from a file path.
 */
export function extractLabel(filePath: string): string {
  const segments = filePath.replace(/\\/g, '/').split('/')
  return segments[segments.length - 1] ?? filePath
}

// =============================================================================
// File Read/Write via Tauri Commands
// =============================================================================

/**
 * Read a file's contents as UTF-8 text.
 * Uses the existing TMNL fs_read_file Tauri command.
 */
export async function readFile(path: string): Promise<string> {
  const bytes = await invoke<number[]>('fs_read_file', { path })
  return new TextDecoder().decode(new Uint8Array(bytes))
}

/**
 * Write text content to a file.
 * Uses the existing TMNL fs_write_file Tauri command.
 */
export async function writeFile(path: string, content: string): Promise<void> {
  const encoder = new TextEncoder()
  const data = Array.from(encoder.encode(content))
  await invoke('fs_write_file', { path, data })
}

// =============================================================================
// High-Level Editor Operations
// =============================================================================

/**
 * Open a file in the editor.
 * Reads the file, detects the language, opens a tab.
 * Returns the file content.
 */
export async function openFileInEditor(filePath: string): Promise<string> {
  const content = await readFile(filePath)
  const language = detectLanguage(filePath)
  const label = extractLabel(filePath)
  const uri = `file://${filePath}`

  openTab(uri, language, label)
  return content
}

/**
 * Save the active tab's content to disk.
 * Extracts the file path from the tab URI.
 */
export async function saveActiveFile(content: string): Promise<void> {
  const state = Atom.get(editorStateAtom)
  const activeId = state.activeTabId
  if (!activeId) return

  const tab = state.tabs.find((t) => t.id === activeId)
  if (!tab) return

  // Extract path from URI — strip file:// prefix
  const path = tab.uri.replace(/^file:\/\//, '')

  await writeFile(path, content)
  markDirty(activeId, false)
}

/**
 * Open file dialog and load the selected file.
 * Uses Tauri dialog plugin if available, falls back to manual path.
 */
export async function openFileDialog(): Promise<string | null> {
  try {
    // Try using Tauri dialog plugin
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: 'Code',
          extensions: [
            'ts', 'tsx', 'js', 'jsx', 'rs', 'py', 'lua',
            'css', 'scss', 'html', 'json', 'md', 'yaml', 'yml',
            'toml', 'nix', 'sh', 'sql', 'graphql', 'xml', 'txt',
          ],
        },
        { name: 'All Files', extensions: ['*'] },
      ],
    })

    if (selected && typeof selected === 'string') {
      return await openFileInEditor(selected)
    }
    return null
  } catch {
    console.warn('[file-ops] Dialog plugin not available')
    return null
  }
}

/**
 * Check if running inside Tauri (has invoke capability).
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
