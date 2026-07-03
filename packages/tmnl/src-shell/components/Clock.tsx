/**
 * Clock — Vantablack vertical time display with popover calendar.
 *
 * Left-click → opens CalendarPanel popover.
 * Right-click → toggles inline date view.
 */

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useClock } from '@/lib/getbyshell'
import { Popover } from '@/lib/getbyshell/popover'
import { V } from './BarLayout'
import { CalendarPanel } from './CalendarPanel'

// ─── Date View (inline, toggled via right-click) ────────────────────────────

function DateView() {
  const now = new Date()
  const dayNum = now.getDate()
  const month = now.toLocaleDateString('en', { month: 'short' }).toUpperCase()
  const year = now.getFullYear().toString().slice(2)
  const weekNum = getWeekNumber(now)

  return (
    <motion.div
      initial={{ opacity: 0, rotateX: -60 }}
      animate={{ opacity: 1, rotateX: 0 }}
      exit={{ opacity: 0, rotateX: 60 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <span style={{
        fontSize: 16, color: V.phosphor,
        fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em',
      }}>{dayNum}</span>
      <span style={{
        fontSize: V.xs, color: V.ink,
        fontWeight: 600, letterSpacing: '0.12em', lineHeight: 1,
      }}>{month}</span>
      <span style={{
        fontSize: V.xs, color: V.inkFaint,
        fontWeight: 500, letterSpacing: '0.08em', lineHeight: 1, marginTop: 1,
      }}>'{year} W{weekNum}</span>
    </motion.div>
  )
}

// ─── Time View (default) ────────────────────────────────────────────────────

function TimeView() {
  const { hours, minutes, day, pulseSeparator } = useClock()

  return (
    <motion.div
      initial={{ opacity: 0, rotateX: 60 }}
      animate={{ opacity: 1, rotateX: 0 }}
      exit={{ opacity: 0, rotateX: -60 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
      }}
    >
      <span style={{
        fontSize: 16, color: V.ink,
        fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1,
      }}>{hours}</span>

      <motion.span
        animate={{ opacity: pulseSeparator ? 0.85 : 0.1 }}
        transition={{ duration: 0.45 }}
        style={{ fontSize: 12, color: V.phosphor, lineHeight: 1, margin: '1px 0' }}
      >◆</motion.span>

      <span style={{
        fontSize: 16, color: V.ink,
        fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1,
      }}>{minutes}</span>

      <span style={{
        fontSize: V.xs, color: V.inkFaint,
        marginTop: 3, letterSpacing: '0.14em', fontWeight: 600, lineHeight: 1,
      }}>{day}</span>
    </motion.div>
  )
}

// ─── Clock ──────────────────────────────────────────────────────────────────

export function Clock() {
  const [showDate, setShowDate] = useState(false)

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setShowDate((p) => !p)
  }, [])

  return (
    <Popover id="calendar" placement="right-end">
      <Popover.Trigger>
        <motion.div
          onContextMenu={handleContextMenu}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 76,
            padding: '8px 6px',
            borderRadius: 8,
            fontFamily: "'JetBrains Mono', monospace",
            cursor: 'pointer',
          }}
        >
          <AnimatePresence mode="wait">
            {showDate ? <DateView key="date" /> : <TimeView key="time" />}
          </AnimatePresence>
        </motion.div>
      </Popover.Trigger>

      <Popover.Content width={280} height={360}>
        <CalendarPanel />
      </Popover.Content>
    </Popover>
  )
}

// ─── Util ───────────────────────────────────────────────────────────────────

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}
