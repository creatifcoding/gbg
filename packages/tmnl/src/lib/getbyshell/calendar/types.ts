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

// ─── Day Entity Sub-Types ───────────────────────────────────────────────────

/** Freeform note attached to a day (markdown content) */
export class DayNote extends Schema.TaggedClass<DayNote>()('DayNote', {
  id: Schema.String,
  content: Schema.String,
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf,
  tags: Schema.Array(Schema.String),
  pinned: Schema.optionalWith(Schema.Boolean, { default: () => false }),
}) {}

/** Morph card instance on a day's canvas */
export class DayCard extends Schema.TaggedClass<DayCard>()('DayCard', {
  id: Schema.String,
  cardId: Schema.String,
  title: Schema.String,
  content: Schema.String,
  position: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
  createdAt: Schema.DateFromSelf,
}) {}

/** Checkable task within a day */
export class DayTask extends Schema.TaggedClass<DayTask>()('DayTask', {
  id: Schema.String,
  title: Schema.String,
  completed: Schema.Boolean,
  priority: EventPriority,
  dueTime: Schema.optionalWith(Schema.String, { as: 'Option' }),
  piTaskId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  createdAt: Schema.DateFromSelf,
}) {}

/** Relationship type between two entities (Melanie's domain) */
export const LinkRelationship = Schema.Literal(
  'references', 'continues', 'contradicts', 'supports', 'inspired-by',
)
export type LinkRelationship = typeof LinkRelationship.Type

/** Entity type that can participate in a knowledge link */
export const LinkableEntity = Schema.Literal(
  'note', 'card', 'task', 'event', 'day',
)
export type LinkableEntity = typeof LinkableEntity.Type

/** Who discovered the link */
export const LinkDiscoverer = Schema.Literal('user', 'melanie')
export type LinkDiscoverer = typeof LinkDiscoverer.Type

/** Knowledge link between two entities across the day graph */
export class KnowledgeLink extends Schema.TaggedClass<KnowledgeLink>()('KnowledgeLink', {
  id: Schema.String,
  sourceId: Schema.String,
  sourceType: LinkableEntity,
  targetId: Schema.String,
  targetType: LinkableEntity,
  relationship: LinkRelationship,
  confidence: Schema.Number,
  discoveredBy: LinkDiscoverer,
  createdAt: Schema.DateFromSelf,
}) {}

/** Energy / focus / sentiment levels */
export const EnergyLevel = Schema.Literal('high', 'medium', 'low')
export type EnergyLevel = typeof EnergyLevel.Type

export const Sentiment = Schema.Literal('positive', 'neutral', 'negative')
export type Sentiment = typeof Sentiment.Type

/** Daily mood / status snapshot */
export class DayMood extends Schema.TaggedClass<DayMood>()('DayMood', {
  energy: EnergyLevel,
  focus: EnergyLevel,
  sentiment: Sentiment,
  tags: Schema.Array(Schema.String),
  note: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

/** Media type */
export const MediaType = Schema.Literal(
  'image', 'file', 'screenshot', 'audio', 'video',
)
export type MediaType = typeof MediaType.Type

/** Media attachment stored in object store */
export class MediaAttachment extends Schema.TaggedClass<MediaAttachment>()('MediaAttachment', {
  id: Schema.String,
  type: MediaType,
  url: Schema.String,
  filename: Schema.String,
  mimeType: Schema.String,
  size: Schema.Number,
  createdAt: Schema.DateFromSelf,
}) {}

// ─── Day Entity ─────────────────────────────────────────────────────────────
// The rich Day abstraction — everything that happened / is attached to a date.

export class Day extends Schema.TaggedClass<Day>()('Day', {
  dateKey: DateKey,
  notes: Schema.Array(DayNote),
  cards: Schema.Array(DayCard),
  events: Schema.Array(CalendarEvent),
  tasks: Schema.Array(DayTask),
  links: Schema.Array(KnowledgeLink),
  mood: Schema.optionalWith(DayMood, { as: 'Option' }),
  media: Schema.Array(MediaAttachment),
  documentId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf,
}) {
  get isEmpty() {
    return (
      this.notes.length === 0 &&
      this.cards.length === 0 &&
      this.events.length === 0 &&
      this.tasks.length === 0 &&
      this.links.length === 0 &&
      this.media.length === 0
    )
  }

  get taskCompletion() {
    if (this.tasks.length === 0) return null
    const done = this.tasks.filter((t) => t.completed).length
    return { done, total: this.tasks.length, ratio: done / this.tasks.length }
  }

  get eventCount() {
    return this.events.length
  }

  get linkCount() {
    return this.links.length
  }
}

// ─── Day Summary (lightweight, for month grid rendering) ────────────────────

export class DaySummary extends Schema.TaggedClass<DaySummary>()('DaySummary', {
  dateKey: DateKey,
  eventCount: Schema.Number,
  taskCount: Schema.Number,
  tasksDone: Schema.Number,
  noteCount: Schema.Number,
  linkCount: Schema.Number,
  hasMood: Schema.Boolean,
  hasMedia: Schema.Boolean,
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
