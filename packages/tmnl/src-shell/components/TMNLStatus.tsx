/**
 * TMNLStatus — Tactical reticle health indicator.
 *
 * Concentric rotating rings with cardinal tick marks.
 * Center pip pulses with connection health.
 * Pure phosphor on vantablack.
 *
 * When command palette is open: morphs into target reticle,
 * color eases from phosphor → amber, label scrambles to "CMD".
 */

import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useSystemHealth, usePaletteOpen } from '@/lib/getbyshell'
import { V } from './BarLayout'

// ─── Status Configuration ───────────────────────────────────────────────────

const STATUS_MAP = {
  connected:    { color: V.phosphor, glow: V.phosphorGlow, label: 'LINK' },
  connecting:   { color: V.amber,    glow: V.amberGlow,    label: 'SYNC' },
  disconnected: { color: V.inkFaint, glow: 'transparent',  label: 'IDLE' },
  error:        { color: V.alert,    glow: V.alertGlow,    label: 'FAULT' },
} as const

const CMD_CONFIG = { color: V.amber, glow: V.amberGlow, label: 'CMD' } as const

// ─── Text Scramble Hook ─────────────────────────────────────────────────────

const GLYPHS = '▓▒░█▌▐─┼╳◆◇●○■□'

function useTextScramble(target: string, duration = 280): string {
  const [display, setDisplay] = useState(target)
  const frameRef = useRef<number | null>(null)
  const prevTarget = useRef(target)

  useEffect(() => {
    if (target === prevTarget.current) {
      setDisplay(target)
      return
    }
    prevTarget.current = target

    const maxLen = Math.max(display.length, target.length)
    const startTime = performance.now()

    function tick() {
      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      let result = ''
      for (let i = 0; i < maxLen; i++) {
        const charProgress = Math.min((progress * maxLen - i + 1) / 1.5, 1)
        if (charProgress >= 1 && i < target.length) {
          result += target[i]
        } else if (i < target.length) {
          result += GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        }
      }

      setDisplay(result)

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        setDisplay(target)
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [target, duration])

  return display
}

// ─── Color transition timing ────────────────────────────────────────────────

const COLOR_TRANSITION = { duration: 0.08, ease: [0.4, 0, 0.2, 1] } as const

// ─── Component ──────────────────────────────────────────────────────────────

export function TMNLStatus() {
  const health = useSystemHealth()
  const paletteOpen = usePaletteOpen()

  const baseCfg = STATUS_MAP[health.niri] ?? STATUS_MAP.disconnected
  const cfg = paletteOpen ? CMD_CONFIG : baseCfg
  const alive = health.healthy

  const scrambledLabel = useTextScramble(cfg.label)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.25, type: 'spring', stiffness: 300, damping: 20 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {/* Reticle container */}
      <div style={{ position: 'relative', width: 30, height: 30 }}>
        <AnimatePresence>
          {paletteOpen ? (
            <TargetReticle key="target" color={cfg.color} glow={cfg.glow} />
          ) : (
            <ScanReticle key="scan" color={cfg.color} glow={cfg.glow} alive={alive} />
          )}
        </AnimatePresence>
      </div>

      {/* Label */}
      <motion.span
        animate={{ color: cfg.color }}
        transition={COLOR_TRANSITION}
        style={{
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: '0.2em',
          lineHeight: 1,
          opacity: 0.6,
          minWidth: '3.5em',
          textAlign: 'center',
        }}
      >
        {scrambledLabel}
      </motion.span>
    </motion.div>
  )
}

// ─── Scan Reticle (default — rotating rings) ────────────────────────────────

function ScanReticle({ color, glow, alive }: { color: string; glow: string; alive: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.7 }}
      transition={{ duration: 0.08, ease: [0.4, 0, 0.2, 1] }}
      style={{ position: 'absolute', inset: 0 }}
    >
      {/* Outer ring — slow CW */}
      <motion.svg
        width={30} height={30} viewBox="0 0 30 30"
        style={{ position: 'absolute', inset: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
      >
        <motion.circle
          cx={15} cy={15} r={13}
          fill="none" animate={{ stroke: color }} transition={COLOR_TRANSITION}
          strokeWidth={0.5} strokeDasharray="2.5 4.5"
          opacity={0.35}
        />
        {[0, 90, 180, 270].map((a) => (
          <motion.line
            key={a}
            x1={15} y1={1} x2={15} y2={3.5}
            animate={{ stroke: color }} transition={COLOR_TRANSITION}
            strokeWidth={0.7} opacity={0.45}
            transform={`rotate(${a} 15 15)`}
          />
        ))}
      </motion.svg>

      {/* Inner ring — slow CCW */}
      <motion.svg
        width={30} height={30} viewBox="0 0 30 30"
        style={{ position: 'absolute', inset: 0 }}
        animate={{ rotate: -360 }}
        transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
      >
        <motion.circle
          cx={15} cy={15} r={8}
          fill="none" animate={{ stroke: color }} transition={COLOR_TRANSITION}
          strokeWidth={0.35} strokeDasharray="1.5 3.5"
          opacity={0.25}
        />
      </motion.svg>

      {/* Center pip */}
      <motion.div
        animate={alive ? {
          scale: [1, 1.5, 1],
          opacity: [0.7, 1, 0.7],
        } : {
          scale: 1,
          opacity: 0.35,
        }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: 5, height: 5,
          marginLeft: -2.5, marginTop: -2.5,
          borderRadius: '50%',
          background: color,
          boxShadow: alive
            ? `0 0 6px ${color}70, 0 0 14px ${glow}`
            : 'none',
        }}
      />
    </motion.div>
  )
}

// ─── Target Reticle (CMD mode — crosshairs + lock ring) ─────────────────────

function TargetReticle({ color, glow }: { color: string; glow: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.3 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.7 }}
      transition={{ duration: 0.08, ease: [0.4, 0, 0.2, 1] }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <svg width={30} height={30} viewBox="0 0 30 30" style={{ position: 'absolute', inset: 0 }}>
        {/* Outer lock ring — solid, no rotation */}
        <motion.circle
          cx={15} cy={15} r={13}
          fill="none" animate={{ stroke: color }} transition={COLOR_TRANSITION}
          strokeWidth={0.7}
          opacity={0.5}
        />

        {/* Corner brackets — 4 arcs at cardinals */}
        {[0, 90, 180, 270].map((a) => (
          <motion.line
            key={`bracket-${a}`}
            x1={15} y1={0.5} x2={15} y2={4.5}
            animate={{ stroke: color }} transition={COLOR_TRANSITION}
            strokeWidth={1} opacity={0.7}
            transform={`rotate(${a} 15 15)`}
          />
        ))}

        {/* Crosshairs — 4 lines with center gap */}
        {/* Top */}
        <motion.line x1={15} y1={4} x2={15} y2={10}
          animate={{ stroke: color }} transition={COLOR_TRANSITION}
          strokeWidth={0.5} opacity={0.5} />
        {/* Bottom */}
        <motion.line x1={15} y1={20} x2={15} y2={26}
          animate={{ stroke: color }} transition={COLOR_TRANSITION}
          strokeWidth={0.5} opacity={0.5} />
        {/* Left */}
        <motion.line x1={4} y1={15} x2={10} y2={15}
          animate={{ stroke: color }} transition={COLOR_TRANSITION}
          strokeWidth={0.5} opacity={0.5} />
        {/* Right */}
        <motion.line x1={20} y1={15} x2={26} y2={15}
          animate={{ stroke: color }} transition={COLOR_TRANSITION}
          strokeWidth={0.5} opacity={0.5} />

        {/* Inner diamond — tight lock indicator */}
        <motion.rect
          x={12.5} y={12.5} width={5} height={5}
          fill="none" animate={{ stroke: color }} transition={COLOR_TRANSITION}
          strokeWidth={0.4} opacity={0.3}
          transform="rotate(45 15 15)"
        />
      </svg>

      {/* Center pip — fast pulse, locked */}
      <motion.div
        animate={{
          scale: [1, 2, 1],
          opacity: [0.9, 1, 0.9],
        }}
        transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: 4, height: 4,
          marginLeft: -2, marginTop: -2,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 8px ${color}90, 0 0 18px ${glow}`,
        }}
      />
    </motion.div>
  )
}
