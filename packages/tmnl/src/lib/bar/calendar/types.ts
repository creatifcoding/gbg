/**
 * Calendar System — Effect Schema Types
 *
 * Domain types for calendar events, day metadata, and service contracts.
 * All domain entities defined as Schema per AGENTS.md discipline.
 */

import { Schema } from 'effect'

// ─── Core Date Types ────────────────────────────────────────────────────────

/** ISO date string: "2026-02-20" */
export const DateKey = Schema.String.pipe(
  Schema.pattern(/^\d{4}-\d{2}-\d{2}$/),
  Schema.brand('DateKey'),
)
export type DateKey = typeof DateKey.Type

/** Calendar event source */
export const CalendarSource = Schema.Literal(
  'local',
  'google',
  'caldav',
  'ical',
  'tmnl',
)
export type CalendarSource = typeof CalendarSource.Type

/** Event priority / visual weight */
export const EventPriority = Schema.Literal('low', 'normal', 'high', 'urgent')
export type EventPriority = typeof EventPriority.Type

/** Selection mode for day picking */
export const SelectionMode = Schema.Literal('single', 'multiple', 'range', 'none')
export type SelectionMode = typeof SelectionMode.Type

// ─── Calendar Event ─────────────────────────────────────────────────────────

export class CalendarEvent extends Schema.Class<CalendarEvent>('CalendarEvent')({
  id: Schema.String,
  title: Schema.String,
  dateKey: Schema.String,
  startTime: Schema.optionalWith(Schema.String, { as: 'Option' }),
  endTime: Schema.optionalWith(Schema.String, { as: 'Option' }),
  allDay: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  source: Schema.optionalWith(CalendarSource, { default: () => 'local' as const }),
  priority: Schema.optionalWith(EventPriority, { default: () => 'normal' as const }),
  color: Schema.optionalWith(Schema.String, { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  completed: Schema.optionalWith(Schema.Boolean, { default: () => false }),
}) {}

// ─── Day Cell Metadata ──────────────────────────────────────────────────────

/** Everything a custom day renderer receives. */
export interface DayMeta {
  readonly day: number
  readonly date: Date
  readonly dateKey: string
  readonly isCurrentMonth: boolean
  readonly isToday: boolean
  readonly isSelected: boolean
  readonly isWeekend: boolean
  readonly isFuture: boolean
  readonly events: readonly CalendarEvent[]
  readonly dayOfWeek: number
  readonly weekNumber: number
}

// ─── Calendar Actions ───────────────────────────────────────────────────────

export interface CalendarActions {
  onDayClick?: (meta: DayMeta) => void
  onDayDoubleClick?: (meta: DayMeta) => void
  onDayHoverStart?: (meta: DayMeta) => void
  onDayHoverEnd?: (meta: DayMeta) => void
  onEventClick?: (event: CalendarEvent, meta: DayMeta) => void
  onMonthChange?: (year: number, month: number) => void
  onSelectionChange?: (dateKeys: readonly string[]) => void
}
