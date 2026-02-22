/**
 * WorkspaceIndicators — Targeting reticle workspace dots.
 *
 * Focused = rotated diamond with phosphor glow.
 * Active = solid dot. Empty = ghost.
 * Motion.dev layout + AnimatePresence for shape morphing.
 */

import React, { useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useWorkspaces, useFocusWorkspace } from '@/lib/getbyshell'
import { V } from './BarLayout'

// ─── Indicator Shapes ───────────────────────────────────────────────────────

function FocusedDiamond() {
  return (
    <motion.div
      initial={{ rotate: 0, scale: 0 }}
      animate={{ rotate: 45, scale: 1 }}
      exit={{ scale: 0, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      style={{
        width: 9,
        height: 9,
        borderRadius: 2,
        background: V.phosphor,
        boxShadow: `0 0 8px ${V.phosphor}50, 0 0 3px ${V.phosphor}30`,
        zIndex: 2,
      }}
    />
  )
}

function ActiveDot() {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      transition={{ type: 'spring', stiffness: 450, damping: 22 }}
      style={{
        width: 5,
        height: 5,
        borderRadius: '50%',
        background: V.inkMid,
        zIndex: 2,
      }}
    />
  )
}

function GhostDot() {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      style={{
        width: 3,
        height: 3,
        borderRadius: '50%',
        background: V.inkFaint,
        zIndex: 2,
      }}
    />
  )
}

// ─── Single Indicator ───────────────────────────────────────────────────────

function Indicator({
  idx,
  isFocused,
  hasWindows,
  label,
  onFocus,
  index,
}: {
  idx: number
  isFocused: boolean
  hasWindows: boolean
  label: string
  onFocus: (idx: number) => void
  index: number
}) {
  return (
    <motion.button
      layout
      onClick={() => onFocus(idx)}
      title={label}
      initial={{ opacity: 0, scale: 0.3 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        layout: { type: 'spring', stiffness: 500, damping: 35 },
        opacity: { duration: 0.25, delay: index * 0.05 },
        scale: { type: 'spring', stiffness: 400, damping: 25, delay: index * 0.05 },
      }}
      whileHover={{ scale: 1.12 }}
      whileTap={{ scale: 0.85 }}
      style={{
        width: 30,
        height: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        background: 'transparent',
        borderRadius: 5,
        cursor: 'pointer',
        padding: 0,
        outline: 'none',
        position: 'relative',
      }}
    >
      <AnimatePresence mode="wait">
        {isFocused ? (
          <FocusedDiamond key="f" />
        ) : hasWindows ? (
          <ActiveDot key="a" />
        ) : (
          <GhostDot key="g" />
        )}
      </AnimatePresence>

      {/* Focus pulse ring */}
      {isFocused && (
        <motion.div
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 0.35, 0], scale: [0.4, 1.6, 2] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            width: 12,
            height: 12,
            borderRadius: 3,
            border: `1px solid ${V.phosphor}`,
          }}
        />
      )}
    </motion.button>
  )
}

// ─── Container ──────────────────────────────────────────────────────────────

export function WorkspaceIndicators() {
  const workspaces = useWorkspaces()
  const focusWorkspace = useFocusWorkspace()

  const handleFocus = useCallback(
    (idx: number) => focusWorkspace(idx),
    [focusWorkspace],
  )

  return (
    <motion.div
      layout
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
        paddingBottom: 4,
      }}
    >
      {workspaces.map((ws, i) => (
        <Indicator
          key={ws.idx}
          idx={ws.idx}
          isFocused={ws.is_focused}
          hasWindows={ws.active_window_id !== null}
          label={ws.name ?? `WS ${ws.idx}`}
          onFocus={handleFocus}
          index={i}
        />
      ))}
    </motion.div>
  )
}
