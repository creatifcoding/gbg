/**
 * Melanie — Service Types & Schemas
 *
 * Effect Schema types for the knowledge agent's domain:
 * insights, connections, search results, digests.
 *
 * MELANIE: Multifunctional Electronic Librarian
 *          And Navigational Information Engine
 */

import { Schema } from 'effect'

// ─── Insight Types ──────────────────────────────────────────────────────────

export const InsightKind = Schema.Literal(
  'connection',    // Found a link between entities
  'pattern',       // Recurring theme detected
  'suggestion',    // Proactive recommendation
  'summary',       // Digest or brief
  'anomaly',       // Something unusual
)
export type InsightKind = typeof InsightKind.Type

export const InsightPriority = Schema.Literal('low', 'medium', 'high')
export type InsightPriority = typeof InsightPriority.Type

/** A single insight surfaced by Melanie */
export class Insight extends Schema.TaggedClass<Insight>()('Insight', {
  id: Schema.String,
  kind: InsightKind,
  priority: InsightPriority,
  title: Schema.String,
  body: Schema.String,
  /** Entity IDs this insight references */
  entityIds: Schema.Array(Schema.String),
  /** Confidence score (0.0–1.0) */
  confidence: Schema.Number,
  /** Whether the user has seen/dismissed this */
  acknowledged: Schema.Boolean,
  createdAt: Schema.DateFromSelf,
}) {}

// ─── Search ─────────────────────────────────────────────────────────────────

export const SearchableEntity = Schema.Literal(
  'note', 'card', 'task', 'event', 'day', 'media',
)
export type SearchableEntity = typeof SearchableEntity.Type

/** A single search result with context snippet */
export class SearchResult extends Schema.TaggedClass<SearchResult>()('SearchResult', {
  entityId: Schema.String,
  entityType: SearchableEntity,
  dateKey: Schema.String,
  title: Schema.String,
  /** Context snippet with match highlighted */
  snippet: Schema.String,
  /** Relevance score (0.0–1.0) */
  score: Schema.Number,
}) {}

/** Search query */
export class SearchQuery extends Schema.TaggedClass<SearchQuery>()('SearchQuery', {
  query: Schema.String,
  /** Limit results to specific entity types */
  entityTypes: Schema.optionalWith(Schema.Array(SearchableEntity), { as: 'Option' }),
  /** Limit results to a date range */
  dateFrom: Schema.optionalWith(Schema.String, { as: 'Option' }),
  dateTo: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Max results */
  limit: Schema.optionalWith(Schema.Number, { default: () => 20 }),
}) {}

// ─── Connection Discovery ───────────────────────────────────────────────────

/** A discovered connection between two entities (before it becomes a KnowledgeLink) */
export class ConnectionCandidate extends Schema.TaggedClass<ConnectionCandidate>()('ConnectionCandidate', {
  sourceId: Schema.String,
  sourceType: SearchableEntity,
  targetId: Schema.String,
  targetType: SearchableEntity,
  /** Why Melanie thinks they're connected */
  reason: Schema.String,
  /** Confidence score */
  confidence: Schema.Number,
  /** Suggested relationship type */
  suggestedRelationship: Schema.Literal(
    'references', 'continues', 'contradicts', 'supports', 'inspired-by',
  ),
}) {}

// ─── Digests ────────────────────────────────────────────────────────────────

/** Daily digest — morning summary */
export class DailyDigest extends Schema.TaggedClass<DailyDigest>()('DailyDigest', {
  dateKey: Schema.String,
  /** Summary of yesterday */
  yesterdaySummary: Schema.String,
  /** What's planned today */
  todayOutlook: Schema.String,
  /** Unfinished tasks carried over */
  carryoverTasks: Schema.Array(Schema.String),
  /** Number of open connections to review */
  pendingConnections: Schema.Number,
  /** Insights generated overnight */
  insights: Schema.Array(Insight),
  generatedAt: Schema.DateFromSelf,
}) {}

/** Weekly review */
export class WeeklyReview extends Schema.TaggedClass<WeeklyReview>()('WeeklyReview', {
  weekNumber: Schema.Number,
  year: Schema.Number,
  /** High-level themes from the week */
  themes: Schema.Array(Schema.String),
  /** Key accomplishments */
  accomplishments: Schema.Array(Schema.String),
  /** Recurring patterns detected */
  patterns: Schema.Array(Schema.String),
  /** Task completion stats */
  taskStats: Schema.Struct({
    created: Schema.Number,
    completed: Schema.Number,
    carryover: Schema.Number,
  }),
  /** Most connected entities this week */
  topConnected: Schema.Array(Schema.Struct({
    entityId: Schema.String,
    entityType: SearchableEntity,
    linkCount: Schema.Number,
  })),
  generatedAt: Schema.DateFromSelf,
}) {}

// ─── Melanie Status ─────────────────────────────────────────────────────────

export const MelanieStatus = Schema.Literal(
  'idle',          // Waiting for input
  'indexing',      // Processing new content
  'searching',     // Running a search query
  'discovering',   // Finding connections
  'summarizing',   // Generating a digest
  'offline',       // Not available
)
export type MelanieStatus = typeof MelanieStatus.Type

/** Melanie's runtime state for the UI status bar */
export class MelanieState extends Schema.TaggedClass<MelanieState>()('MelanieState', {
  status: MelanieStatus,
  /** What she's currently doing (shown in status bar) */
  statusMessage: Schema.String,
  /** Total connections discovered */
  totalConnections: Schema.Number,
  /** Pending insights not yet acknowledged */
  pendingInsights: Schema.Number,
  /** Indexed entity count */
  indexedEntities: Schema.Number,
}) {
  static initial(): MelanieState {
    return new MelanieState({
      status: 'idle' as const,
      statusMessage: 'MELANIE ONLINE — standing by',
      totalConnections: 0,
      pendingInsights: 0,
      indexedEntities: 0,
    })
  }
}
