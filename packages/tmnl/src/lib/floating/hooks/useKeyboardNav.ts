/**
 * useKeyboardNav — Niri-style keyboard navigation for panels
 *
 * Keybinding scheme (mirrors ~/.config/niri/config.kdl):
 *
 *   FOCUS:
 *     Alt+H / Alt+Left   → focus panel left
 *     Alt+L / Alt+Right  → focus panel right
 *     Alt+J / Alt+Down   → focus panel down
 *     Alt+K / Alt+Up     → focus panel up
 *
 *   MOVE (swap):
 *     Alt+Shift+H / Alt+Shift+Left  → swap panel left
 *     Alt+Shift+L / Alt+Shift+Right → swap panel right
 *     Alt+Shift+J / Alt+Shift+Down  → swap panel down
 *     Alt+Shift+K / Alt+Shift+Up    → swap panel up
 *
 *   FLOAT / DOCK:
 *     Alt+Shift+F  → toggle: float↔dock
 *
 *   SPAWN / SPLIT:
 *     Alt+Enter    → spawn new panel (live harness)
 *     Alt+-        → horizontal split (new column right)
 *     Alt+_ (Shift+-)  → vertical split (new row below)
 *
 *   TABS:
 *     Alt+`        → cycle to next tab
 *     Alt+~ (Shift+`)  → cycle to previous tab
 *     Alt+1…9      → jump to tab by index (1-based)
 *
 *   ACTIONS:
 *     Alt+W        → toggle collapse (tiled: fold into strip)
 *     Alt+F        → maximize / restore
 *     Alt+D        → dock floating panel
 *     Alt+Q        → close panel
 *     Alt+Shift+X  → close panel (alias)
 *
 * Debounce: repeatable keys (focus, swap, split) are debounced at 80ms
 * to prevent runaway repeats on held keys. One-shot keys (spawn, close,
 * float/dock, maximize) fire once per press.
 *
 * @module
 */

import { useEffect, useRef, useCallback } from 'react'
import {
  moveFocusInDirection,
  togglePanelCollapsed,
  maximizePanel,
  restorePanel,
  floatPanel,
  tilePanel,
  splitPanelInDirection,
  closePanelFull,
  spawnPanel,
  setActiveTab,
  toggleFocusedCollapsed,
} from '../stx/actions'
import { getFloatingStx } from '../floating-stx'
import { getColumnPanelIds } from '../types/strip'
import { isLeaf } from '../layout/split-tree/types'
import {
  isTiled,
  isFloating,
  swapInDirection,
  focusFloatingInDirection,
} from './keyboard-nav-helpers'

// =============================================================================
// Tab switching helpers
// =============================================================================

/** Get the full tab list for a panel: [panelId (home), ...ghostTabs] */
function getTabList(panelId: string): string[] {
  const stx = getFloatingStx()
  const panel = stx.data.panels.get(panelId)?.peek()
  if (!panel) return [panelId]
  return [panelId, ...(panel.tabs ?? [])]
}

/** Cycle to the next/previous tab. Wraps around. */
function cycleTab(panelId: string, direction: 1 | -1): void {
  const tabs = getTabList(panelId)
  if (tabs.length < 2) return

  const panel = getFloatingStx().data.panels.get(panelId)?.peek()
  const activeTabId = panel?.activeTabId ?? panelId
  const currentIdx = tabs.indexOf(activeTabId)
  const nextIdx = (currentIdx + direction + tabs.length) % tabs.length
  setActiveTab(panelId, tabs[nextIdx])
}

/** Jump to tab by 1-based index. */
function jumpToTab(panelId: string, oneBasedIndex: number): void {
  const tabs = getTabList(panelId)
  const idx = oneBasedIndex - 1
  if (idx >= 0 && idx < tabs.length) {
    setActiveTab(panelId, tabs[idx])
  }
}

// =============================================================================
// Debounce — per-key cooldown map
// =============================================================================

const DEBOUNCE_MS = 80

/** Track last fire time per logical action key */
const lastFired = new Map<string, number>()

/** Returns true if the action should fire (not within cooldown) */
function shouldFire(actionKey: string): boolean {
  const now = performance.now()
  const last = lastFired.get(actionKey) ?? 0
  if (now - last < DEBOUNCE_MS) return false
  lastFired.set(actionKey, now)
  return true
}

// =============================================================================
// Hook
// =============================================================================

export function useKeyboardNav(): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Only Alt-based shortcuts (no Ctrl, no Meta)
      if (!e.altKey || e.ctrlKey || e.metaKey) return

      const stx = getFloatingStx()
      const activeId = stx.data.activePanel.peek()
      const shift = e.shiftKey

      // ─── Alt+Enter: spawn (no active panel needed) ───────
      if (e.key === 'Enter' && !shift) {
        e.preventDefault()
        if (!shouldFire('spawn')) return
        spawnPanel('morphchat:harness', { mode: 'tiled' })
        return
      }

      if (!activeId) return

      const panelIsTiled = isTiled(activeId)
      const panelIsFloating = isFloating(activeId)

      switch (e.key) {
        // ─── Focus / Swap: Left ─────────────────────────────
        case 'h':
        case 'H':
        case 'ArrowLeft': {
          e.preventDefault()
          const action = shift ? 'swap-left' : 'focus-left'
          if (!shouldFire(action)) return
          if (shift && panelIsTiled) {
            swapInDirection('left')
          } else if (panelIsTiled) {
            moveFocusInDirection('left')
          } else {
            focusFloatingInDirection('left')
          }
          break
        }

        // ─── Focus / Swap: Right ────────────────────────────
        case 'l':
        case 'L':
        case 'ArrowRight': {
          e.preventDefault()
          const action = shift ? 'swap-right' : 'focus-right'
          if (!shouldFire(action)) return
          if (shift && panelIsTiled) {
            swapInDirection('right')
          } else if (panelIsTiled) {
            moveFocusInDirection('right')
          } else {
            focusFloatingInDirection('right')
          }
          break
        }

        // ─── Focus / Swap: Down ─────────────────────────────
        case 'j':
        case 'J':
        case 'ArrowDown': {
          e.preventDefault()
          const action = shift ? 'swap-down' : 'focus-down'
          if (!shouldFire(action)) return
          if (shift && panelIsTiled) {
            swapInDirection('down')
          } else if (panelIsTiled) {
            moveFocusInDirection('down')
          } else {
            focusFloatingInDirection('down')
          }
          break
        }

        // ─── Focus / Swap: Up ───────────────────────────────
        case 'k':
        case 'K':
        case 'ArrowUp': {
          e.preventDefault()
          const action = shift ? 'swap-up' : 'focus-up'
          if (!shouldFire(action)) return
          if (shift && panelIsTiled) {
            swapInDirection('up')
          } else if (panelIsTiled) {
            moveFocusInDirection('up')
          } else {
            focusFloatingInDirection('up')
          }
          break
        }

        // ─── Float ↔ Dock toggle / Maximize ─────────────────
        case 'f':
        case 'F':
          e.preventDefault()
          if (shift) {
            // Alt+Shift+F → toggle float/dock (one-shot)
            if (panelIsTiled) {
              floatPanel(activeId)
            } else if (panelIsFloating) {
              tilePanel(activeId)
            }
          } else {
            // Alt+F → maximize/restore (one-shot)
            const panel = stx.data.panels.get(activeId)?.peek()
            if (panel?.isMaximized) {
              restorePanel(activeId)
            } else {
              maximizePanel(activeId)
            }
          }
          break

        // ─── Dock (explicit) ────────────────────────────────
        case 'd':
          if (!shift && panelIsFloating) {
            e.preventDefault()
            tilePanel(activeId)
          }
          break

        // ─── Collapse toggle ────────────────────────────────
        // Single-leaf column: collapse whole column (strip level)
        // Multi-panel column: collapse individual panel within tree
        case 'w':
          if (!shift && panelIsTiled) {
            e.preventDefault()
            const strip = stx.data.strip.peek()
            const colIdx = strip.columns.findIndex(col =>
              getColumnPanelIds(col).includes(activeId),
            )
            if (colIdx >= 0 && isLeaf(strip.columns[colIdx].tree)) {
              // Single panel in column → collapse the whole column
              toggleFocusedCollapsed()
            } else {
              // Multi-panel tree → collapse individual panel
              togglePanelCollapsed(activeId)
            }
          }
          break

        // ─── Split: horizontal (Alt + -) ────────────────────
        case '-':
          if (!shift && panelIsTiled) {
            e.preventDefault()
            if (!shouldFire('hsplit')) return
            splitPanelInDirection(activeId, 'horizontal')
          }
          break

        // ─── Split: vertical (Alt + Shift + - = _) ─────────
        case '_':
          if (panelIsTiled) {
            e.preventDefault()
            if (!shouldFire('vsplit')) return
            splitPanelInDirection(activeId, 'vertical')
          }
          break

        // ─── Close panel ────────────────────────────────────
        case 'q':
          if (!shift) {
            e.preventDefault()
            closePanelFull(activeId)
          }
          break

        // ─── Close panel (Shift+X alias) ────────────────────
        case 'x':
        case 'X':
          if (shift) {
            e.preventDefault()
            closePanelFull(activeId)
          }
          break

        // ─── Tab cycle: Alt+` forward, Alt+~ backward ──────
        case '`':
          e.preventDefault()
          cycleTab(activeId, 1)
          break

        case '~':
          e.preventDefault()
          cycleTab(activeId, -1)
          break

        // ─── Tab jump: Alt+1 through Alt+9 ─────────────────
        case '1': case '2': case '3': case '4': case '5':
        case '6': case '7': case '8': case '9':
          e.preventDefault()
          jumpToTab(activeId, parseInt(e.key, 10))
          break

        default:
          return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
