/**
 * CalendarPanel — Vantablack-themed calendar for the bar popover.
 *
 * Uses the compound Calendar system with a custom day renderer
 * styled to the V (vantablack) design tokens.
 */

import React, { useCallback } from 'react'
import { motion } from 'motion/react'
import { Calendar, type DayMeta, type CalendarEvent } from '@/lib/getbyshell/calendar'
import { closePopover } from '@/lib/getbyshell/popover'
import { V } from './BarLayout'

// ─── Vantablack Day Cell ────────────────────────────────────────────────────

function VantablackDay({ meta }: { meta: DayMeta }) {
  const hasEvents = meta.events.length > 0

  return (
    <motion.div
      whileHover={meta.isCurrentMonth ? { background: V.raised } : undefined}
      style={{
        width: 28,
        height: 28,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: V.xs,
        fontWeight: meta.isToday ? 700 : meta.isSelected ? 600 : 400,
        color: !meta.isCurrentMonth
          ? V.inkGhost
          : meta.isToday
            ? V.void
            : meta.isSelected
              ? V.phosphor
              : meta.isWeekend
                ? V.inkMid
                : V.ink,
        background: meta.isToday
          ? V.phosphor
          : meta.isSelected
            ? V.phosphorGhost
            : 'transparent',
        borderRadius: meta.isToday || meta.isSelected ? 6 : 4,
        cursor: meta.isCurrentMonth ? 'pointer' : 'default',
        transition: 'background 0.15s ease, color 0.15s ease',
        lineHeight: 1,
        position: 'relative',
      }}
    >
      <span>{meta.day}</span>

      {/* Event dots */}
      {hasEvents && meta.isCurrentMonth && (
        <div style={{
          position: 'absolute',
          bottom: 2,
          display: 'flex',
          gap: 1.5,
        }}>
          {meta.events.slice(0, 3).map((ev, i) => (
            <div key={i} style={{
              width: 3,
              height: 3,
              borderRadius: '50%',
              background: meta.isToday ? V.void : V.phosphorMid,
              opacity: 0.9,
            }} />
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ─── Vantablack Header ──────────────────────────────────────────────────────

function VantablackHeader() {
  return (
    <Calendar.Header>
      {({ label, onPrev, onNext }) => (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 2px',
        }}>
          <NavBtn onClick={onPrev}>◂</NavBtn>
          <motion.span
            key={label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: V.phosphor,
              letterSpacing: '0.06em',
            }}
          >
            {label}
          </motion.span>
          <NavBtn onClick={onNext}>▸</NavBtn>
        </div>
      )}
    </Calendar.Header>
  )
}

// ─── Vantablack Footer ──────────────────────────────────────────────────────

function VantablackFooter({ onOpenChronicle }: { onOpenChronicle?: () => void }) {
  return (
    <Calendar.Footer>
      {({ onToday, eventCount }) => (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 2,
          padding: '2px 4px 0',
        }}>
          {onOpenChronicle ? (
            <motion.button
              onClick={onOpenChronicle}
              whileHover={{ color: V.phosphor, background: V.phosphorGhost }}
              whileTap={{ scale: 0.95 }}
              style={{
                border: `1px solid ${V.border}`,
                background: 'transparent',
                fontSize: 8, fontWeight: 700, color: V.phosphorDim,
                letterSpacing: '0.14em', cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
                padding: '3px 6px', borderRadius: 4,
                transition: 'color 0.15s, background 0.15s',
              }}
            >CHRONICLE</motion.button>
          ) : eventCount > 0 ? (
            <span style={{
              fontSize: 9, color: V.phosphorDim,
              letterSpacing: '0.06em', fontWeight: 500,
            }}>
              {eventCount} event{eventCount !== 1 ? 's' : ''}
            </span>
          ) : <span />}
          <motion.button
            onClick={onToday}
            whileHover={{ color: V.phosphor }}
            style={{
              border: 'none', background: 'transparent',
              fontSize: 9, fontWeight: 600, color: V.inkFaint,
              letterSpacing: '0.12em', cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
              padding: '3px 8px', borderRadius: 4,
            }}
          >TODAY</motion.button>
        </div>
      )}
    </Calendar.Footer>
  )
}

// ─── Vantablack Event Row ───────────────────────────────────────────────────

function VantablackEventRow({ event }: { event: CalendarEvent }) {
  return (
    <div style={{
      fontSize: 10, padding: '3px 6px', borderRadius: 4,
      display: 'flex', alignItems: 'center', gap: 5,
      background: V.raised,
      opacity: event.completed ? 0.4 : 0.9,
    }}>
      <span style={{
        width: 4, height: 4, borderRadius: '50%',
        background: V.phosphorMid, flexShrink: 0,
      }} />
      <span style={{
        color: V.ink, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textDecoration: event.completed ? 'line-through' : 'none',
      }}>
        {event.title}
      </span>
    </div>
  )
}

// ─── Panel ──────────────────────────────────────────────────────────────────

interface CalendarPanelProps {
  onDayClick?: (meta: DayMeta) => void
  onDayDoubleClick?: (meta: DayMeta) => void
  events?: readonly CalendarEvent[]
}

export function CalendarPanel({ onDayClick, onDayDoubleClick, events }: CalendarPanelProps) {
  /** Open Chronicle overlay — close calendar popover first */
  const handleOpenChronicle = useCallback(async (dayId?: string) => {
    console.warn('[CALENDAR] handleOpenChronicle called, dayId=', dayId)
    closePopover('calendar')
    
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('toggle_chronicle')
    } catch (err) {
      console.error('[CALENDAR] Failed to toggle Chronicle:', err)
    }
  }, [])

  /** Double-click a day → open Chronicle focused on that day */
  const handleDayDoubleClick = useCallback((meta: DayMeta) => {
    handleOpenChronicle(meta.dateKey)
    onDayDoubleClick?.(meta)
  }, [handleOpenChronicle, onDayDoubleClick])
  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: V.surface,
      borderRadius: 10,
      border: `1px solid ${V.border}`,
      padding: '12px 12px 8px',
      fontFamily: "'JetBrains Mono', monospace",
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      boxShadow: `
        0 12px 40px rgba(0,0,0,0.9),
        0 0 0 1px ${V.phosphorDim}15,
        inset 0 1px 0 rgba(255,255,255,0.03)
      `,
      color: V.ink,
    }}>
      <Calendar
        onDayClick={onDayClick}
        onDayDoubleClick={handleDayDoubleClick}
        events={events}
        selectionMode="single"
      >
        <VantablackHeader />

        {/* Day labels with V tokens */}
        <Calendar.DayLabels />

        <Calendar.Grid DayComponent={VantablackDay} />

        <Calendar.EventList
          renderEvent={(ev) => <VantablackEventRow event={ev} />}
          emptyText=""
        />

        <VantablackFooter onOpenChronicle={() => handleOpenChronicle()} />
      </Calendar>
    </div>
  )
}

// ─── Nav Button ─────────────────────────────────────────────────────────────

function NavBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.15, color: V.phosphor }}
      whileTap={{ scale: 0.9 }}
      style={{
        border: 'none', background: 'transparent',
        color: V.inkMid, fontSize: 14, cursor: 'pointer',
        padding: '2px 6px', borderRadius: 4,
        fontFamily: "'JetBrains Mono', monospace",
        lineHeight: 1, display: 'flex', alignItems: 'center',
      }}
    >{children}</motion.button>
  )
}
