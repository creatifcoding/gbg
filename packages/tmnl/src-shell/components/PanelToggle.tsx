/**
 * PanelToggle — Button to toggle the floating panel workspace.
 *
 * Sends SIGUSR1 to the tmnl-panel process via `pkill`.
 * Shows active state when panel is open (amber glow).
 * Compact: fits within the 48px bar strip.
 */

import React from 'react'
import { motion } from 'motion/react'
import { V } from './BarLayout'

// ─── SVG Icon: Panel grid (3-pane layout) ───────────────────────────────────

function PanelIcon({ color }: { color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      {/* Outer frame */}
      <rect x={1} y={1} width={14} height={14} rx={1.5}
        stroke={color} strokeWidth={0.8} opacity={0.6} />
      {/* Left pane */}
      <rect x={2.5} y={2.5} width={4} height={11} rx={0.5}
        stroke={color} strokeWidth={0.5} opacity={0.4} />
      {/* Top-right pane */}
      <rect x={8} y={2.5} width={5.5} height={5} rx={0.5}
        stroke={color} strokeWidth={0.5} opacity={0.4} />
      {/* Bottom-right pane */}
      <rect x={8} y={9} width={5.5} height={4.5} rx={0.5}
        stroke={color} strokeWidth={0.5} opacity={0.4} />
    </svg>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PanelToggle({ active }: { active: boolean }) {
  const color = active ? V.amber : V.phosphor

  const handleClick = async () => {
    try {
      // Shell execute: send SIGUSR1 to tmnl-panel process
      const { Command } = await import('@tauri-apps/plugin-shell')
      await Command.create('pkill', ['-USR1', '-f', 'tmnl-panel$']).execute()
    } catch {
      // Fallback: if shell plugin not available, just log
      console.warn('[PanelToggle] pkill failed — is tmnl-panel running?')
    }
  }

  return (
    <motion.button
      onClick={handleClick}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
      title={active ? 'Hide panel workspace (Super+P)' : 'Show panel workspace (Super+P)'}
    >
      {/* Glow ring when active */}
      {active && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            position: 'absolute',
            inset: -2,
            borderRadius: 6,
            border: `1px solid ${V.amber}30`,
            boxShadow: `0 0 8px ${V.amberGlow}`,
            pointerEvents: 'none',
          }}
        />
      )}
      <PanelIcon color={color} />
    </motion.button>
  )
}
