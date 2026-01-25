/**
 * WindowsTestbed - Emacs-Style Pane Management Demo
 *
 * Tests the window system with split panes and hotkeys.
 *
 * Hotkeys:
 * - C-x 2: Split horizontal (below)
 * - C-x 3: Split vertical (right)
 * - C-x o: Other window (next pane)
 * - C-x O: Previous window
 * - C-x 0: Delete window (close pane)
 * - C-x 1: Delete other windows
 *
 * @module components/testbed/WindowsTestbed
 */

import { useEffect } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import {
  WindowProvider,
  rootPaneAtom,
  focusedPaneIdAtom,
  allPanesAtom,
  paneCountAtom,
  registerWindowHotkeys,
} from '@/lib/windows'

// =============================================================================
// Testbed Component
// =============================================================================

export function WindowsTestbed() {
  const root = useAtomValue(rootPaneAtom)
  const focusedId = useAtomValue(focusedPaneIdAtom)
  const allPanes = useAtomValue(allPanesAtom)
  const paneCount = useAtomValue(paneCountAtom)

  // Register hotkeys on mount
  useEffect(() => {
    registerWindowHotkeys()
  }, [])

  return (
    <div className="h-full flex flex-col">
      {/* Header with stats */}
      <div className="flex-shrink-0 border-b border-surface-3 bg-surface-1 p-4">
        <h1 className="text-lg font-medium text-text-primary mb-2">
          Windows Testbed
        </h1>
        <p className="text-sm text-text-secondary mb-4">
          Emacs-style pane management. Use hotkeys to split and navigate.
        </p>

        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary">Panes:</span>
            <span className="font-mono text-accent-blue">{paneCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary">Focused:</span>
            <span className="font-mono text-accent-emerald">
              {focusedId?.slice(0, 12) ?? 'none'}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-tertiary">
          <kbd className="rounded bg-surface-3 px-1.5 py-0.5">C-x 2</kbd>
          <span>split below</span>
          <kbd className="rounded bg-surface-3 px-1.5 py-0.5">C-x 3</kbd>
          <span>split right</span>
          <kbd className="rounded bg-surface-3 px-1.5 py-0.5">C-x o</kbd>
          <span>next</span>
          <kbd className="rounded bg-surface-3 px-1.5 py-0.5">C-x 0</kbd>
          <span>close</span>
          <kbd className="rounded bg-surface-3 px-1.5 py-0.5">C-x 1</kbd>
          <span>close others</span>
        </div>
      </div>

      {/* Window Manager */}
      <div className="flex-1 overflow-hidden">
        <WindowProvider enabled className="h-full" />
      </div>

      {/* Debug info */}
      <div className="flex-shrink-0 border-t border-surface-3 bg-surface-1 p-4">
        <details className="text-xs">
          <summary className="cursor-pointer text-text-tertiary hover:text-text-secondary">
            Debug: Pane Tree
          </summary>
          <pre className="mt-2 overflow-auto rounded bg-surface-2 p-2 text-text-secondary">
            {JSON.stringify(root, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  )
}

export default WindowsTestbed
