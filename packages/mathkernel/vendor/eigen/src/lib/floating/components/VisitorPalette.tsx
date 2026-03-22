/**
 * VisitorPalette — cmdk-powered palette for spawning panel content as tabs.
 *
 * Rendered inside the host panel's DOM via portal. Positioned absolutely
 * relative to the panel container (which has `overflow: visible` on the
 * portal root so the palette can escape panel bounds).
 *
 * Uses Framer Motion AnimatePresence for enter/exit transitions.
 * Click-outside: stable pointerdown listener via handler ref pattern.
 *
 * @module floating/components/VisitorPalette
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Command as Cmdk } from 'cmdk'
import { PANEL } from '../tokens'
import { panelRegistry, type PanelContentEntry } from '../panel-registry'
import { spawnPanel } from '../stx/actions'
import { nestPanelAsTab } from '../stx/actions'

// =============================================================================
// Types
// =============================================================================

export interface VisitorPaletteProps {
  /** Host panel ID — new panel will be tabbed inside this panel */
  hostPanelId: string
  /** Anchor rect (relative to panel container) for positioning */
  anchorRect: { left: number; bottom: number }
  /** Close callback — stable ref expected */
  onClose: () => void
}

// =============================================================================
// Cached registry snapshot — avoids new array ref per render
// =============================================================================

let cachedEntries: Array<{ id: string } & PanelContentEntry> = []

function getEntries() {
  const list = panelRegistry.list()
  if (list.length !== cachedEntries.length) {
    cachedEntries = list
  }
  return cachedEntries
}

// =============================================================================
// Motion variants
// =============================================================================

const paletteVariants = {
  hidden: { opacity: 0, y: -4, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.97 },
}

const paletteTransition = {
  duration: 0.15,
  ease: [0.25, 0.46, 0.45, 0.94], // ease-out
}

// =============================================================================
// Component
// =============================================================================

export const VisitorPalette = memo(function VisitorPalette({
  hostPanelId,
  anchorRect,
  onClose,
}: VisitorPaletteProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const [entries] = useState(getEntries)

  // ── Click-outside: stable listener via handler ref ──
  useEffect(() => {
    let mounted = true
    let cleanup: (() => void) | undefined

    const frameId = requestAnimationFrame(() => {
      if (!mounted) return
      function handlePointerDown(e: PointerEvent) {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          onCloseRef.current()
        }
      }
      document.addEventListener('pointerdown', handlePointerDown, { capture: true })
      cleanup = () => document.removeEventListener('pointerdown', handlePointerDown, { capture: true })
    })

    return () => {
      mounted = false
      cancelAnimationFrame(frameId)
      cleanup?.()
    }
  }, [])

  // ── Escape key ──
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', handleKey, { capture: true })
    return () => document.removeEventListener('keydown', handleKey, { capture: true })
  }, [])

  // ── Select ──
  const handleSelect = useCallback((visitorId: string) => {
    const entry = panelRegistry.get(visitorId)
    const realId = spawnPanel(visitorId, {
      mode: 'floating',
      title: entry?.label ?? visitorId,
    })
    if (realId) {
      nestPanelAsTab(hostPanelId, realId)
    }
    onCloseRef.current()
  }, [hostPanelId])

  // ── Group entries by category ──
  const grouped = new Map<string, Array<{ id: string } & PanelContentEntry>>()
  for (const entry of entries) {
    const cat = entry.category ?? 'General'
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(entry)
  }

  return (
    <motion.div
      ref={containerRef}
      data-slot="visitor-palette"
      data-kb-modal
      variants={paletteVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={paletteTransition}
      className="absolute z-[100] w-[260px] overflow-hidden rounded-lg backdrop-blur-xl"
      style={{
        left: anchorRect.left,
        top: anchorRect.bottom + 4,
        background: PANEL.bg,
        border: `1px solid ${PANEL.border}`,
        boxShadow: PANEL.floatGlow,
      }}
    >
      <Cmdk label="Add tab" className="bg-transparent">
        {/* Search input */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-2"
          style={{ borderBottom: `1px solid ${PANEL.border}` }}
        >
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke={PANEL.btnIdle} strokeWidth="2" strokeLinecap="round"
            className="shrink-0 opacity-60"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <Cmdk.Input
            autoFocus
            placeholder="Search visitors…"
            className="flex-1 bg-transparent border-none outline-none font-mono tracking-wide"
            style={{
              color: PANEL.text,
              fontSize: 'var(--tmnl-text-xs, 12px)',
            }}
          />
        </div>

        {/* Results */}
        <Cmdk.List className="max-h-60 overflow-y-auto py-1">
          <Cmdk.Empty
            className="py-4 px-3 text-center font-mono"
            style={{ color: PANEL.btnIdle, fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            No visitors registered
          </Cmdk.Empty>

          {[...grouped.entries()].map(([category, items]) => (
            <Cmdk.Group
              key={category}
              heading={category}
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[length:var(--tmnl-text-xs,12px)] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:font-medium"
              style={{ '--heading-color': PANEL.btnIdle } as React.CSSProperties}
            >
              {items.map((entry) => (
                <Cmdk.Item
                  key={entry.id}
                  value={`${entry.id} ${entry.label} ${entry.description ?? ''}`}
                  onSelect={() => handleSelect(entry.id)}
                  data-slot="vp-item"
                  className="flex items-center gap-2 py-1.5 px-3 mx-1 cursor-pointer rounded font-mono tracking-wide transition-colors duration-150 ease-out aria-selected:bg-white/[0.06]"
                  style={{
                    color: PANEL.text,
                    fontSize: 'var(--tmnl-text-xs, 12px)',
                  }}
                >
                  {entry.icon && (
                    <span className="text-sm shrink-0">{entry.icon}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div
                      className="truncate"
                      style={{ color: PANEL.textStrong }}
                    >
                      {entry.label}
                    </div>
                    {entry.description && (
                      <div
                        className="truncate"
                        style={{
                          color: PANEL.btnIdle,
                          fontSize: 'var(--tmnl-text-xs, 12px)',
                        }}
                      >
                        {entry.description}
                      </div>
                    )}
                  </div>
                </Cmdk.Item>
              ))}
            </Cmdk.Group>
          ))}
        </Cmdk.List>
      </Cmdk>
    </motion.div>
  )
})
