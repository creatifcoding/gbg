/**
 * CalendarWindow — Standalone floating calendar.
 *
 * Renders in its own Tauri window, spawned next to the bar.
 * Vantablack with phosphor accents.
 * Click outside or press Escape → hides via Tauri command.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'

// ─── Tokens (self-contained — no @/ imports for separate window bundle) ────

const C = {
  void: '#000000',
  surface: '#080a0e',
  raised: '#0e1118',
  phosphor: '#7ec8b0',
  phosphorDim: '#3d6e5c',
  ink: '#b8bcc6',
  inkMid: '#5a6070',
  inkFaint: '#2a2e38',
  border: 'rgba(255, 255, 255, 0.06)',
  today: '#7ec8b0',
  weekend: '#5a6070',
} as const

// ─── Calendar Logic ─────────────────────────────────────────────────────────

function buildMonth(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthName = new Date(year, month).toLocaleDateString('en', { month: 'long' })
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  const todayDate = isCurrentMonth ? today.getDate() : -1

  const weeks: (number | null)[][] = []
  let week: (number | null)[] = Array(firstDay).fill(null)

  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d)
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  return { monthName, year, todayDate, weeks }
}

// ─── Calendar ───────────────────────────────────────────────────────────────

export function CalendarWindow() {
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [direction, setDirection] = useState(0) // -1 prev, 1 next for animation

  const cal = useMemo(
    () => buildMonth(viewYear, viewMonth),
    [viewYear, viewMonth]
  )

  const navigate = useCallback((delta: number) => {
    setDirection(delta)
    setViewMonth((prev) => {
      let m = prev + delta
      if (m < 0) { setViewYear((y) => y - 1); m = 11 }
      if (m > 11) { setViewYear((y) => y + 1); m = 0 }
      return m
    })
  }, [])

  // Escape key → hide window
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        try {
          const { invoke } = await import('@tauri-apps/api/core')
          await invoke('hide_calendar')
        } catch {}
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Click outside → hide (blur event on window)
  useEffect(() => {
    const handler = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('hide_calendar')
      } catch {}
    }
    // Small delay to avoid immediate hide on spawn
    const timer = setTimeout(() => {
      window.addEventListener('blur', handler)
    }, 300)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('blur', handler)
    }
  }, [])

  const cell = 28
  const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      style={{
        width: '100%',
        height: '100%',
        background: C.surface,
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        padding: '10px 10px 8px',
        fontFamily: "'JetBrains Mono', monospace",
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        boxShadow: `
          0 8px 32px rgba(0,0,0,0.9),
          0 0 1px ${C.phosphorDim}30,
          inset 0 1px 0 rgba(255,255,255,0.03)
        `,
        cursor: 'default',
        overflow: 'hidden',
      }}
    >
      {/* Header — month nav */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2px',
      }}>
        <NavButton onClick={() => navigate(-1)}>◂</NavButton>
        <motion.span
          key={`${viewYear}-${viewMonth}`}
          initial={{ opacity: 0, x: direction * 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: C.phosphor,
            letterSpacing: '0.06em',
          }}
        >
          {cal.monthName.toUpperCase()} {cal.year}
        </motion.span>
        <NavButton onClick={() => navigate(1)}>▸</NavButton>
      </div>

      {/* Day headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(7, ${cell}px)`,
        justifyContent: 'center',
        gap: 2,
      }}>
        {days.map((d, i) => (
          <div key={i} style={{
            width: cell,
            height: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
            fontWeight: 600,
            color: (i === 0 || i === 6) ? C.weekend : C.inkFaint,
            letterSpacing: '0.05em',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Weeks grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${viewYear}-${viewMonth}`}
          initial={{ opacity: 0, x: direction * 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -20 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {cal.weeks.map((week, wi) => (
            <div
              key={wi}
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(7, ${cell}px)`,
                justifyContent: 'center',
                gap: 2,
              }}
            >
              {week.map((day, di) => {
                const isToday = day === cal.todayDate
                const isWeekend = di === 0 || di === 6

                return (
                  <motion.div
                    key={di}
                    whileHover={day ? { background: C.raised } : undefined}
                    style={{
                      width: cell,
                      height: cell,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: isToday ? 700 : 400,
                      color: !day
                        ? 'transparent'
                        : isToday
                          ? C.void
                          : isWeekend
                            ? C.weekend
                            : C.ink,
                      background: isToday ? C.today : 'transparent',
                      borderRadius: isToday ? 6 : 4,
                      lineHeight: 1,
                      cursor: day ? 'pointer' : 'default',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {day ?? ''}
                  </motion.div>
                )
              })}
            </div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Footer — today shortcut */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        paddingTop: 2,
      }}>
        <motion.button
          onClick={() => {
            const t = new Date()
            setDirection(0)
            setViewYear(t.getFullYear())
            setViewMonth(t.getMonth())
          }}
          whileHover={{ color: C.phosphor }}
          style={{
            border: 'none',
            background: 'transparent',
            fontSize: 9,
            fontWeight: 600,
            color: C.inkFaint,
            letterSpacing: '0.1em',
            cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace",
            padding: '2px 6px',
          }}
        >
          TODAY
        </motion.button>
      </div>
    </motion.div>
  )
}

// ─── Nav Button ─────────────────────────────────────────────────────────────

function NavButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.15, color: C.phosphor }}
      whileTap={{ scale: 0.9 }}
      style={{
        border: 'none',
        background: 'transparent',
        color: C.inkMid,
        fontSize: 14,
        cursor: 'pointer',
        padding: '2px 6px',
        borderRadius: 4,
        fontFamily: "'JetBrains Mono', monospace",
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {children}
    </motion.button>
  )
}
