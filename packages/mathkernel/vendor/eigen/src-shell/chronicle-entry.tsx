/**
 * Chronicle entry point — layer-shell overlay surface.
 *
 * The surface is fullscreen transparent (Overlay layer, keyboard exclusive).
 * CSS centers the chronicle content. Click on backdrop dismisses.
 * ESC dismisses via Tauri invoke → Rust hides the GTK surface.
 *
 * Uses similar pattern to command palette but for Chronicle calendar.
 */

import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { motion, AnimatePresence } from 'motion/react'
import { listen } from '@tauri-apps/api/event'
import { RegistryProvider } from '@effect-atom/atom-react/RegistryContext'
import { ChronicleEntrance } from '@/lib/getbyshell/calendar/chronicle'

// ─── Window Control ─────────────────────────────────────────────────────────

async function dismissChronicle() {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('close_chronicle')
  } catch {}
}

// ─── Chronicle App ──────────────────────────────────────────────────────────

function ChronicleApp() {
  const [open, setOpen] = useState(false)
  const [gen, setGen] = useState(0)

  // Listen to chronicle-state from Rust GTK idle handler
  useEffect(() => {
    let unlisten: (() => void) | null = null
    listen<boolean>('tmnl:chronicle-state', (ev) => {
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
        dismissChronicle()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  return (
    <div
      onClick={(e) => {
        // Click on backdrop (outside chronicle) → dismiss
        if ((e.target as HTMLElement).dataset.backdrop) dismissChronicle()
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
        {open && <ChronicleContent key={gen} />}
      </AnimatePresence>
    </div>
  )
}

// ─── Chronicle Content (re-mounts each open → replays choreography) ─────────

function ChronicleContent() {
  return (
    <RegistryProvider>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.2, 0.6, 0.3, 1] }}
        style={{
          width: '90vw',
          height: '90vh',
          maxWidth: 1200,
          maxHeight: 800,
          display: 'flex',
        }}
      >
        <ChronicleEntrance
          open={true}
          onClose={dismissChronicle}
          originX={0}
          originY={0}
        />
      </motion.div>
    </RegistryProvider>
  )
}

// ─── Mount ──────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ChronicleApp />,
)