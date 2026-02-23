/**
 * Panel entry point — layer-shell overlay surface.
 *
 * Thin shell that mounts the existing PanelWorkspace from @/lib/floating/.
 * The surface is fullscreen transparent (Overlay layer, keyboard on-demand).
 * ESC dismisses via Tauri invoke → Rust hides the GTK surface.
 *
 * STX stays internal to floating/ — this entry just mounts and bridges.
 */

import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { RegistryContext } from '@effect-atom/atom-react'
import { listen } from '@tauri-apps/api/event'

import { PanelWorkspaceOverlay, panelOverlayRegistry, openPanelOverlay } from '@/lib/floating/overlay'
import { PanelWorkspace } from '@/lib/floating/overlay/PanelWorkspace'

// ─── Window Control ─────────────────────────────────────────────────────────

async function dismissPanel() {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('close_panel')
  } catch {}
}

// ─── Panel App ──────────────────────────────────────────────────────────────

function PanelApp() {
  const [visible, setVisible] = useState(false)

  // Listen to panel-state from Rust GTK idle handler
  useEffect(() => {
    let unlisten: (() => void) | null = null
    listen<boolean>('tmnl:panel-state', (ev) => {
      setVisible(ev.payload)
      // Sync the overlay atom so PanelWorkspaceOverlay renders
      if (ev.payload) {
        openPanelOverlay()
      }
    }).then((fn) => { unlisten = fn })
    return () => { unlisten?.() }
  }, [])

  // ESC → dismiss (only when panel is visible)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) {
        e.preventDefault()
        dismissPanel()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [visible])

  return (
    <RegistryContext.Provider value={panelOverlayRegistry}>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'transparent',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}
      >
        <PanelWorkspaceOverlay>
          <PanelWorkspace />
        </PanelWorkspaceOverlay>
      </div>
    </RegistryContext.Provider>
  )
}

// ─── Mount ──────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root')!).render(
  <PanelApp />,
)
