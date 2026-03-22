/**
 * useKeyboardDispatch — Floating panel shortcuts via TanStack Hotkeys.
 *
 * Replaces the hand-rolled keyboard listener with @tanstack/react-hotkeys.
 *
 * Design goals:
 * - Robust input safety: Alt/single-key shortcuts ignored while typing
 * - One-shot safety: spawn/close/toggle actions use requireReset
 * - Repeatable actions debounced (focus/swap/split/tab-cycle/nudge)
 * - Alt+D is single-owner action: dock (floating) OR width cycle (tiled)
 *
 * @module floating/hooks/useKeyboardDispatch
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useHotkey } from '@tanstack/react-hotkeys'
import { useSelector } from '@/lib/stx'
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
  cycleFocusedWidth,
} from '../stx/actions'
import {
  getFloatingStx,
  getPanel as stxGetPanel,
  updatePanelPosition,
  bringPanelToFront,
} from '../floating-stx'
import { togglePanelOverlay } from '../overlay'
import { getColumnPanelIds } from '../types/strip'
import { isLeaf } from '../layout/split-tree/types'
import {
  isTiled,
  isFloating,
  swapInDirection,
  focusFloatingInDirection,
} from './keyboard-nav-helpers'
import {
  applyMagneticSnap,
  clampToViewport,
  type PanelRect,
  type Viewport,
} from '../utils/position'

// =============================================================================
// Local helpers
// =============================================================================

function getTabList(panelId: string): string[] {
  const stx = getFloatingStx()
  const panel = stx.data.panels.get(panelId)?.peek()
  if (!panel) return [panelId]
  return [panelId, ...(panel.tabs ?? [])]
}

function cycleTab(panelId: string, direction: 1 | -1): void {
  const tabs = getTabList(panelId)
  if (tabs.length < 2) return

  const panel = getFloatingStx().data.panels.get(panelId)?.peek()
  const activeTabId = panel?.activeTabId ?? panelId
  const currentIdx = tabs.indexOf(activeTabId)
  const nextIdx = (currentIdx + direction + tabs.length) % tabs.length
  setActiveTab(panelId, tabs[nextIdx])
}

function jumpToTab(panelId: string, oneBasedIndex: number): void {
  const tabs = getTabList(panelId)
  const idx = oneBasedIndex - 1
  if (idx >= 0 && idx < tabs.length) {
    setActiveTab(panelId, tabs[idx])
  }
}

function useKeyboardModalOpen(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') return

    const compute = () => {
      setOpen(document.querySelector('[data-kb-modal]') !== null)
    }

    compute()

    const observer = new MutationObserver(compute)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-kb-modal'],
    })

    return () => observer.disconnect()
  }, [])

  return open
}

type ShiftedPunctuationHotkeyOptions = NonNullable<Parameters<typeof useHotkey>[2]>

/**
 * Register Alt+Shift punctuation bindings for both runtime key shapes:
 * - shifted glyph (`_`, `~`) from `event.key`
 * - base punctuation fallback (`-`, `` ` ``) on some layouts/runtimes
 *
 * Must be called unconditionally (custom hook; invokes hooks internally).
 */
function useShiftedAltPunctuationHotkey(
  baseKey: string,
  shiftedKey: string,
  handler: () => void,
  options: ShiftedPunctuationHotkeyOptions,
): void {
  const handledEventsRef = useRef<WeakSet<KeyboardEvent>>(new WeakSet())

  const dedupedHandler = useCallback((event: KeyboardEvent) => {
    if (handledEventsRef.current.has(event)) return
    handledEventsRef.current.add(event)
    handler()
  }, [handler])

  useHotkey({ key: shiftedKey, alt: true, shift: true }, dedupedHandler, options)
  useHotkey({ key: baseKey, alt: true, shift: true }, dedupedHandler, options)
}

// =============================================================================
// Hook
// =============================================================================

export interface UseKeyboardDispatchOptions {
  getLocalViewport: () => Viewport
}

export function useKeyboardDispatch({ getLocalViewport }: UseKeyboardDispatchOptions): void {
  const modalOpen = useKeyboardModalOpen()

  const activePanelId = useSelector(() => getFloatingStx().data.activePanel.get())
  const activePanelMaximized = useSelector(() => {
    const id = getFloatingStx().data.activePanel.get()
    if (!id) return false
    return !!getFloatingStx().data.panels.get(id)?.isMaximized.get()
  })

  const lastFireRef = useRef<Map<string, number>>(new Map())
  const shouldFire = useCallback((key: string, cooldownMs: number) => {
    const now = performance.now()
    const last = lastFireRef.current.get(key) ?? 0
    if (now - last < cooldownMs) return false
    lastFireRef.current.set(key, now)
    return true
  }, [])

  const hotkeyCommon = {
    conflictBehavior: 'replace' as const,
    enabled: !modalOpen,
    ignoreInputs: true,
  }

  const withActive = !!activePanelId && !modalOpen

  // ── Overlay / Escape ────────────────────────────────────────────
  useHotkey('Alt+P', () => {
    togglePanelOverlay()
  }, {
    ...hotkeyCommon,
    requireReset: true,
  })

  useHotkey('Escape', () => {
    if (!activePanelId) return
    restorePanel(activePanelId)
  }, {
    conflictBehavior: 'replace',
    enabled: activePanelMaximized && !modalOpen,
    ignoreInputs: false,
    requireReset: true,
  })

  // ── Spawn / Toggle / Close ─────────────────────────────────────
  useHotkey('Alt+Enter', () => {
    spawnPanel('morphchat:harness', { mode: 'tiled' })
  }, {
    ...hotkeyCommon,
    requireReset: true,
  })

  useHotkey('Alt+F', () => {
    if (!activePanelId) return
    const panel = getFloatingStx().data.panels.get(activePanelId)?.peek()
    if (panel?.isMaximized) restorePanel(activePanelId)
    else maximizePanel(activePanelId)
  }, {
    ...hotkeyCommon,
    enabled: withActive,
    requireReset: true,
  })

  useHotkey('Alt+Shift+F', () => {
    if (!activePanelId) return
    if (isTiled(activePanelId)) floatPanel(activePanelId)
    else if (isFloating(activePanelId)) tilePanel(activePanelId)
  }, {
    ...hotkeyCommon,
    enabled: withActive,
    requireReset: true,
  })

  useHotkey('Alt+W', () => {
    if (!activePanelId) return
    if (!isTiled(activePanelId)) return

    const stx = getFloatingStx()
    const strip = stx.data.strip.peek()
    const colIdx = strip.columns.findIndex((col) => getColumnPanelIds(col).includes(activePanelId))

    if (colIdx >= 0 && isLeaf(strip.columns[colIdx].tree)) {
      toggleFocusedCollapsed()
    } else {
      togglePanelCollapsed(activePanelId)
    }
  }, {
    ...hotkeyCommon,
    enabled: withActive,
    requireReset: true,
  })

  useHotkey('Alt+Q', () => {
    if (activePanelId) closePanelFull(activePanelId)
  }, {
    ...hotkeyCommon,
    enabled: withActive,
    requireReset: true,
  })

  useHotkey('Alt+Shift+X', () => {
    if (activePanelId) closePanelFull(activePanelId)
  }, {
    ...hotkeyCommon,
    enabled: withActive,
    requireReset: true,
  })

  // ── Alt+D (single owner) ───────────────────────────────────────
  useHotkey('Alt+D', () => {
    if (!activePanelId) return

    if (isFloating(activePanelId)) {
      tilePanel(activePanelId)
    } else if (isTiled(activePanelId)) {
      cycleFocusedWidth()
    }
  }, {
    ...hotkeyCommon,
    enabled: withActive,
    requireReset: true,
  })

  // ── Focus / swap (repeatable with debounce) ────────────────────
  useHotkey('Alt+H', () => {
    if (!activePanelId || !shouldFire('focus-left', 80)) return
    if (isTiled(activePanelId)) moveFocusInDirection('left')
    else focusFloatingInDirection('left')
  }, { ...hotkeyCommon, enabled: withActive })

  useHotkey('Alt+L', () => {
    if (!activePanelId || !shouldFire('focus-right', 80)) return
    if (isTiled(activePanelId)) moveFocusInDirection('right')
    else focusFloatingInDirection('right')
  }, { ...hotkeyCommon, enabled: withActive })

  useHotkey('Alt+J', () => {
    if (!activePanelId || !shouldFire('focus-down', 80)) return
    if (isTiled(activePanelId)) moveFocusInDirection('down')
    else focusFloatingInDirection('down')
  }, { ...hotkeyCommon, enabled: withActive })

  useHotkey('Alt+K', () => {
    if (!activePanelId || !shouldFire('focus-up', 80)) return
    if (isTiled(activePanelId)) moveFocusInDirection('up')
    else focusFloatingInDirection('up')
  }, { ...hotkeyCommon, enabled: withActive })

  useHotkey('Alt+ArrowLeft', () => {
    if (!activePanelId || !shouldFire('focus-left-arrow', 80)) return
    if (isTiled(activePanelId)) moveFocusInDirection('left')
    else focusFloatingInDirection('left')
  }, { ...hotkeyCommon, enabled: withActive })

  useHotkey('Alt+ArrowRight', () => {
    if (!activePanelId || !shouldFire('focus-right-arrow', 80)) return
    if (isTiled(activePanelId)) moveFocusInDirection('right')
    else focusFloatingInDirection('right')
  }, { ...hotkeyCommon, enabled: withActive })

  useHotkey('Alt+ArrowDown', () => {
    if (!activePanelId || !shouldFire('focus-down-arrow', 80)) return
    if (isTiled(activePanelId)) moveFocusInDirection('down')
    else focusFloatingInDirection('down')
  }, { ...hotkeyCommon, enabled: withActive })

  useHotkey('Alt+ArrowUp', () => {
    if (!activePanelId || !shouldFire('focus-up-arrow', 80)) return
    if (isTiled(activePanelId)) moveFocusInDirection('up')
    else focusFloatingInDirection('up')
  }, { ...hotkeyCommon, enabled: withActive })

  useHotkey('Alt+Shift+H', () => {
    if (!activePanelId || !isTiled(activePanelId) || !shouldFire('swap-left', 80)) return
    swapInDirection('left')
  }, { ...hotkeyCommon, enabled: withActive })

  useHotkey('Alt+Shift+L', () => {
    if (!activePanelId || !isTiled(activePanelId) || !shouldFire('swap-right', 80)) return
    swapInDirection('right')
  }, { ...hotkeyCommon, enabled: withActive })

  useHotkey('Alt+Shift+J', () => {
    if (!activePanelId || !isTiled(activePanelId) || !shouldFire('swap-down', 80)) return
    swapInDirection('down')
  }, { ...hotkeyCommon, enabled: withActive })

  useHotkey('Alt+Shift+K', () => {
    if (!activePanelId || !isTiled(activePanelId) || !shouldFire('swap-up', 80)) return
    swapInDirection('up')
  }, { ...hotkeyCommon, enabled: withActive })

  useHotkey('Alt+Shift+ArrowLeft', () => {
    if (!activePanelId || !isTiled(activePanelId) || !shouldFire('swap-left-arrow', 80)) return
    swapInDirection('left')
  }, { ...hotkeyCommon, enabled: withActive })

  useHotkey('Alt+Shift+ArrowRight', () => {
    if (!activePanelId || !isTiled(activePanelId) || !shouldFire('swap-right-arrow', 80)) return
    swapInDirection('right')
  }, { ...hotkeyCommon, enabled: withActive })

  useHotkey('Alt+Shift+ArrowDown', () => {
    if (!activePanelId || !isTiled(activePanelId) || !shouldFire('swap-down-arrow', 80)) return
    swapInDirection('down')
  }, { ...hotkeyCommon, enabled: withActive })

  useHotkey('Alt+Shift+ArrowUp', () => {
    if (!activePanelId || !isTiled(activePanelId) || !shouldFire('swap-up-arrow', 80)) return
    swapInDirection('up')
  }, { ...hotkeyCommon, enabled: withActive })

  // ── Splits ─────────────────────────────────────────────────────
  useHotkey({ key: '-', alt: true }, () => {
    if (!activePanelId || !isTiled(activePanelId) || !shouldFire('hsplit', 80)) return
    splitPanelInDirection(activePanelId, 'horizontal')
  }, { ...hotkeyCommon, enabled: withActive })

  useShiftedAltPunctuationHotkey(
    '-',
    '_',
    () => {
      if (!activePanelId || !isTiled(activePanelId) || !shouldFire('vsplit', 80)) return
      splitPanelInDirection(activePanelId, 'vertical')
    },
    { ...hotkeyCommon, enabled: withActive },
  )

  // ── Tabs ───────────────────────────────────────────────────────
  useHotkey({ key: '`', alt: true }, () => {
    if (!activePanelId || !shouldFire('tab-next', 120)) return
    cycleTab(activePanelId, 1)
  }, { ...hotkeyCommon, enabled: withActive })

  useShiftedAltPunctuationHotkey(
    '`',
    '~',
    () => {
      if (!activePanelId || !shouldFire('tab-prev', 120)) return
      cycleTab(activePanelId, -1)
    },
    { ...hotkeyCommon, enabled: withActive },
  )

  useHotkey({ key: '1', alt: true }, () => activePanelId && jumpToTab(activePanelId, 1), {
    ...hotkeyCommon,
    enabled: withActive,
    requireReset: true,
  })
  useHotkey({ key: '2', alt: true }, () => activePanelId && jumpToTab(activePanelId, 2), {
    ...hotkeyCommon,
    enabled: withActive,
    requireReset: true,
  })
  useHotkey({ key: '3', alt: true }, () => activePanelId && jumpToTab(activePanelId, 3), {
    ...hotkeyCommon,
    enabled: withActive,
    requireReset: true,
  })
  useHotkey({ key: '4', alt: true }, () => activePanelId && jumpToTab(activePanelId, 4), {
    ...hotkeyCommon,
    enabled: withActive,
    requireReset: true,
  })
  useHotkey({ key: '5', alt: true }, () => activePanelId && jumpToTab(activePanelId, 5), {
    ...hotkeyCommon,
    enabled: withActive,
    requireReset: true,
  })
  useHotkey({ key: '6', alt: true }, () => activePanelId && jumpToTab(activePanelId, 6), {
    ...hotkeyCommon,
    enabled: withActive,
    requireReset: true,
  })
  useHotkey({ key: '7', alt: true }, () => activePanelId && jumpToTab(activePanelId, 7), {
    ...hotkeyCommon,
    enabled: withActive,
    requireReset: true,
  })
  useHotkey({ key: '8', alt: true }, () => activePanelId && jumpToTab(activePanelId, 8), {
    ...hotkeyCommon,
    enabled: withActive,
    requireReset: true,
  })
  useHotkey({ key: '9', alt: true }, () => activePanelId && jumpToTab(activePanelId, 9), {
    ...hotkeyCommon,
    enabled: withActive,
    requireReset: true,
  })

  // ── Floating panel nudging (plain arrows) ─────────────────────
  const nudge = useCallback((dx: number, dy: number, event: KeyboardEvent) => {
    if (!activePanelId) return

    const panel = stxGetPanel(activePanelId)
    if (!panel) return
    if (panel.visibility !== 'visible') return
    if (panel.mode !== 'floating') return
    if (panel.isDragging || panel.isResizing || panel.isMaximized) return

    // Precision: Shift=1px fine, default=8px
    const step = event.shiftKey ? 1 : 8

    const viewport = getLocalViewport()
    const unclamped = {
      x: panel.position.x + dx * step,
      y: panel.position.y + dy * step,
    }
    const next = clampToViewport(unclamped, panel.dimensions, viewport)

    const stx = getFloatingStx()
    const siblings: PanelRect[] = []

    if (stx.data.snapEnabled.peek()) {
      stx.data.panels.peek().forEach((p, id) => {
        if (id === activePanelId) return
        if (p.visibility !== 'visible' || p.mode !== 'floating') return
        siblings.push({
          x: p.position.x,
          y: p.position.y,
          width: p.dimensions.width,
          height: p.dimensions.height,
        })
      })
    }

    const finalPos = stx.data.snapEnabled.peek()
      ? applyMagneticSnap(next, panel.dimensions, viewport, siblings, {
          threshold: 8,
          includeViewportCenter: true,
          includePanelAlign: true,
        })
      : next

    updatePanelPosition(activePanelId, finalPos)
    bringPanelToFront(activePanelId)
  }, [activePanelId, getLocalViewport])

  useHotkey('ArrowLeft', (e) => {
    if (!shouldFire('nudge-left', 16)) return
    nudge(-1, 0, e)
  }, {
    ...hotkeyCommon,
    enabled: withActive,
  })

  useHotkey('ArrowRight', (e) => {
    if (!shouldFire('nudge-right', 16)) return
    nudge(1, 0, e)
  }, {
    ...hotkeyCommon,
    enabled: withActive,
  })

  useHotkey('ArrowUp', (e) => {
    if (!shouldFire('nudge-up', 16)) return
    nudge(0, -1, e)
  }, {
    ...hotkeyCommon,
    enabled: withActive,
  })

  useHotkey('ArrowDown', (e) => {
    if (!shouldFire('nudge-down', 16)) return
    nudge(0, 1, e)
  }, {
    ...hotkeyCommon,
    enabled: withActive,
  })
}
