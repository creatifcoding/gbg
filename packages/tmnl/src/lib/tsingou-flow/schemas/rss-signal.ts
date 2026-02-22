/**
 * RSS/Atom Feed Signal Schema
 *
 * Source: RSS/Atom feed poller (configurable interval)
 * Covers: News articles, blog posts, podcast episodes — basic OSINT primitive
 *
 * @module tsingou-flow/schemas/rss-signal
 */

import { Schema } from 'effect'
import { BaseSignal } from './base-signal'

// =============================================================================
// RSS Payload
// =============================================================================

export const RssPayload = Schema.Struct({
  /** Feed URL being polled */
  feedUrl: Schema.String,

  /** Feed title */
  feedTitle: Schema.optional(Schema.String),

  /** Unique item identifier (GUID or link) for deduplication */
  itemGuid: Schema.String,

  /** Item title */
  title: Schema.String,

  /** Item link/URL */
  link: Schema.optional(Schema.String),

  /** Publication date */
  pubDate: Schema.optional(Schema.DateFromSelf),

  /** Full text or summary content */
  content: Schema.optional(Schema.String),

  /** Item description (shorter than content) */
  description: Schema.optional(Schema.String),

  /** Author/creator */
  author: Schema.optional(Schema.String),

  /** Categories/tags */
  categories: Schema.optional(Schema.Array(Schema.String)),

  /** Enclosure URL (for podcasts, media) */
  enclosureUrl: Schema.optional(Schema.String),
  enclosureType: Schema.optional(Schema.String),
  enclosureLength: Schema.optional(Schema.Number),
})
export type RssPayload = typeof RssPayload.Type

// =============================================================================
// RssSignal
// =============================================================================

export const RssSignal = Schema.extend(
  BaseSignal,
  Schema.Struct({
    kind: Schema.Literal('rss'),
    payload: RssPayload,
  }),
)
export type RssSignal = typeof RssSignal.Type
