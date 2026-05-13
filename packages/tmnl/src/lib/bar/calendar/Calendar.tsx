/**
 * Calendar — Compound component with scoped RegistryProvider.
 *
 * Each <Calendar> gets its own atom scope via RegistryProvider,
 * so multiple calendars can coexist with independent state.
 *
 * Architecture: Ark UI–inspired slots with render-prop day cells.
 * State: Atom-as-State via calendar/atoms.ts, scoped per Provider.
 * Animations: motion/react springs.
 *
 * Usage:
 * ```tsx
 * // Full control:
 * <Calendar onDayClick={(meta) => console.log(meta.dateKey)}>
 *   <Calendar.Header />
 *   <Calendar.DayLabels />
 *   <Calendar.Grid renderDay={(meta) => <MyDayCell meta={meta} />} />
 *   <Calendar.EventList />
 *   <Calendar.Footer />
 * </Calendar>
 *
 * // Batteries included:
 * <Calendar.Preset onDayClick={handler} showEventList />
 * ```
 */

import React, {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
  type ComponentType,
} from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { RegistryProvider, useAtomValue, useSetAtom } from '@effect-atom/atom-react'

import type { DayMeta, CalendarActions, CalendarEvent, SelectionMode } from './types'
import {
  viewYearAtom,
  viewMonthAtom,
  selectedDatesAtom,
  eventsMapAtom,
  selectionModeAtom,
  startOfWeekAtom,
  navDirectionAtom,
  monthGridAtom,
  monthLabelAtom,
  weekdayHeadersAtom,
  viewKeyAtom,
  selectedEventsAtom,
  monthEventCountAtom,
} from './atoms'
import { toDateKey } from './math'

// ─── Context (actions + config — NOT atom state) ────────────────────────────

interface CalendarCtx extends CalendarActions {
  cellSize: number
}

const CalendarContext = createContext<CalendarCtx>({ cellSize: 28 })

function useCalendarCtx() {
  return useContext(CalendarContext)
}

// ─── Ops hooks (scoped to nearest RegistryProvider) ─────────────────────────

function useNavigateNext() {
  const setDir = useSetAtom(navDirectionAtom)
  const setMonth = useSetAtom(viewMonthAtom)
  const setYear = useSetAtom(viewYearAtom)
  return useCallback(() => {
    setDir(1)
    setMonth((m) => {
      if (m >= 11) { setYear((y) => y + 1); return 0 }
      return m + 1
    })
  }, [setDir, setMonth, setYear])
}

function useNavigatePrev() {
  const setDir = useSetAtom(navDirectionAtom)
  const setMonth = useSetAtom(viewMonthAtom)
  const setYear = useSetAtom(viewYearAtom)
  return useCallback(() => {
    setDir(-1)
    setMonth((m) => {
      if (m <= 0) { setYear((y) => y - 1); return 11 }
      return m - 1
    })
  }, [setDir, setMonth, setYear])
}

function useNavigateToday() {
  const setDir = useSetAtom(navDirectionAtom)
  const setMonth = useSetAtom(viewMonthAtom)
  const setYear = useSetAtom(viewYearAtom)
  return useCallback(() => {
    const t = new Date()
    setDir(0)
    setYear(t.getFullYear())
    setMonth(t.getMonth())
  }, [setDir, setMonth, setYear])
}

function useSelectDay() {
  const setSelected = useSetAtom(selectedDatesAtom)
  const mode = useAtomValue(selectionModeAtom)
  return useCallback((meta: DayMeta) => {
    switch (mode) {
      case 'none': return
      case 'single':
        setSelected(new Set([meta.dateKey]))
        return
      case 'multiple':
        setSelected((prev) => {
          const next = new Set(prev)
          if (next.has(meta.dateKey)) next.delete(meta.dateKey)
          else next.add(meta.dateKey)
          return next
        })
        return
      case 'range':
        setSelected(new Set([meta.dateKey]))
        return
    }
  }, [mode, setSelected])
}

// ─── Root (Provider) ────────────────────────────────────────────────────────

interface CalendarProps extends CalendarActions {
  children: ReactNode
  /** Cell size in px (default: 28) */
  cellSize?: number
  /** Selection mode (default: 'single') */
  selectionMode?: SelectionMode
  /** Start of week: 0=Sun, 1=Mon (default: 0) */
  startOfWeek?: 0 | 1
  /** Pre-loaded events */
  events?: readonly CalendarEvent[]
  /** Initial year/month */
  initialYear?: number
  initialMonth?: number
}

export function Calendar({
  children,
  cellSize = 28,
  selectionMode = 'single',
  startOfWeek = 0,
  events,
  initialYear,
  initialMonth,
  ...actions
}: CalendarProps) {
  const now = new Date()
  const year = initialYear ?? now.getFullYear()
  const month = initialMonth ?? now.getMonth()

  // Build initial events map
  const eventsMap = React.useMemo(() => {
    if (!events?.length) return new Map<string, readonly CalendarEvent[]>()
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const existing = map.get(e.dateKey) ?? []
      existing.push(e)
      map.set(e.dateKey, existing)
    }
    return map as ReadonlyMap<string, readonly CalendarEvent[]>
  }, [events])

  // initialValues seeds the scoped Registry
  const initialValues = React.useMemo(() => [
    [viewYearAtom, year] as const,
    [viewMonthAtom, month] as const,
    [selectionModeAtom, selectionMode] as const,
    [startOfWeekAtom, startOfWeek] as const,
    [eventsMapAtom, eventsMap] as const,
    [selectedDatesAtom, new Set<string>()] as const,
    [navDirectionAtom, 0] as const,
  ], [year, month, selectionMode, startOfWeek, eventsMap])

  return (
    <RegistryProvider initialValues={initialValues as any}>
      <CalendarContext.Provider value={{ cellSize, ...actions }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontFamily: "'JetBrains Mono', monospace",
          width: '100%',
        }}>
          {children}
        </div>
      </CalendarContext.Provider>
    </RegistryProvider>
  )
}

// ─── Header ─────────────────────────────────────────────────────────────────

interface HeaderProps {
  /** Custom header render */
  children?: (props: {
    label: string
    onPrev: () => void
    onNext: () => void
    onToday: () => void
    eventCount: number
  }) => ReactNode
}

function Header({ children }: HeaderProps) {
  const label = useAtomValue(monthLabelAtom)
  const direction = useAtomValue(navDirectionAtom)
  const eventCount = useAtomValue(monthEventCountAtom)
  const onPrev = useNavigatePrev()
  const onNext = useNavigateNext()
  const onToday = useNavigateToday()

  const props = { label, onPrev, onNext, onToday, eventCount }

  if (children) return <>{children(props)}</>

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 2px',
    }}>
      <NavBtn onClick={onPrev}>◂</NavBtn>
      <motion.span
        key={label}
        initial={{ opacity: 0, x: direction * 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.06em',
          lineHeight: 1,
        }}
      >
        {label}
      </motion.span>
      <NavBtn onClick={onNext}>▸</NavBtn>
    </div>
  )
}

// ─── Day Labels ─────────────────────────────────────────────────────────────

function DayLabels() {
  const headers = useAtomValue(weekdayHeadersAtom)
  const { cellSize } = useCalendarCtx()

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(7, ${cellSize}px)`,
      justifyContent: 'center',
      gap: 2,
    }}>
      {headers.map((d, i) => (
        <div key={i} style={{
          width: cellSize, height: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 600,
          opacity: (i === 0 || i === 6) ? 0.5 : 0.3,
          letterSpacing: '0.05em',
        }}>{d}</div>
      ))}
    </div>
  )
}

// ─── Grid ───────────────────────────────────────────────────────────────────

interface GridProps {
  /** Custom day cell renderer. Receives full DayMeta. */
  renderDay?: (meta: DayMeta) => ReactNode
  /** Custom day component (alternative to renderDay) */
  DayComponent?: ComponentType<{ meta: DayMeta }>
}

function Grid({ renderDay, DayComponent }: GridProps) {
  const grid = useAtomValue(monthGridAtom)
  const direction = useAtomValue(navDirectionAtom)
  const viewKey = useAtomValue(viewKeyAtom)
  const { cellSize, onDayClick, onDayDoubleClick, onDayHoverStart, onDayHoverEnd } = useCalendarCtx()
  const doSelectDay = useSelectDay()

  const handleDayClick = useCallback((meta: DayMeta) => {
    doSelectDay(meta)
    onDayClick?.(meta)
  }, [doSelectDay, onDayClick])

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={viewKey}
        initial={{ opacity: 0, x: direction * 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: direction * -16 }}
        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
        style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        {grid.map((week, wi) => (
          <div key={wi} style={{
            display: 'grid',
            gridTemplateColumns: `repeat(7, ${cellSize}px)`,
            justifyContent: 'center',
            gap: 2,
          }}>
            {week.map((meta, di) => {
              const events = {
                onClick: () => handleDayClick(meta),
                onDoubleClick: () => onDayDoubleClick?.(meta),
                onPointerEnter: () => onDayHoverStart?.(meta),
                onPointerLeave: () => onDayHoverEnd?.(meta),
              }

              if (renderDay) {
                return <div key={di} {...events} style={{ cursor: 'pointer' }}>{renderDay(meta)}</div>
              }
              if (DayComponent) {
                return <div key={di} {...events} style={{ cursor: 'pointer' }}><DayComponent meta={meta} /></div>
              }

              return <DefaultDayCell key={di} meta={meta} size={cellSize} {...events} />
            })}
          </div>
        ))}
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Default Day Cell ───────────────────────────────────────────────────────

function DefaultDayCell({
  meta, size, onClick, onDoubleClick, onPointerEnter, onPointerLeave,
}: {
  meta: DayMeta; size: number
  onClick: () => void; onDoubleClick?: () => void
  onPointerEnter?: () => void; onPointerLeave?: () => void
}) {
  return (
    <motion.div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      whileHover={meta.isCurrentMonth ? { scale: 1.12 } : undefined}
      whileTap={meta.isCurrentMonth ? { scale: 0.9 } : undefined}
      style={{
        width: size, height: size,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontSize: 12,
        fontWeight: meta.isToday ? 700 : meta.isSelected ? 600 : 400,
        opacity: meta.isCurrentMonth ? 1 : 0.2,
        borderRadius: meta.isToday || meta.isSelected ? 6 : 4,
        cursor: meta.isCurrentMonth ? 'pointer' : 'default',
        transition: 'background 0.15s ease',
        lineHeight: 1, position: 'relative',
      }}
      data-today={meta.isToday || undefined}
      data-selected={meta.isSelected || undefined}
      data-weekend={meta.isWeekend || undefined}
      data-current-month={meta.isCurrentMonth || undefined}
      data-has-events={meta.events.length > 0 || undefined}
    >
      <span>{meta.day}</span>

      {meta.events.length > 0 && meta.isCurrentMonth && (
        <div style={{
          position: 'absolute', bottom: 2,
          display: 'flex', gap: 1,
        }}>
          {meta.events.slice(0, 3).map((_, i) => (
            <div key={i} style={{
              width: 3, height: 3, borderRadius: '50%', opacity: 0.8,
            }} />
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ─── Event List ─────────────────────────────────────────────────────────────

interface EventListProps {
  renderEvent?: (event: CalendarEvent) => ReactNode
  limit?: number
  emptyText?: string
}

function EventList({ renderEvent, limit = 5, emptyText = 'No events' }: EventListProps) {
  const events = useAtomValue(selectedEventsAtom)

  if (events.length === 0) {
    return (
      <div style={{
        fontSize: 9, opacity: 0.3, textAlign: 'center',
        padding: '8px 0', letterSpacing: '0.08em',
      }}>
        {emptyText}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {events.slice(0, limit).map((event) =>
        renderEvent
          ? <React.Fragment key={event.id}>{renderEvent(event)}</React.Fragment>
          : (
            <div key={event.id} style={{
              fontSize: 10, padding: '3px 6px', borderRadius: 4,
              display: 'flex', alignItems: 'center', gap: 4,
              opacity: event.completed ? 0.4 : 0.9,
            }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', flexShrink: 0 }} />
              <span style={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textDecoration: event.completed ? 'line-through' : 'none',
              }}>
                {event.title}
              </span>
            </div>
          )
      )}
      {events.length > limit && (
        <div style={{ fontSize: 9, opacity: 0.3, textAlign: 'center', letterSpacing: '0.06em' }}>
          +{events.length - limit} more
        </div>
      )}
    </div>
  )
}

// ─── Footer ─────────────────────────────────────────────────────────────────

interface FooterProps {
  children?: (props: { onToday: () => void; eventCount: number }) => ReactNode
}

function Footer({ children }: FooterProps) {
  const eventCount = useAtomValue(monthEventCountAtom)
  const onToday = useNavigateToday()

  if (children) return <>{children({ onToday, eventCount })}</>

  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
      <motion.button
        onClick={onToday}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{
          border: 'none', background: 'transparent',
          fontSize: 9, fontWeight: 600, opacity: 0.3,
          letterSpacing: '0.12em', cursor: 'pointer',
          fontFamily: "'JetBrains Mono', monospace",
          padding: '3px 8px', borderRadius: 4, color: 'inherit',
        }}
      >TODAY</motion.button>
    </div>
  )
}

// ─── Preset (Batteries-Included) ────────────────────────────────────────────

interface PresetProps extends CalendarActions {
  cellSize?: number
  selectionMode?: SelectionMode
  startOfWeek?: 0 | 1
  events?: readonly CalendarEvent[]
  showEventList?: boolean
  renderDay?: (meta: DayMeta) => ReactNode
  DayComponent?: ComponentType<{ meta: DayMeta }>
  renderEvent?: (event: CalendarEvent) => ReactNode
}

function Preset({
  cellSize = 28,
  showEventList = false,
  renderDay,
  DayComponent,
  renderEvent,
  ...rest
}: PresetProps) {
  return (
    <Calendar cellSize={cellSize} {...rest}>
      <Header />
      <DayLabels />
      <Grid renderDay={renderDay} DayComponent={DayComponent} />
      {showEventList && <EventList renderEvent={renderEvent} />}
      <Footer />
    </Calendar>
  )
}

// ─── Shared Nav Button ──────────────────────────────────────────────────────

function NavBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.9 }}
      style={{
        border: 'none', background: 'transparent',
        fontSize: 14, cursor: 'pointer', padding: '2px 6px',
        borderRadius: 4, fontFamily: "'JetBrains Mono', monospace",
        lineHeight: 1, display: 'flex', alignItems: 'center',
        color: 'inherit', opacity: 0.5,
      }}
    >{children}</motion.button>
  )
}

// ─── Compound Exports ───────────────────────────────────────────────────────

Calendar.Header = Header
Calendar.DayLabels = DayLabels
Calendar.Grid = Grid
Calendar.EventList = EventList
Calendar.Footer = Footer
Calendar.Preset = Preset
