/**
 * Command Palette entry point — layer-shell overlay surface.
 *
 * The surface is fullscreen transparent (Overlay layer, keyboard exclusive).
 * CSS centers the palette content. Click on backdrop dismisses.
 * ESC dismisses via Tauri invoke → Rust hides the GTK surface.
 *
 * Entrance choreography (staggered, tight):
 *   0ms  — container: scale 0.97→1, opacity 0→1
 *  30ms  — search bar border glow sweeps in
 *  50ms  — prompt chevron + input field
 *  80ms  — ESC badge
 * 100ms  — results area
 * 130ms  — footer
 */

import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { motion, AnimatePresence } from 'motion/react'
import { listen } from '@tauri-apps/api/event'

// ─── Tokens (bar's vantablack palette) ──────────────────────────────────────

const V = {
  void: '#000000',
  surface: '#060608',
  raised: '#0c0c10',
  phosphor: '#7ec8b0',
  phosphorMid: '#4a7a68',
  phosphorDim: '#2a4a3c',
  ink: '#b8bcc6',
  inkMid: '#5a6070',
  inkFaint: '#2a2e38',
  radius: 8,
} as const

// ─── Choreography ───────────────────────────────────────────────────────────

const ease = [0.2, 0.6, 0.3, 1] as const
const dur = 0.22

/** Stagger factory — returns motion props for a given step index */
const stagger = (step: number) => ({
  initial: { opacity: 0, y: 6 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { duration: dur, ease, delay: step * 0.06 },
})

// ─── Window Control ─────────────────────────────────────────────────────────

async function dismissPalette() {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('close_command_palette')
  } catch {}
}

// ─── Palette App ────────────────────────────────────────────────────────────

function CommandPaletteApp() {
  const [open, setOpen] = useState(false)      // waits for Rust tmnl:palette-state event
  const [gen, setGen] = useState(0)             // generation key — bumps on each open

  // Listen to palette-state from Rust GTK idle handler
  useEffect(() => {
    let unlisten: (() => void) | null = null
    listen<boolean>('tmnl:palette-state', (ev) => {
      const newOpen = ev.payload
      setOpen((prevOpen) => {
        // Only bump generation on false → true transition (opening)
        if (!prevOpen && newOpen) {
          setGen((g) => g + 1)
        }
        return newOpen
      })
    }).then((fn) => { unlisten = fn })
    return () => { unlisten?.() }
  }, [])

  // ESC → dismiss
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        dismissPalette()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  return (
    <div
      onClick={(e) => {
        if ((e.target as HTMLElement).dataset.backdrop) dismissPalette()
      }}
      data-backdrop
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      }}
    >
      <AnimatePresence>
        {open && <PaletteContent key={gen} />}
      </AnimatePresence>
    </div>
  )
}

// ─── Palette Content (re-mounts each open → replays choreography) ───────────

function PaletteContent() {
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input on mount + re-focus on window regain
  useEffect(() => {
    inputRef.current?.focus()
    const onFocus = () => setTimeout(() => inputRef.current?.focus(), 16)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18, ease }}
      style={{
        width: 640,
        maxWidth: '90vw',
        background: V.surface,
        borderRadius: V.radius,
        overflow: 'hidden',
        border: `1px solid ${V.inkFaint}`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Search bar — step 1 ── */}
      <motion.div
        {...stagger(1)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          borderBottom: `0.5px solid ${V.inkFaint}`,
          background: V.void,
        }}
      >
        {/* Chevron — step 1.5 */}
        <motion.span
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 0.5, x: 0 }}
          transition={{ duration: dur, ease, delay: 0.09 }}
          style={{
            color: V.phosphor,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          ›
        </motion.span>

        {/* Input — step 2 */}
        <motion.input
          ref={inputRef}
          autoFocus
          placeholder="Type a command..."
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: dur, ease, delay: 0.1 }}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: V.ink,
            caretColor: V.phosphor,
            fontSize: 14,
            fontFamily: 'inherit',
            letterSpacing: '0.01em',
          }}
        />

        {/* ESC badge — step 2.5 */}
        <motion.kbd
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: dur, ease, delay: 0.15 }}
          style={{
            fontSize: 12,
            color: V.inkFaint,
            border: `0.5px solid ${V.inkFaint}`,
            borderRadius: 2,
            padding: '1px 6px',
            fontFamily: 'inherit',
            letterSpacing: '0.04em',
          }}
        >
          ESC
        </motion.kbd>
      </motion.div>

      {/* ── Results area — step 3 ── */}
      <motion.div
        {...stagger(3)}
        style={{
          minHeight: 200,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '24px 16px',
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.25em',
            color: V.phosphorMid,
            opacity: 0.5,
          }}
        >
          COMMAND PALETTE
        </span>
        <span
          style={{
            fontSize: 12,
            letterSpacing: '0.12em',
            color: V.inkFaint,
            opacity: 0.6,
          }}
        >
          NuCmdk integration pending
        </span>
      </motion.div>

      {/* ── Footer — step 4 ── */}
      <motion.div
        {...stagger(4)}
        style={{
          borderTop: `0.5px solid ${V.inkFaint}`,
          padding: '8px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: V.void,
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: V.inkFaint,
            letterSpacing: '0.06em',
            opacity: 0.7,
          }}
        >
          ↑↓ navigate · ↵ execute · esc dismiss
        </span>
        <span
          style={{
            fontSize: 12,
            color: V.phosphorDim,
            letterSpacing: '0.1em',
            opacity: 0.5,
          }}
        >
          TMNL
        </span>
      </motion.div>
    </motion.div>
  )
}

// ─── Mount ──────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root')!).render(
  <CommandPaletteApp />,
)
