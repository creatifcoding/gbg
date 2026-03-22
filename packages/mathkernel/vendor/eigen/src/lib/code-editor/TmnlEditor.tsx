/**
 * TmnlEditor — Main Code Editor Surface
 *
 * Wraps MonacoEditorReactComp from @typefox/monaco-editor-react with:
 * - VANTA void theme registration
 * - monaco-vim integration
 * - effect-atom state sync (cursor, language, dirty, vim mode)
 * - Tauri FS hooks for file operations
 *
 * Phase 1: Standalone editor with VANTA theme + vim. No LSP.
 *
 * @module code-editor/TmnlEditor
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { MonacoEditorReactComp } from '@typefox/monaco-editor-react'
import type { EditorApp } from 'monaco-languageclient/editorApp'
import * as monaco from 'monaco-editor'
import { VANTA_THEME_ID, VANTA_THEME_DATA, TMNL_EDITOR_OPTIONS } from './theme/vanta-monaco-theme'
import { ALL_SYNTAX_TOKENS } from './theme/vanta-syntax-tokens'
import {
  setCursor,
  setSelectionCount,
  setLanguage,
  setVimMode,
  markDirty,
  activeTabAtom,
  editorConfigAtom,
} from './atoms'
import { useAtomValue } from '@effect-atom/atom-react'
import type { TabId } from './schemas'

// =============================================================================
// Theme Registration (module-level, runs once)
// =============================================================================

let themeRegistered = false

function registerVantaTheme() {
  if (themeRegistered) return
  try {
    // Merge extended syntax tokens into the base theme
    const extendedTheme: monaco.editor.IStandaloneThemeData = {
      ...VANTA_THEME_DATA,
      rules: [...VANTA_THEME_DATA.rules, ...ALL_SYNTAX_TOKENS],
    }
    monaco.editor.defineTheme(VANTA_THEME_ID, extendedTheme)
    themeRegistered = true
  } catch {
    // Monaco may not be fully loaded yet; will retry on mount
  }
}

// Try eagerly
registerVantaTheme()

// =============================================================================
// Vim Mode Integration
// =============================================================================

interface VimModeHandle {
  dispose: () => void
}

/**
 * Initialize monaco-vim on an editor instance.
 * Returns a dispose handle.
 */
function initVim(
  editor: monaco.editor.IStandaloneCodeEditor,
  statusBarEl: HTMLElement | null,
): VimModeHandle | null {
  try {
    // monaco-vim exports initVimMode
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { initVimMode } = require('monaco-vim')
    const vimMode = initVimMode(editor, statusBarEl)

    // Sync vim mode changes to atoms
    const statusCallback = (mode: string) => {
      const normalized = mode?.toLowerCase() ?? 'normal'
      if (['normal', 'insert', 'visual', 'replace', 'command'].includes(normalized)) {
        setVimMode(normalized as 'normal' | 'insert' | 'visual' | 'replace' | 'command')
      }
    }

    // monaco-vim fires mode change events — listen via the status bar
    // The mode text appears in the status bar element
    if (statusBarEl) {
      const observer = new MutationObserver(() => {
        const text = statusBarEl.textContent?.trim() ?? ''
        if (text.startsWith('--')) {
          const mode = text.replace(/^--\s*/, '').replace(/\s*--$/, '').toLowerCase()
          statusCallback(mode)
        } else {
          statusCallback('normal')
        }
      })
      observer.observe(statusBarEl, { childList: true, subtree: true, characterData: true })

      return {
        dispose: () => {
          observer.disconnect()
          vimMode?.dispose?.()
        },
      }
    }

    return {
      dispose: () => {
        vimMode?.dispose?.()
      },
    }
  } catch (e) {
    console.warn('[TmnlEditor] Failed to initialize vim mode:', e)
    return null
  }
}

// =============================================================================
// Component Props
// =============================================================================

export interface TmnlEditorProps {
  /** Initial file content */
  value?: string
  /** File URI (for model identification) */
  uri?: string
  /** Language ID */
  language?: string
  /** External change handler */
  onChange?: (value: string) => void
  /** Called when editor is fully mounted and ready */
  onReady?: (editor: monaco.editor.IStandaloneCodeEditor) => void
  /** Container style */
  style?: CSSProperties
  /** Container className */
  className?: string
  /** Active tab ID (for dirty state tracking) */
  tabId?: TabId
  /** Whether to render the vim status bar */
  showVimStatus?: boolean
}

// =============================================================================
// Component
// =============================================================================

/**
 * TmnlEditor — The TMNL code editor surface.
 *
 * Renders a Monaco editor with VANTA theme, vim mode, and atom state sync.
 * For Phase 1, this is a standalone editor with no LSP.
 */
export function TmnlEditor({
  value = '',
  uri = 'file:///untitled',
  language = 'typescript',
  onChange,
  onReady,
  style,
  className,
  tabId,
  showVimStatus = true,
}: TmnlEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const vimRef = useRef<VimModeHandle | null>(null)
  const vimStatusRef = useRef<HTMLDivElement | null>(null)
  const [ready, setReady] = useState(false)

  // Subscribe to config atom
  const configResult = useAtomValue(editorConfigAtom)
  const config =
    configResult && 'value' in configResult ? configResult.value : null

  // Ensure theme is registered
  useEffect(() => {
    registerVantaTheme()
  }, [])

  // Handle editor ready
  const handleEditorStartDone = useCallback(
    (editorApp?: EditorApp) => {
      if (!editorApp) return

      const editor = editorApp.getEditor()
      if (!editor) return

      editorRef.current = editor
      setReady(true)

      // ─── Apply VANTA theme ───────────────────────
      monaco.editor.setTheme(VANTA_THEME_ID)

      // ─── Wire cursor position sync ───────────────
      editor.onDidChangeCursorPosition((e) => {
        setCursor(e.position.lineNumber, e.position.column)
      })

      // ─── Wire selection sync ─────────────────────
      editor.onDidChangeCursorSelection((e) => {
        const sel = e.selection
        if (sel.isEmpty()) {
          setSelectionCount(0)
        } else {
          const model = editor.getModel()
          if (model) {
            const text = model.getValueInRange(sel)
            setSelectionCount(text.length)
          }
        }
      })

      // ─── Wire content change → dirty state ──────
      editor.onDidChangeModelContent(() => {
        if (tabId) {
          markDirty(tabId, true)
        }
        const model = editor.getModel()
        if (model && onChange) {
          onChange(model.getValue())
        }
      })

      // ─── Wire language change ────────────────────
      const model = editor.getModel()
      if (model) {
        setLanguage(model.getLanguageId())
        model.onDidChangeLanguage((e) => {
          setLanguage(e.newLanguage)
        })
      }

      // ─── Initialize vim mode ─────────────────────
      if (config?.vimMode !== false) {
        vimRef.current = initVim(editor, vimStatusRef.current)
        setVimMode('normal')
      }

      // Notify parent
      onReady?.(editor)
    },
    [tabId, onChange, onReady, config?.vimMode],
  )

  // Dispose vim on unmount
  useEffect(() => {
    return () => {
      vimRef.current?.dispose()
      vimRef.current = null
    }
  }, [])

  // Update editor options when config changes
  useEffect(() => {
    if (!editorRef.current || !config) return

    editorRef.current.updateOptions({
      fontSize: config.fontSize,
      lineHeight: config.lineHeight,
      letterSpacing: config.letterSpacing,
      minimap: { enabled: config.minimap },
      lineNumbers: config.lineNumbers ? 'on' : 'off',
      wordWrap: config.wordWrap ? 'on' : 'off',
      tabSize: config.tabSize,
      insertSpaces: config.indentStyle === 'spaces',
    })
  }, [config])

  // Toggle vim mode when config changes
  useEffect(() => {
    if (!editorRef.current) return

    if (config?.vimMode && !vimRef.current) {
      vimRef.current = initVim(editorRef.current, vimStatusRef.current)
      setVimMode('normal')
    } else if (!config?.vimMode && vimRef.current) {
      vimRef.current.dispose()
      vimRef.current = null
      setVimMode(null)
    }
  }, [config?.vimMode])

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: '#000000',
        ...style,
      }}
      data-tmnl-editor
    >
      {/* Editor area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MonacoEditorReactComp
          vscodeApiConfig={{
            $type: 'classic',
            userConfiguration: {
              json: JSON.stringify({
                'workbench.colorTheme': VANTA_THEME_ID,
                'editor.fontSize': config?.fontSize ?? 13,
                'editor.fontFamily':
                  config?.fontFamily ??
                  '"Share Tech Mono", "JetBrains Mono", "Fira Code", monospace',
                'editor.lineHeight': config?.lineHeight ?? 1.6,
                'editor.letterSpacing': config?.letterSpacing ?? 0.3,
                'editor.cursorStyle': 'block',
                'editor.cursorBlinking': 'phase',
                'editor.cursorSmoothCaretAnimation': 'on',
                'editor.smoothScrolling': true,
                'editor.minimap.enabled': config?.minimap ?? false,
                'editor.renderLineHighlight': 'gutter',
                'editor.scrollBeyondLastLine': false,
                'editor.padding.top': 12,
                'editor.padding.bottom': 12,
                'editor.overviewRulerBorder': false,
                'editor.guides.indentation': true,
                'editor.guides.bracketPairs': true,
                'editor.bracketPairColorization.enabled': true,
                'editor.wordBasedSuggestions': 'off',
              }),
            },
          }}
          editorAppConfig={{
            codeResources: {
              main: {
                text: value,
                uri,
                enforceLanguageId: language,
              },
            },
            editorOptions: {
              ...TMNL_EDITOR_OPTIONS,
            },
          }}
          style={{ height: '100%' }}
          onEditorStartDone={handleEditorStartDone}
          onTextChanged={(text, isDirty) => {
            if (onChange) onChange(text)
            if (tabId && isDirty) markDirty(tabId, true)
          }}
          onError={(e) => {
            console.error('[TmnlEditor] Error:', e)
          }}
        />
      </div>

      {/* Vim status bar (hidden element for monaco-vim to write mode info) */}
      {showVimStatus && (
        <div
          ref={vimStatusRef}
          style={{
            height: 0,
            overflow: 'hidden',
            position: 'absolute',
            pointerEvents: 'none',
          }}
          data-tmnl-vim-status
        />
      )}
    </div>
  )
}

export default TmnlEditor
