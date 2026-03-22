/**
 * ChronicleEntrance — Holographic Projection Animation
 *
 * The fullscreen calendar materializes from the bar clock position.
 * Sequence: Bloom → Backdrop → Grid wireframe → Container → Content cascade.
 *
 * Every element has choreographed entrance timing.
 * motion/react springs throughout.
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react'
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react'
import { FUI_COLORS } from '@/lib/fui/tokens'
import {
  viewingMonthAtom,
  monthSummariesAtom,
  selectedDayIdAtom,
  selectDayFn,
  prevMonthFn,
  nextMonthFn,
  goToTodayFn,
  monthActiveDayCountAtom,
} from './atoms'
import type { DayId } from './schemas/identifiers'
import type { DaySummary } from './schemas/day'

// ─── Tokens ─────────────────────────────────────────────────────────────────

const C = {
  void: '#000000',
  backdrop: 'rgba(0, 0, 0, 0.96)',
  phosphor: '#7ec8b0',
  phosphorMid: '#4a7a68',
  phosphorDim: '#2a4a3c',
  phosphorGhost: 'rgba(126, 200, 176, 0.06)',
  gridLine: 'rgba(126, 200, 176, 0.08)',
  gridLineActive: 'rgba(126, 200, 176, 0.15)',
  ink: 'rgba(255, 255, 255, 0.87)',
  inkMid: 'rgba(255, 255, 255, 0.5)',
  inkFaint: 'rgba(255, 255, 255, 0.2)',
  border: 'rgba(255, 255, 255, 0.08)',
  surface: '#050505',
} as const

const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 500, damping: 30 },
  smooth: { type: 'spring' as const, stiffness: 400, damping: 35 },
  soft: { type: 'spring' as const, stiffness: 300, damping: 28 },
  bounce: { type: 'spring' as const, stiffness: 450, damping: 20 },
} as const

const EASE_SHARP = [0.16, 1, 0.3, 1] as const

// ─── Grid Wireframe ─────────────────────────────────────────────────────────

function HoloGrid({ visible, cols = 7, rows = 8 }: { visible: boolean; cols?: number; rows?: number }) {
  const horizontalLines = Array.from({ length: rows + 1 }, (_, i) => i)
  const verticalLines = Array.from({ length: cols + 1 }, (_, i) => i)

  return (
    <svg
      width="100%"
      height="100%"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
      preserveAspectRatio="none"
      viewBox={`0 0 ${cols} ${rows}`}
    >
      {/* Horizontal lines — draw from center outward */}
      {horizontalLines.map((i) => (
        <motion.line
          key={`h-${i}`}
          x1={cols / 2}
          y1={i}
          x2={cols / 2}
          y2={i}
          stroke={C.gridLine}
          strokeWidth={0.015}
          initial={{ x1: cols / 2, x2: cols / 2 }}
          animate={visible ? { x1: 0, x2: cols } : { x1: cols / 2, x2: cols / 2 }}
          transition={{
            duration: 0.5,
            delay: 0.12 + i * 0.02,
            ease: EASE_SHARP,
          }}
        />
      ))}

      {/* Vertical lines — draw from center outward */}
      {verticalLines.map((i) => (
        <motion.line
          key={`v-${i}`}
          x1={i}
          y1={rows / 2}
          x2={i}
          y2={rows / 2}
          stroke={C.gridLine}
          strokeWidth={0.015}
          initial={{ y1: rows / 2, y2: rows / 2 }}
          animate={visible ? { y1: 0, y2: rows } : { y1: rows / 2, y2: rows / 2 }}
          transition={{
            duration: 0.5,
            delay: 0.12 + i * 0.025,
            ease: EASE_SHARP,
          }}
        />
      ))}
    </svg>
  )
}

// ─── Phosphor Bloom ─────────────────────────────────────────────────────────

function PhosphorBloom({
  visible,
  originX,
  originY,
}: {
  visible: boolean
  originX: number
  originY: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={
        visible
          ? { opacity: [0, 1, 0.6, 0], scale: [0, 0.3, 1.5, 3] }
          : { opacity: 0, scale: 0 }
      }
      transition={{ duration: 0.6, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        left: originX,
        top: originY,
        width: 200,
        height: 200,
        marginLeft: -100,
        marginTop: -100,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${C.phosphor}40 0%, ${C.phosphorDim}20 40%, transparent 70%)`,
        pointerEvents: 'none',
        zIndex: 100,
      }}
    />
  )
}

// ─── Day Cell Cascade ───────────────────────────────────────────────────────

interface CascadeCellProps {
  row: number
  col: number
  visible: boolean
  isToday?: boolean
  isWeekend?: boolean
  dayNum?: number
  summary?: DaySummary
  dateKey?: string
  onDayClick?: (dateKey: string) => void
}

function CascadeCell({ row, col, visible, isToday, isWeekend, dayNum, summary, dateKey, onDayClick }: CascadeCellProps) {
  // Manhattan distance from top-left for diagonal wave
  const distance = row + col
  const delay = 0.4 + distance * 0.015

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5, y: 8 }}
      animate={
        visible
          ? { opacity: 1, scale: 1, y: 0 }
          : { opacity: 0, scale: 0.5, y: 8 }
      }
      transition={{
        delay: visible ? delay : 0.1 + (12 - distance) * 0.008,
        ...SPRING.snappy,
      }}
      style={{
        width: '100%',
        aspectRatio: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: isToday ? 8 : 6,
        fontSize: 13,
        fontWeight: isToday ? 800 : 400,
        color: isToday ? C.void : isWeekend ? C.inkMid : C.ink,
        background: isToday ? C.phosphor : C.phosphorGhost,
        border: isToday ? 'none' : `1px solid ${C.border}`,
        position: 'relative',
        cursor: 'pointer',
        fontFamily: "'JetBrains Mono', monospace",
      }}
      onClick={dateKey && onDayClick ? () => onDayClick(dateKey) : undefined}
    >
      {dayNum}

      {/* Content indicators (from DaySummary) */}
      {summary && (summary.eventCount > 0 || summary.taskCount > 0 || summary.noteCount > 0) && (
        <div style={{
          position: 'absolute',
          bottom: 3,
          display: 'flex',
          gap: 2,
        }}>
          {summary.noteCount > 0 && (
            <div style={{ width: 3, height: 3, borderRadius: '50%', background: C.phosphorMid }} />
          )}
          {summary.taskCount > 0 && (
            <div style={{
              width: 3, height: 3, borderRadius: '50%',
              background: summary.tasksDone === summary.taskCount ? C.phosphor : C.inkMid,
            }} />
          )}
          {summary.eventCount > 0 && (
            <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#6ba3d6' }} />
          )}
        </div>
      )}

      {/* Today: phosphor ring pulse */}
      {isToday && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: [0, 0.6, 0], scale: [0.8, 1.3, 1.5] }}
          transition={{ delay: delay + 0.15, duration: 0.6, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            inset: -3,
            borderRadius: 10,
            border: `2px solid ${C.phosphor}`,
            pointerEvents: 'none',
          }}
        />
      )}
    </motion.div>
  )
}

// ─── Day Labels Row ─────────────────────────────────────────────────────────

const LABELS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

function DayLabelsRow({ visible }: { visible: boolean }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gap: 4,
      padding: '0 4px',
    }}>
      {LABELS.map((label, i) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: -8 }}
          animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
          transition={{ delay: 0.32 + i * 0.025, duration: 0.2, ease: EASE_SHARP }}
          style={{
            textAlign: 'center',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: (i === 0 || i === 6) ? C.phosphorMid : C.inkFaint,
            fontFamily: "'JetBrains Mono', monospace",
            padding: '4px 0',
          }}
        >
          {label}
        </motion.div>
      ))}
    </div>
  )
}

// ─── Month Header ───────────────────────────────────────────────────────────

function MonthHeader({ visible, label, onPrev, onNext, onToday, activeDays }: {
  visible: boolean
  label: string
  onPrev?: () => void
  onNext?: () => void
  onToday?: () => void
  activeDays?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: -16 }}
      transition={{ delay: 0.28, ...SPRING.smooth }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px 8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {onPrev && (
          <motion.button
            onClick={onPrev}
            whileHover={{ scale: 1.15, color: C.phosphor }}
            whileTap={{ scale: 0.9 }}
            style={{
              border: 'none', background: 'transparent',
              color: C.inkMid, fontSize: 14, cursor: 'pointer',
              padding: '2px 4px', fontFamily: "'JetBrains Mono', monospace",
            }}
          >◂</motion.button>
        )}
        <motion.span
          key={label}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: C.phosphor,
            letterSpacing: '0.08em',
            fontFamily: "'JetBrains Mono', monospace",
            textShadow: `0 0 20px ${C.phosphorDim}`,
          }}
        >
          {label}
        </motion.span>
        {onNext && (
          <motion.button
            onClick={onNext}
            whileHover={{ scale: 1.15, color: C.phosphor }}
            whileTap={{ scale: 0.9 }}
            style={{
              border: 'none', background: 'transparent',
              color: C.inkMid, fontSize: 14, cursor: 'pointer',
              padding: '2px 4px', fontFamily: "'JetBrains Mono', monospace",
            }}
          >▸</motion.button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {activeDays !== undefined && activeDays > 0 && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={visible ? { opacity: 0.4 } : { opacity: 0 }}
            transition={{ delay: 0.55 }}
            style={{
              fontSize: 9, color: C.phosphorMid,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.06em',
            }}
          >
            {activeDays} active
          </motion.span>
        )}
        <motion.div
          initial={{ opacity: 0 }}
          animate={visible ? { opacity: 0.3 } : { opacity: 0 }}
          transition={{ delay: 0.5 }}
          style={{
            fontSize: 10,
            color: C.ink,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.06em',
            cursor: onToday ? 'pointer' : 'default',
          }}
          onClick={onToday}
          whileHover={onToday ? { color: C.phosphor, opacity: 0.8 } : undefined}
        >
          CHRONICLE
        </motion.div>
      </div>
    </motion.div>
  )
}

// ─── Side Panel Placeholder ─────────────────────────────────────────────────

function SidePanelPlaceholder({ visible }: { visible: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={visible ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
      transition={{ delay: 0.65, ...SPRING.smooth }}
      style={{
        flex: 1,
        background: C.surface,
        borderLeft: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        padding: 24,
        gap: 16,
      }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={visible ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 0.75 }}
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: C.phosphor,
          letterSpacing: '0.1em',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        DAY CANVAS
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={visible ? { opacity: 0.3 } : { opacity: 0 }}
        transition={{ delay: 0.85 }}
        style={{
          fontSize: 11,
          color: C.ink,
          lineHeight: 1.6,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        Select a day to open the collaborative editor.
        <br /><br />
        Spawn morph cards, write notes, link ideas.
        <br />
        Melanie watches for connections.
      </motion.div>
    </motion.div>
  )
}

// ─── Melanie Status Bar ─────────────────────────────────────────────────────

function MelanieStatusBar({ visible }: { visible: boolean }) {
  const [text, setText] = useState('')
  const fullText = '▸ MELANIE ONLINE — 0 connections, 0 insights pending'

  useEffect(() => {
    if (!visible) { setText(''); return }
    let i = 0
    const timer = setInterval(() => {
      setText(fullText.slice(0, i + 1))
      i++
      if (i >= fullText.length) clearInterval(timer)
    }, 18)
    return () => clearInterval(timer)
  }, [visible])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      transition={{ delay: 0.75, duration: 0.3 }}
      style={{
        padding: '8px 16px',
        borderTop: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 32,
      }}
    >
      {/* Melanie indicator dot */}
      <motion.div
        animate={visible ? { opacity: [0.4, 1, 0.4] } : { opacity: 0 }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: C.phosphor,
          flexShrink: 0,
        }}
      />
      <span style={{
        fontSize: 10,
        fontWeight: 500,
        color: C.phosphorMid,
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: '0.04em',
      }}>
        {text}
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ repeat: Infinity, duration: 0.6 }}
        >▌</motion.span>
      </span>
    </motion.div>
  )
}

// ─── Main Chronicle Entrance ────────────────────────────────────────────────

interface ChronicleEntranceProps {
  open: boolean
  onClose: () => void
  /** Origin point for bloom (clock button position) */
  originX?: number
  originY?: number
}

export function ChronicleEntrance({
  open,
  onClose,
  originX = 24,
  originY = window.innerHeight - 60,
}: ChronicleEntranceProps) {
  // ── Atom State ──────────────────────────────────────────────────────────
  const { year: viewYear, month: viewMonth } = useAtomValue(viewingMonthAtom)
  const summaries = useAtomValue(monthSummariesAtom)
  const activeDayCount = useAtomValue(monthActiveDayCountAtom)
  const selectedDayId = useAtomValue(selectedDayIdAtom)

  // ── Build real month grid ───────────────────────────────────────────────
  const now = new Date()
  const todayYear = now.getFullYear()
  const todayMonth = now.getMonth()
  const todayDate = now.getDate()
  const pad = (n: number) => String(n).padStart(2, '0')

  const monthLabel = `${new Date(viewYear, viewMonth).toLocaleDateString('en', { month: 'long' }).toUpperCase()} ${viewYear}`

  // Summary lookup map
  const summaryMap = useMemo(() => {
    const map = new Map<string, DaySummary>()
    for (const s of summaries) map.set(s.dateKey as string, s)
    return map
  }, [summaries])

  const grid = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells: {
      day: number
      dateKey: string
      isToday: boolean
      isWeekend: boolean
      isCurrentMonth: boolean
      isSelected: boolean
      summary?: DaySummary
    }[][] = []
    let dayCounter = 1 - firstDay
    for (let week = 0; week < 6; week++) {
      const row: typeof cells[0] = []
      for (let dow = 0; dow < 7; dow++) {
        const isCurrentMonth = dayCounter >= 1 && dayCounter <= daysInMonth
        const dayNum = isCurrentMonth
          ? dayCounter
          : dayCounter <= 0
            ? new Date(viewYear, viewMonth, dayCounter).getDate()
            : dayCounter - daysInMonth
        const dateKey = isCurrentMonth
          ? `${viewYear}-${pad(viewMonth + 1)}-${pad(dayCounter)}`
          : ''
        row.push({
          day: dayNum,
          dateKey,
          isToday: isCurrentMonth && viewYear === todayYear && viewMonth === todayMonth && dayCounter === todayDate,
          isWeekend: dow === 0 || dow === 6,
          isCurrentMonth,
          isSelected: isCurrentMonth && dateKey === (selectedDayId as string),
          summary: isCurrentMonth ? summaryMap.get(dateKey) : undefined,
        })
        dayCounter++
      }
      cells.push(row)
    }
    return cells
  }, [viewYear, viewMonth, summaryMap, selectedDayId])

  // ── Fn Atom Setters ──────────────────────────────────────────────────────
  const triggerSelectDay = useAtomSet(selectDayFn)
  const triggerPrevMonth = useAtomSet(prevMonthFn)
  const triggerNextMonth = useAtomSet(nextMonthFn)
  const triggerGoToday = useAtomSet(goToTodayFn)

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleDayClick = useCallback((dateKey: string) => {
    triggerSelectDay(dateKey as DayId)
  }, [triggerSelectDay])

  const handlePrevMonth = useCallback(() => { triggerPrevMonth(undefined as any) }, [triggerPrevMonth])
  const handleNextMonth = useCallback(() => { triggerNextMonth(undefined as any) }, [triggerNextMonth])
  const handleToday = useCallback(() => { triggerGoToday(undefined as any) }, [triggerGoToday])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Phase 0: Phosphor bloom */}
          <PhosphorBloom visible={open} originX={originX} originY={originY} />

          {/* Phase 1: Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE_SHARP }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: C.backdrop,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              zIndex: 50,
            }}
          />

          {/* Phase 3: Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ delay: 0.2, ...SPRING.smooth }}
            style={{
              position: 'fixed',
              inset: 16,
              zIndex: 51,
              display: 'flex',
              flexDirection: 'column',
              background: C.void,
              border: `1px solid ${C.border}`,
              borderRadius: 0,
              overflow: 'hidden',
            }}
          >
            {/* Main content area */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Left: Month grid */}
              <div style={{
                width: 380,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                padding: '20px 16px 16px',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Phase 2: Grid wireframe */}
                <HoloGrid visible={open} cols={7} rows={6} />

                {/* Phase 4: Month header with navigation */}
                <MonthHeader
                  visible={open}
                  label={monthLabel}
                  onPrev={handlePrevMonth}
                  onNext={handleNextMonth}
                  onToday={handleToday}
                  activeDays={activeDayCount}
                />

                {/* Phase 5: Day labels */}
                <DayLabelsRow visible={open} />

                {/* Phase 6: Day cell cascade */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: 4,
                  padding: '4px',
                  flex: 1,
                }}>
                  {grid.map((week, wi) =>
                    week.map((cell, di) => (
                      <CascadeCell
                        key={`${wi}-${di}`}
                        row={wi}
                        col={di}
                        visible={open && cell.isCurrentMonth}
                        isToday={cell.isToday}
                        isWeekend={cell.isWeekend}
                        dayNum={cell.isCurrentMonth ? cell.day : undefined}
                        summary={cell.summary}
                        dateKey={cell.dateKey || undefined}
                        onDayClick={handleDayClick}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Right: Side panel placeholder */}
              <SidePanelPlaceholder visible={open} />
            </div>

            {/* Bottom: Melanie status bar */}
            <MelanieStatusBar visible={open} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
