/**
 * CommandPalette — Renders inside the bar's layer shell surface.
 *
 * Same layer treatment as the calendar popover:
 * 1. Expand surface to full monitor width
 * 2. Render palette centered
 * 3. ESC collapses surface + hides
 *
 * No backdrop overlay. Just the palette floating on the expanded surface.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { SURFACE_WIDTH } from '@/lib/getbyshell/popover/atoms'

// ─── Tokens ─────────────────────────────────────────────────────────────────

const V = {
  void: '#000000',
  surface: '#060608',
  phosphor: '#7ec8b0',
  phosphorMid: '#4a7a68',
  phosphorDim: '#2a4a3c',
  ink: '#b8bcc6',
  inkMid: '#5a6070',
  inkFaint: '#2a2e38',
  // Niri tokens
  niriActive: '#7aa2f7',     // focus-ring active-color
  niriInactive: '#565f89',   // focus-ring inactive-color
  niriRadius: 8,             // niri default corner radius
  niriGap: 8,                // layout.gaps
  niriFocusWidth: 2,         // focus-ring width
} as const

// ─── Surface Management ─────────────────────────────────────────────────────

let cachedMonitorWidth: number | null = null

async function getMonitorWidth(): Promise<number> {
  if (cachedMonitorWidth) return cachedMonitorWidth
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const geom = await invoke<{ monitor_width: number }>('get_bar_geometry')
    cachedMonitorWidth = geom.monitor_width
    return cachedMonitorWidth
  } catch {
    return 1645
  }
}

async function expandSurface(): Promise<number> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const monitorWidth = await getMonitorWidth()
    await invoke('set_surface_width', { width: monitorWidth })
    await invoke('update_input_region', {
      regions: [{ x: 0, y: 0, w: monitorWidth, h: 8000 }],
    })
    return monitorWidth
  } catch (e) {
    console.debug('[CommandPalette] surface expand failed:', e)
    return 1645
  }
}

async function collapseSurface() {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('set_surface_width', { width: SURFACE_WIDTH })
    await invoke('update_input_region', { regions: [] as any[] })
  } catch (e) {
    console.debug('[CommandPalette] surface collapse failed:', e)
  }
}

// ─── CommandPalette ─────────────────────────────────────────────────────────

const PALETTE_WIDTH = 480

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [leftOffset, setLeftOffset] = useState(0)

  // Listen for Tauri events
  useEffect(() => {
    const unsubs: Array<() => void> = []
    let mounted = true

    import('@tauri-apps/api/event').then(({ listen }) => {
      if (!mounted) return

      listen('tmnl:toggle-command-palette', async () => {
        setIsOpen(prev => {
          if (prev) {
            // Closing
            collapseSurface()
            return false
          }
          return prev // don't open yet — we do it after expand
        })

        // If opening, expand surface FIRST, then show
        // Check current state via a ref-safe read
        setIsOpen(prev => {
          if (!prev) {
            // Trigger async open
            window.dispatchEvent(new CustomEvent('tmnl:close-all-popovers'))
            expandSurface().then(monitorWidth => {
              if (!mounted) return
              // Center: palette middle = bar_width + (usable_width / 2)
              const barWidth = 48
              const usableWidth = monitorWidth - barWidth
              const center = barWidth + (usableWidth - PALETTE_WIDTH) / 2
              setLeftOffset(center)
              setIsOpen(true)
            })
          }
          return prev // keep current state until expand resolves
        })

        return undefined
      }).then(u => unsubs.push(u))

      listen('tmnl:close-command-palette', () => {
        setIsOpen(false)
        collapseSurface()
      }).then(u => unsubs.push(u))
    }).catch(e => console.debug('[CommandPalette] Tauri events unavailable:', e))

    return () => { mounted = false; unsubs.forEach(u => u()) }
  }, [])

  // ESC always closes + collapses
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setIsOpen(false)
        collapseSurface()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [isOpen])

  // Click outside closes (anywhere on expanded surface that isn't the palette)
  const paletteRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: PointerEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        collapseSurface()
      }
    }
    // Delay to avoid catching the triggering click
    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handler)
    }, 50)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pointerdown', handler)
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={paletteRef}
          initial={{ opacity: 0, scale: 0.95, y: -6 }}
          animate={{
            opacity: 1, scale: 1, y: 0,
            transition: { type: 'spring', stiffness: 500, damping: 32 },
          }}
          exit={{
            opacity: 0, scale: 0.97, y: -4,
            transition: { duration: 0.1 },
          }}
          style={{
            position: 'fixed',
            top: '20vh',
            left: leftOffset,
            width: PALETTE_WIDTH,
            zIndex: 3000,
            background: V.surface,
            borderRadius: V.niriRadius,
            overflow: 'hidden',
            border: `${V.niriFocusWidth}px solid ${V.niriActive}`,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            boxShadow: `0 12px 40px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3)`,
            padding: V.niriGap,
          }}
        >
          {/* Search input */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            borderBottom: `0.5px solid ${V.border}`,
            background: V.void,
          }}>
            <span style={{
              color: V.phosphor, fontSize: 13, opacity: 0.5, fontWeight: 500,
            }}>›</span>
            <input
              autoFocus
              placeholder="Type a command..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: V.ink,
                caretColor: V.phosphor,
                fontSize: 13,
                fontFamily: 'inherit',
                letterSpacing: '0.01em',
              }}
            />
            <kbd style={{
              fontSize: 9,
              color: V.inkFaint,
              border: `0.5px solid ${V.border}`,
              borderRadius: 2,
              padding: '1px 4px',
              fontFamily: 'inherit',
              letterSpacing: '0.04em',
            }}>ESC</kbd>
          </div>

          {/* Results area */}
          <div style={{
            minHeight: 160,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '20px 16px',
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.25em',
              color: V.phosphorMid, opacity: 0.5,
            }}>
              COMMAND PALETTE
            </span>
            <span style={{
              fontSize: 9, letterSpacing: '0.12em',
              color: V.inkFaint, opacity: 0.6,
            }}>
              NuCmdk integration pending
            </span>
          </div>

          {/* Footer */}
          <div style={{
            borderTop: `0.5px solid ${V.border}`,
            padding: '6px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: V.void,
          }}>
            <span style={{
              fontSize: 9, color: V.inkFaint,
              letterSpacing: '0.06em', opacity: 0.7,
            }}>
              ↑↓ navigate · ↵ execute · esc dismiss
            </span>
            <span style={{
              fontSize: 8, color: V.phosphorDim,
              letterSpacing: '0.1em', opacity: 0.5,
            }}>
              TMNL
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
