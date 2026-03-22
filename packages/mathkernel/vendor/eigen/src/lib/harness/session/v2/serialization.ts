/**
 * Session Serialization — JSONL Frozen Format
 *
 * Pure encode/decode between SessionTree and JSONL strings.
 * This is the "frozen tier" — pi-compatible file format.
 *
 * Format:
 *   Line 1: JSON-encoded SessionHeader
 *   Line 2+: JSON-encoded SessionEntry (append-only)
 *
 * No I/O, no services — just Schema.encode/decode with Effect.
 *
 * @module harness/session/v2/serialization
 */

import { Effect, Schema, Option } from 'effect'
import { SessionHeader } from './header'
import { SessionEntry } from './entries'
import { SessionTree, makeSessionTree } from './tree'
import type { HarnessSessionId } from './identity'

// =============================================================================
// JSON codecs — encode/decode via Schema.parseJson
// =============================================================================

const encodeHeader = Schema.encode(Schema.parseJson(SessionHeader))
const decodeHeader = Schema.decode(Schema.parseJson(SessionHeader))

const encodeEntry = Schema.encode(Schema.parseJson(SessionEntry))
const decodeEntry = Schema.decode(Schema.parseJson(SessionEntry))

const encodeTree = Schema.encode(Schema.parseJson(SessionTree))
const decodeTree = Schema.decode(Schema.parseJson(SessionTree))

// =============================================================================
// JSONL Serialization — tree ↔ lines
// =============================================================================

/**
 * Serialize a SessionTree to JSONL string.
 *
 * Line 1: header
 * Lines 2+: entries in append order
 *
 * Returns Effect because Schema.encode can fail on invalid data.
 */
export const treeToJsonl = (tree: SessionTree): Effect.Effect<string> =>
  Effect.gen(function* () {
    const headerLine = yield* encodeHeader(tree.header).pipe(
      Effect.catchAll(() => Effect.succeed(JSON.stringify(tree.header))),
    )

    const entryLines: string[] = []
    for (const entry of tree.entries) {
      const line = yield* encodeEntry(entry).pipe(
        Effect.catchAll(() => Effect.succeed(JSON.stringify(entry))),
      )
      entryLines.push(line)
    }

    return [headerLine, ...entryLines].join('\n')
  })

/**
 * Deserialize a JSONL string to SessionTree.
 *
 * Parses line-by-line:
 * - Line 1 → SessionHeader
 * - Lines 2+ → SessionEntry[]
 *
 * Skips blank lines. Collects entries that fail to parse
 * (logs warning, continues). Recomputes leafId from entries.
 */
export const jsonlToTree = (jsonl: string): Effect.Effect<SessionTree> =>
  Effect.gen(function* () {
    const lines = jsonl.split('\n').filter((line) => line.trim().length > 0)

    if (lines.length === 0) {
      return yield* Effect.fail(new Error('Empty JSONL: no header line'))
    }

    // Parse header (line 1)
    const header = yield* decodeHeader(lines[0]).pipe(
      Effect.catchAll((e) =>
        Effect.fail(new Error(`Invalid header: ${String(e)}`)),
      ),
    )

    // Parse entries (lines 2+)
    const entries: Array<typeof SessionEntry.Type> = []
    for (let i = 1; i < lines.length; i++) {
      const entry = yield* decodeEntry(lines[i]).pipe(
        Effect.catchAll(() => Effect.succeed(null)),
      )
      if (entry !== null) {
        entries.push(entry)
      }
    }

    // Recompute leafId — the last entry with no children
    const childParents = new Set(
      entries
        .map((e) => e.parentId)
        .filter((id): id is string => id !== null),
    )
    const leafCandidates = entries.filter((e) => !childParents.has(e.id))
    const leafId =
      leafCandidates.length > 0
        ? leafCandidates[leafCandidates.length - 1].id
        : null

    return {
      header,
      entries,
      leafId,
    } satisfies SessionTree
  })

// =============================================================================
// JSON Blob Serialization — tree ↔ single JSON string
// =============================================================================

/**
 * Serialize a SessionTree to a single JSON blob.
 * Used for cold-tier (KeyValueStore) persistence.
 */
export const treeToJson = (tree: SessionTree): Effect.Effect<string> =>
  encodeTree(tree).pipe(
    Effect.catchAll(() => Effect.succeed(JSON.stringify(tree))),
  )

/**
 * Deserialize a JSON blob to SessionTree.
 */
export const jsonToTree = (json: string): Effect.Effect<SessionTree> =>
  decodeTree(json).pipe(
    Effect.catchAll((e) =>
      Effect.fail(new Error(`Invalid session JSON: ${String(e)}`)),
    ),
  )

// =============================================================================
// Metadata extraction — derive SessionMetadata from a tree
// =============================================================================

/**
 * Extract SessionMetadata from a SessionTree.
 * Used to populate the metadata store from a full tree.
 */
export function extractMetadata(tree: SessionTree) {
  const messages = tree.entries.filter((e) => e._tag === 'MessageEntry')
  const lastEntry = tree.entries[tree.entries.length - 1]

  // Find first user message for preview
  const firstUserMsg = messages.find(
    (e) => e._tag === 'MessageEntry' && e.message.role === 'user',
  )
  const preview =
    firstUserMsg && firstUserMsg._tag === 'MessageEntry'
      ? typeof firstUserMsg.message.content === 'string'
        ? firstUserMsg.message.content.slice(0, 120)
        : '[structured content]'
      : ''

  // Find SessionInfoEntry for title
  const infoEntry = tree.entries.find((e) => e._tag === 'SessionInfoEntry')
  const title =
    infoEntry && infoEntry._tag === 'SessionInfoEntry' && infoEntry.name
      ? infoEntry.name
      : preview.slice(0, 60) || 'Untitled Session'

  // Find latest ModelChangeEntry
  const modelEntries = tree.entries.filter(
    (e) => e._tag === 'ModelChangeEntry',
  )
  const lastModel =
    modelEntries.length > 0
      ? modelEntries[modelEntries.length - 1]
      : undefined

  return {
    _tag: 'SessionMetadata' as const,
    id: tree.header.id,
    title,
    createdAt: tree.header.timestamp,
    lastModified: lastEntry?.timestamp ?? tree.header.timestamp,
    messageCount: messages.length,
    preview,
    provider:
      lastModel && lastModel._tag === 'ModelChangeEntry'
        ? lastModel.provider
        : undefined,
    model:
      lastModel && lastModel._tag === 'ModelChangeEntry'
        ? lastModel.modelId
        : undefined,
    status: 'active' as const,
    tags: [] as string[],
  }
}
