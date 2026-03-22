/**
 * Effectual XML Parser — wraps fast-xml-parser with tagged errors.
 *
 * Provides a pure Effect boundary around XMLParser:
 *   - Effect.try for synchronous parse (fast-xml-parser is sync)
 *   - Tagged XmlParseError for the error channel
 *   - RSS/Atom-specific parser with isArray for consistent item arrays
 *   - Schema decode for parsed RSS items
 *
 * @module tsingou-flow/adapters/xml
 */

import { Effect, Data, Schema } from 'effect'
import { XMLParser } from 'fast-xml-parser'

// =============================================================================
// Tagged Errors
// =============================================================================

export class XmlParseError extends Data.TaggedError('XmlParseError')<{
  readonly message: string
  readonly xmlSnippet?: string
  readonly cause?: unknown
}> {}

export class XmlValidationError extends Data.TaggedError('XmlValidationError')<{
  readonly message: string
  readonly line?: number
  readonly cause?: unknown
}> {}

// =============================================================================
// RSS Item Schema
// =============================================================================

export const RssItemSchema = Schema.Struct({
  title: Schema.optional(Schema.String),
  link: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  pubDate: Schema.optional(Schema.String),
  guid: Schema.optional(Schema.Union(
    Schema.String,
    Schema.Struct({ '#text': Schema.String }),
  )),
  author: Schema.optional(Schema.String),
  category: Schema.optional(Schema.Union(
    Schema.String,
    Schema.Array(Schema.String),
  )),
  enclosure: Schema.optional(Schema.Unknown),
  'dc:creator': Schema.optional(Schema.String),
  'content:encoded': Schema.optional(Schema.String),
})
export type RssItem = typeof RssItemSchema.Type

export const AtomEntrySchema = Schema.Struct({
  title: Schema.optional(Schema.Union(
    Schema.String,
    Schema.Struct({ '#text': Schema.String }),
  )),
  link: Schema.optional(Schema.Union(
    Schema.String,
    Schema.Struct({ '@_href': Schema.String }),
    Schema.Array(Schema.Union(
      Schema.String,
      Schema.Struct({ '@_href': Schema.String }),
    )),
  )),
  summary: Schema.optional(Schema.String),
  content: Schema.optional(Schema.Unknown),
  updated: Schema.optional(Schema.String),
  published: Schema.optional(Schema.String),
  id: Schema.optional(Schema.String),
  author: Schema.optional(Schema.Unknown),
})
export type AtomEntry = typeof AtomEntrySchema.Type

// =============================================================================
// Parser Configuration
// =============================================================================

/**
 * RSS/Atom-tuned XMLParser.
 *
 * Key: isArray callback ensures `item` and `entry` are ALWAYS arrays,
 * even if the feed has a single item. This prevents the fast-xml-parser
 * single-child-as-object gotcha.
 */
const RSS_ALWAYS_ARRAY = [
  'rss.channel.item',
  'feed.entry',
  'rss.channel.category',
  'feed.entry.link',
  'feed.entry.category',
]

const rssParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  parseTagValue: true,
  isArray: (_name, jPath, _isLeafNode, _isAttribute) =>
    RSS_ALWAYS_ARRAY.includes(jPath),
})

const genericParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
})

// =============================================================================
// Effectual Parse Functions
// =============================================================================

/**
 * Parse arbitrary XML → JS object.
 *
 * Synchronous under the hood (fast-xml-parser is sync),
 * wrapped in Effect.try for tagged error boundary.
 */
export const parseXml = (
  xml: string,
): Effect.Effect<unknown, XmlParseError> =>
  Effect.try({
    try: () => genericParser.parse(xml),
    catch: (err) =>
      new XmlParseError({
        message: `XML parse failed: ${err}`,
        xmlSnippet: xml.slice(0, 200),
        cause: err,
      }),
  })

/**
 * Parse RSS/Atom XML → normalized feed items.
 *
 * Detects RSS 2.0 vs Atom format, extracts items/entries,
 * normalizes to a common shape. Uses isArray for consistent
 * array treatment of items.
 */
export const parseRssFeed = (
  xml: string,
): Effect.Effect<{
  readonly format: 'rss' | 'atom'
  readonly title: string
  readonly items: ReadonlyArray<RssItem | AtomEntry>
}, XmlParseError> =>
  Effect.try({
    try: () => {
      const parsed = rssParser.parse(xml) as Record<string, any>

      // RSS 2.0: rss > channel > item[]
      if (parsed.rss?.channel) {
        const channel = parsed.rss.channel
        return {
          format: 'rss' as const,
          title: channel.title ?? '',
          items: (channel.item ?? []) as ReadonlyArray<RssItem>,
        }
      }

      // Atom: feed > entry[]
      if (parsed.feed) {
        const feed = parsed.feed
        return {
          format: 'atom' as const,
          title: typeof feed.title === 'string'
            ? feed.title
            : feed.title?.['#text'] ?? '',
          items: (feed.entry ?? []) as ReadonlyArray<AtomEntry>,
        }
      }

      throw new Error('Unrecognized feed format: neither RSS 2.0 nor Atom')
    },
    catch: (err) =>
      new XmlParseError({
        message: `RSS/Atom parse failed: ${err}`,
        xmlSnippet: xml.slice(0, 200),
        cause: err,
      }),
  })

/**
 * Extract a stable identifier from an RSS item or Atom entry.
 *
 * Priority: guid → id → link → title hash
 */
export const extractItemId = (item: RssItem | AtomEntry): string => {
  // RSS guid
  const rssItem = item as RssItem
  if (rssItem.guid) {
    return typeof rssItem.guid === 'string'
      ? rssItem.guid
      : (rssItem.guid as any)['#text'] ?? ''
  }

  // Atom id
  const atomEntry = item as AtomEntry
  if (atomEntry.id) return atomEntry.id

  // Fallback: link
  if (typeof item.link === 'string') return item.link
  if (item.link && typeof item.link === 'object' && '@_href' in (item.link as any)) {
    return (item.link as any)['@_href']
  }

  // Last resort: title hash
  const title = typeof item.title === 'string'
    ? item.title
    : (item.title as any)?.['#text'] ?? ''
  let h = 0
  for (let i = 0; i < title.length; i++) {
    h = ((h << 5) - h + title.charCodeAt(i)) | 0
  }
  return `hash:${h}`
}
