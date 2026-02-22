/**
 * Chronicle Day Entity — Effect Schema Definitions
 *
 * Rich aggregate entity for a calendar day. A Day holds notes, morph cards,
 * tasks, knowledge links, mood/status, media attachments, and calendar events.
 *
 * Follows the IIoT Alarm schema pattern: TaggedClass entities with methods,
 * Literal enums, branded identifiers, and a lightweight summary projection.
 *
 * @module @chronicle/schemas/day
 * @see src/lib/iiot/schemas/alarms.ts — canonical pattern
 */

import { Schema } from 'effect'
import { DayId, NoteId, CardId, DayTaskId, LinkId, AttachmentId } from './identifiers'

// =============================================================================
// Day Lifecycle State (Machine-driven)
// =============================================================================

/**
 * Day lifecycle states.
 *
 * - empty: No content — default for any date
 * - active: User has interacted, content being added
 * - rich: Multiple content types present (notes + tasks, etc.)
 * - archived: Day is in the past and locked from edits
 */
export const DayLifecycleState = Schema.Literal(
  'empty',
  'active',
  'rich',
  'archived',
).pipe(
  Schema.brand('@chronicle/Day/fields/DayLifecycleState'),
  Schema.annotations({
    identifier: '@chronicle/DayLifecycleState',
    description: 'Chronicle day lifecycle state',
  }),
)
export type DayLifecycleState = typeof DayLifecycleState.Type

// =============================================================================
// Calendar Source & Priority (shared with CalendarEvent)
// =============================================================================

export const CalendarSource = Schema.Literal(
  'local', 'google', 'caldav', 'ical', 'tmnl',
)
export type CalendarSource = typeof CalendarSource.Type

export const EventPriority = Schema.Literal('low', 'normal', 'high', 'urgent')
export type EventPriority = typeof EventPriority.Type

// =============================================================================
// Calendar Event
// =============================================================================

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

// =============================================================================
// Day Sub-Entities
// =============================================================================

/** Freeform note attached to a day (markdown content) */
export class DayNote extends Schema.TaggedClass<DayNote>()('DayNote', {
  id: NoteId,
  content: Schema.String,
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf,
  tags: Schema.Array(Schema.String),
  pinned: Schema.optionalWith(Schema.Boolean, { default: () => false }),
}) {}

/** Morph card instance on a day's canvas */
export class DayCard extends Schema.TaggedClass<DayCard>()('DayCard', {
  id: CardId,
  cardId: Schema.String,
  title: Schema.String,
  content: Schema.String,
  position: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
  createdAt: Schema.DateFromSelf,
}) {}

/** Checkable task within a day */
export class DayTask extends Schema.TaggedClass<DayTask>()('DayTask', {
  id: DayTaskId,
  title: Schema.String,
  completed: Schema.Boolean,
  priority: EventPriority,
  dueTime: Schema.optionalWith(Schema.String, { as: 'Option' }),
  piTaskId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  createdAt: Schema.DateFromSelf,
}) {}

// =============================================================================
// Knowledge Link System (Melanie's Domain)
// =============================================================================

export const LinkRelationship = Schema.Literal(
  'references', 'continues', 'contradicts', 'supports', 'inspired-by',
)
export type LinkRelationship = typeof LinkRelationship.Type

export const LinkableEntity = Schema.Literal(
  'note', 'card', 'task', 'event', 'day',
)
export type LinkableEntity = typeof LinkableEntity.Type

export const LinkDiscoverer = Schema.Literal('user', 'melanie')
export type LinkDiscoverer = typeof LinkDiscoverer.Type

/** Knowledge link between two entities across the day graph */
export class KnowledgeLink extends Schema.TaggedClass<KnowledgeLink>()('KnowledgeLink', {
  id: LinkId,
  sourceId: Schema.String,
  sourceType: LinkableEntity,
  targetId: Schema.String,
  targetType: LinkableEntity,
  relationship: LinkRelationship,
  confidence: Schema.Number,
  discoveredBy: LinkDiscoverer,
  createdAt: Schema.DateFromSelf,
}) {}

// =============================================================================
// Mood / Status
// =============================================================================

export const EnergyLevel = Schema.Literal('high', 'medium', 'low')
export type EnergyLevel = typeof EnergyLevel.Type

export const Sentiment = Schema.Literal('positive', 'neutral', 'negative')
export type Sentiment = typeof Sentiment.Type

export class DayMood extends Schema.TaggedClass<DayMood>()('DayMood', {
  energy: EnergyLevel,
  focus: EnergyLevel,
  sentiment: Sentiment,
  tags: Schema.Array(Schema.String),
  note: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

// =============================================================================
// Media Attachments
// =============================================================================

export const MediaType = Schema.Literal(
  'image', 'file', 'screenshot', 'audio', 'video',
)
export type MediaType = typeof MediaType.Type

export class MediaAttachment extends Schema.TaggedClass<MediaAttachment>()('MediaAttachment', {
  id: AttachmentId,
  type: MediaType,
  url: Schema.String,
  filename: Schema.String,
  mimeType: Schema.String,
  size: Schema.Number,
  createdAt: Schema.DateFromSelf,
}) {}

// =============================================================================
// Day Aggregate Entity
// =============================================================================

/**
 * Day — the rich aggregate. Everything that happened or is attached to a date.
 *
 * @example
 * ```ts
 * const day = new Day({
 *   dateKey: '2026-01-15' as DayId,
 *   lifecycleState: 'active' as DayLifecycleState,
 *   notes: [note1],
 *   // ...
 * })
 * console.log(day.isEmpty)          // false
 * console.log(day.contentTypeCount) // 1
 * ```
 */
export class Day extends Schema.TaggedClass<Day>()('Day', {
  dateKey: DayId,
  lifecycleState: DayLifecycleState,
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
  /** Check if day has zero content */
  get isEmpty(): boolean {
    return (
      this.notes.length === 0 &&
      this.cards.length === 0 &&
      this.events.length === 0 &&
      this.tasks.length === 0 &&
      this.links.length === 0 &&
      this.media.length === 0
    )
  }

  /** Count of distinct content types present (for empty→active→rich transitions) */
  get contentTypeCount(): number {
    let count = 0
    if (this.notes.length > 0) count++
    if (this.cards.length > 0) count++
    if (this.events.length > 0) count++
    if (this.tasks.length > 0) count++
    if (this.links.length > 0) count++
    if (this.media.length > 0) count++
    return count
  }

  /** Task completion stats (null if no tasks) */
  get taskCompletion(): { done: number; total: number; ratio: number } | null {
    if (this.tasks.length === 0) return null
    const done = this.tasks.filter((t) => t.completed).length
    return { done, total: this.tasks.length, ratio: done / this.tasks.length }
  }

  get eventCount(): number {
    return this.events.length
  }

  get linkCount(): number {
    return this.links.length
  }

  /** Check if this day can accept new content (not archived) */
  get isEditable(): boolean {
    return this.lifecycleState !== 'archived'
  }

  /** Compute what the lifecycle state SHOULD be based on content */
  get computedLifecycleState(): 'empty' | 'active' | 'rich' {
    if (this.isEmpty) return 'empty'
    return this.contentTypeCount >= 2 ? 'rich' : 'active'
  }
}

// =============================================================================
// Day Summary (Lightweight Projection for Month Grid)
// =============================================================================

export class DaySummary extends Schema.TaggedClass<DaySummary>()('DaySummary', {
  dateKey: DayId,
  lifecycleState: DayLifecycleState,
  eventCount: Schema.Number,
  taskCount: Schema.Number,
  tasksDone: Schema.Number,
  noteCount: Schema.Number,
  linkCount: Schema.Number,
  hasMood: Schema.Boolean,
  hasMedia: Schema.Boolean,
}) {}
