/**
 * Calendar System — Atom-as-State
 *
 * Each <Calendar.Provider> wraps a RegistryProvider, giving
 * every calendar instance its own isolated atom scope.
 *
 * Atoms defined at module level = the shape.
 * RegistryProvider per-instance = isolated values.
 *
 * Pattern: Atom.make() as primary state, derived atoms for computed.
 * Precedent: src/lib/bar/atoms.ts (global), testbeds (scoped Registry).
 */

import { Atom } from '@effect-atom/atom-react'

import type { CalendarEvent, SelectionMode, DayMeta } from './types'
import { buildMonthGrid, weekdayLabels, monthName } from './math'

// ─── Writable State Atoms (shape — scoped per RegistryProvider) ─────────────

const now = new Date()

/** Current view: year */
export const viewYearAtom = Atom.make<number>(now.getFullYear())

/** Current view: month (0-indexed) */
export const viewMonthAtom = Atom.make<number>(now.getMonth())

/** Selected date keys */
export const selectedDatesAtom = Atom.make<ReadonlySet<string>>(new Set())

/** Events keyed by date string */
export const eventsMapAtom = Atom.make<
  ReadonlyMap<string, readonly CalendarEvent[]>
>(new Map())

/** Selection mode */
export const selectionModeAtom = Atom.make<SelectionMode>('single')

/** Start of week: 0=Sunday, 1=Monday */
export const startOfWeekAtom = Atom.make<0 | 1>(0)

/** Navigation direction for animation */
export const navDirectionAtom = Atom.make<number>(0)

// ─── Derived Atoms ──────────────────────────────────────────────────────────

/** Full 6-week grid for the current view month */
export const monthGridAtom = Atom.make((get) =>
  buildMonthGrid(
    get(viewYearAtom),
    get(viewMonthAtom),
    get(selectedDatesAtom),
    get(eventsMapAtom),
    get(startOfWeekAtom),
  )
)

/** Month display text: "FEBRUARY 2026" */
export const monthLabelAtom = Atom.make((get) => {
  const m = get(viewMonthAtom)
  const y = get(viewYearAtom)
  return `${monthName(m).toUpperCase()} ${y}`
})

/** Day-of-week header labels */
export const weekdayHeadersAtom = Atom.make((get) =>
  weekdayLabels(get(startOfWeekAtom))
)

/** View key for animation (triggers AnimatePresence) */
export const viewKeyAtom = Atom.make((get) =>
  `${get(viewYearAtom)}-${get(viewMonthAtom)}`
)

/** Events for currently selected date(s) */
export const selectedEventsAtom = Atom.make((get) => {
  const selected = get(selectedDatesAtom)
  const events = get(eventsMapAtom)
  const result: CalendarEvent[] = []
  for (const key of selected) {
    const dayEvents = events.get(key)
    if (dayEvents) result.push(...dayEvents)
  }
  return result as readonly CalendarEvent[]
})

/** Count of events in current view month */
export const monthEventCountAtom = Atom.make((get) => {
  const grid = get(monthGridAtom)
  let count = 0
  for (const week of grid) {
    for (const day of week) {
      if (day.isCurrentMonth) count += day.events.length
    }
  }
  return count
})

// ─── Ops (Imperative Atom Mutations) ────────────────────────────────────────
//
// These use Atom.set / Atom.get which operate on the nearest
// RegistryContext. When called from within a <Calendar.Provider>,
// they mutate that instance's scoped state — not globals.
//

/** Navigate to next month */
export function navigateNext() {
  Atom.set(navDirectionAtom, 1)
  const month = Atom.get(viewMonthAtom)
  if (month >= 11) {
    Atom.set(viewYearAtom, (y) => y + 1)
    Atom.set(viewMonthAtom, 0)
  } else {
    Atom.set(viewMonthAtom, (m) => m + 1)
  }
}

/** Navigate to previous month */
export function navigatePrev() {
  Atom.set(navDirectionAtom, -1)
  const month = Atom.get(viewMonthAtom)
  if (month <= 0) {
    Atom.set(viewYearAtom, (y) => y - 1)
    Atom.set(viewMonthAtom, 11)
  } else {
    Atom.set(viewMonthAtom, (m) => m - 1)
  }
}

/** Jump to today */
export function navigateToday() {
  const t = new Date()
  Atom.set(navDirectionAtom, 0)
  Atom.set(viewYearAtom, t.getFullYear())
  Atom.set(viewMonthAtom, t.getMonth())
}

/** Select a day (respects selection mode) */
export function selectDay(meta: DayMeta) {
  const mode = Atom.get(selectionModeAtom)
  switch (mode) {
    case 'none':
      return
    case 'single':
      Atom.set(selectedDatesAtom, new Set([meta.dateKey]))
      return
    case 'multiple': {
      const current = Atom.get(selectedDatesAtom)
      const next = new Set(current)
      if (next.has(meta.dateKey)) {
        next.delete(meta.dateKey)
      } else {
        next.add(meta.dateKey)
      }
      Atom.set(selectedDatesAtom, next)
      return
    }
    case 'range':
      Atom.set(selectedDatesAtom, new Set([meta.dateKey]))
      return
  }
}

/** Clear selection */
export function clearSelection() {
  Atom.set(selectedDatesAtom, new Set())
}

/** Add an event */
export function addEvent(event: CalendarEvent) {
  const current = Atom.get(eventsMapAtom)
  const next = new Map(current)
  const existing = next.get(event.dateKey) ?? []
  next.set(event.dateKey, [...existing, event])
  Atom.set(eventsMapAtom, next)
}

/** Remove an event by ID */
export function removeEvent(eventId: string) {
  const current = Atom.get(eventsMapAtom)
  const next = new Map<string, readonly CalendarEvent[]>()
  for (const [key, events] of current) {
    const filtered = events.filter((e) => e.id !== eventId)
    if (filtered.length > 0) next.set(key, filtered)
  }
  Atom.set(eventsMapAtom, next)
}

/** Bulk load events (e.g. from backend fetch) */
export function loadEvents(events: readonly CalendarEvent[]) {
  const map = new Map<string, CalendarEvent[]>()
  for (const event of events) {
    const existing = map.get(event.dateKey) ?? []
    existing.push(event)
    map.set(event.dateKey, existing)
  }
  Atom.set(eventsMapAtom, map)
}
