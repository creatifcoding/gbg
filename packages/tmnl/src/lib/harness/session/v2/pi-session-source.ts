/**
 * Server-only PiSessionSource.
 *
 * Wraps pi CLI JSONL sessions and exposes them to the harness as:
 *   1. fast, lightweight list descriptors (bounded file reads)
 *   2. synthetic HarnessSnapshot replay events for MorphChat rendering
 *
 * Do not import this module from browser bundles. Export from index.server.ts.
 */

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { open as openFile, mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { Cache, Context, Duration, Effect, Either, Layer, Option, Schema } from 'effect'
import { getAgentDir, SessionManager } from '@mariozechner/pi-coding-agent'

import {
  HarnessAssistantFinalEvent,
  HarnessAssistantStartEvent,
  HarnessClientMessageId,
  HarnessMessageId,
  HarnessSessionId,
  HarnessSessionOpenedEvent,
  HarnessSnapshot,
  HarnessToolEvent,
  HarnessUserMessageEvent,
  type HarnessEvent,
} from '../../schemas'
import {
  PiSessionListOptions,
  PiSessionListPayload,
  PiSessionMetadataCacheFile,
  type PiSessionListDiagnostics,
  type PiSessionListItem,
  type PiSessionListScope,
  type PiSessionMetadataCacheEntry,
  type PiSessionPreviewOptions,
} from './pi-session-schemas'

const FAST_LIST_BYTES = 256 * 1024
const DEFAULT_LIMIT = 200
const DEFAULT_PREVIEW_TAIL_BYTES = 512 * 1024
const DEFAULT_PREVIEW_MAX_ENTRIES = 16
const DEFAULT_PREVIEW_TEXT_CHARS = 600
const PREVIEW_SEQ_BASE = 1_000_000_000
const CACHE_SCHEMA_VERSION = 1
const DEFAULT_CACHE_PATH = () => join(homedir(), '.tmnl', 'pi-session-metadata-cache.v1.json')

type JsonRecord = Record<string, unknown>

type PiSessionSourceOptions = typeof PiSessionListOptions.Type

type RankedDir = {
  readonly dir: string
  readonly rank: number
}

type FileStats = Awaited<ReturnType<typeof stat>>

type CacheReadResult = {
  readonly entries: Map<string, PiSessionMetadataCacheEntry>
  readonly path: string
  readonly readMs: number
  readonly corrupt: boolean
}

type CacheWriteResult = {
  readonly writeMs: number
  readonly entriesWritten: number
}

type MetadataCacheKey = string

type MetadataCacheLookup = {
  readonly path: string
  readonly size: number
  readonly mtimeMs: number
  readonly birthtimeMs: number
}

type MetadataCacheLookupResult =
  | { readonly _tag: 'WarmStartHit'; readonly entry: PiSessionMetadataCacheEntry }
  | { readonly _tag: 'Parsed'; readonly entry: PiSessionMetadataCacheEntry }
  | { readonly _tag: 'InvalidSession'; readonly path: string; readonly reason: string }
  | { readonly _tag: 'LookupError'; readonly path: string; readonly error: string }

type MetadataEffectCache = Cache.Cache<MetadataCacheKey, MetadataCacheLookupResult, never>

let metadataEffectCache: MetadataEffectCache | null = null
let metadataWarmEntriesByKey = new Map<MetadataCacheKey, PiSessionMetadataCacheEntry>()

const metadataCacheKey = (path: string, stats: FileStats): MetadataCacheKey =>
  JSON.stringify({ path, size: stats.size, mtimeMs: stats.mtimeMs, birthtimeMs: stats.birthtimeMs })

const parseMetadataCacheKey = (key: MetadataCacheKey): MetadataCacheLookup => JSON.parse(key) as MetadataCacheLookup

const minimalStats = (lookup: MetadataCacheLookup): FileStats => ({
  size: lookup.size,
  mtimeMs: lookup.mtimeMs,
  birthtimeMs: lookup.birthtimeMs,
} as FileStats)

const describeUnknown = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const makeMetadataEffectCache = Effect.fn('tmnl.harness.pi-session-source.metadata-cache.make')(function* () {
  if (metadataEffectCache) return metadataEffectCache

  metadataEffectCache = yield* Cache.make({
    capacity: 10_000,
    timeToLive: Duration.infinity,
    lookup: (key: MetadataCacheKey) =>
      Effect.promise(async (): Promise<MetadataCacheLookupResult> => {
        try {
          const lookup = parseMetadataCacheKey(key)
          const warmed = metadataWarmEntriesByKey.get(key)
          const stats = minimalStats(lookup)

          if (isCacheHit(warmed, lookup.path, stats)) {
            return { _tag: 'WarmStartHit', entry: warmed }
          }

          const item = await buildFastListItemFromStats(lookup.path, stats, '', 0)
          if (!item) {
            return {
              _tag: 'InvalidSession',
              path: lookup.path,
              reason: 'missing-or-invalid-session-header',
            }
          }

          return {
            _tag: 'Parsed',
            entry: {
              _tag: 'PiSessionMetadataCacheEntry' as const,
              path: lookup.path,
              size: lookup.size,
              mtimeMs: lookup.mtimeMs,
              item: withRequestRank(item, '', 0),
            },
          }
        } catch (error) {
          return {
            _tag: 'LookupError',
            path: (() => {
              try {
                return parseMetadataCacheKey(key).path
              } catch {
                return '<invalid-cache-key>'
              }
            })(),
            error: describeUnknown(error),
          }
        }
      }),
  })

  return metadataEffectCache
})

const resetMetadataEffectCache = (): void => {
  metadataEffectCache = null
  metadataWarmEntriesByKey = new Map()
}

export class PiSessionSourceError extends Schema.TaggedError<PiSessionSourceError>()(
  'PiSessionSourceError',
  {
    code: Schema.String,
    message: Schema.String,
    cause: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
  },
) {}

export interface PiSessionSourceShape {
  readonly list: (
    options?: PiSessionSourceOptions,
  ) => Effect.Effect<PiSessionListPayload, PiSessionSourceError>
  readonly loadSnapshot: (
    args: { readonly path: string; readonly sessionId?: string },
  ) => Effect.Effect<HarnessSnapshot, PiSessionSourceError>
  readonly loadPreviewSnapshot: (
    args: PiSessionPreviewOptions,
  ) => Effect.Effect<HarnessSnapshot, PiSessionSourceError>
}

export const PiSessionSource = Context.GenericTag<PiSessionSourceShape>('tmnl/harness/PiSessionSource')

const toError = (code: string, message: string) => (cause: unknown) =>
  new PiSessionSourceError({ code, message, cause: Option.some(cause) })

const parseDateMs = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime()
    if (!Number.isNaN(parsed)) return parsed
  }
  return fallback
}

const getDefaultSessionDir = (cwd: string, agentDir = getAgentDir()): string => {
  const safePath = `--${cwd.replace(/^[/\\]/, '').replace(/[/\\:]/g, '-')}--`
  return join(agentDir, 'sessions', safePath)
}

const getSessionsRoot = (): string => join(getAgentDir(), 'sessions')

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null

const textFromContent = (content: unknown): string => {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .map((block) => {
      if (!isRecord(block)) return ''
      if (block.type === 'text' && typeof block.text === 'string') return block.text
      if (block.type === 'thinking' && typeof block.thinking === 'string') return block.thinking
      if (block.type === 'image') return '[image]'
      if (block.type === 'toolCall') return `[tool:${String(block.name ?? 'unknown')}]`
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

const textFromMessage = (message: unknown): string => {
  if (!isRecord(message)) return ''
  return textFromContent(message.content)
}

const roleFromMessage = (message: unknown): string =>
  isRecord(message) && typeof message.role === 'string' ? message.role : 'unknown'

const readFirstChunk = async (path: string, bytes = FAST_LIST_BYTES): Promise<string> => {
  const handle = await openFile(path, 'r')
  try {
    const buffer = Buffer.alloc(bytes)
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0)
    return buffer.toString('utf8', 0, bytesRead)
  } finally {
    await handle.close()
  }
}

const readTailChunk = async (path: string, bytes = DEFAULT_PREVIEW_TAIL_BYTES): Promise<string> => {
  const stats = await stat(path)
  const start = Math.max(0, stats.size - bytes)
  const length = Math.max(0, stats.size - start)
  const handle = await openFile(path, 'r')
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, start)
    const chunk = buffer.toString('utf8', 0, bytesRead)
    if (start === 0) return chunk
    const firstNewline = chunk.indexOf('\n')
    return firstNewline >= 0 ? chunk.slice(firstNewline + 1) : ''
  } finally {
    await handle.close()
  }
}

const parseJsonLines = (content: string): JsonRecord[] => {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const records: JsonRecord[] = []
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as unknown
      if (isRecord(parsed)) records.push(parsed)
    } catch {
      // Bounded reads can end mid-line; skip malformed partials.
    }
  }
  return records
}

const buildFastListItemFromStats = async (
  path: string,
  stats: FileStats,
  requestedCwd: string,
  sourceRank: number,
): Promise<PiSessionListItem | null> => {
  const chunk = await readFirstChunk(path)
  const records = parseJsonLines(chunk)
  const header = records[0]
  if (!header || header.type !== 'session' || typeof header.id !== 'string') {
    return null
  }

  let name: string | undefined
  let firstMessage = ''
  const allMessages: string[] = []
  let messageCount = 0
  let lastActivity = stats.mtimeMs

  for (const record of records.slice(1)) {
    if (record.type === 'session_info') {
      const candidate = typeof record.name === 'string' ? record.name.trim() : ''
      name = candidate || undefined
      continue
    }

    if (record.type !== 'message') continue
    messageCount++
    const message = record.message
    const role = roleFromMessage(message)
    if (role !== 'user' && role !== 'assistant') continue

    const text = textFromMessage(message)
    if (text) {
      allMessages.push(text)
      if (!firstMessage && role === 'user') firstMessage = text
    }

    const timestamp = isRecord(message) ? message.timestamp : undefined
    lastActivity = Math.max(lastActivity, parseDateMs(timestamp, parseDateMs(record.timestamp, stats.mtimeMs)))
  }

  const cwd = typeof header.cwd === 'string' ? header.cwd : ''
  const createdAt = parseDateMs(header.timestamp, stats.birthtimeMs || stats.mtimeMs)
  const updatedAt = Math.max(lastActivity, stats.mtimeMs)
  const title = name ?? (firstMessage.slice(0, 80) || basename(path))

  return {
    _tag: 'PiSessionListItem',
    ref: {
      _tag: 'PiCliSessionRef',
      id: header.id,
      path,
      cwd,
    },
    title,
    name,
    createdAt,
    updatedAt,
    messageCount,
    preview: firstMessage.slice(0, 240),
    allMessagesText: allMessages.join(' ').slice(0, 8_000),
    parentSessionPath: typeof header.parentSession === 'string' ? header.parentSession : undefined,
    localProject: cwd === requestedCwd,
    sourceRank,
  }
}

const buildFastListItem = async (
  path: string,
  requestedCwd: string,
  sourceRank: number,
): Promise<PiSessionListItem | null> =>
  buildFastListItemFromStats(path, await stat(path), requestedCwd, sourceRank)

const listJsonlFiles = async (dir: string): Promise<string[]> => {
  if (!existsSync(dir)) return []
  const entries = await readdir(dir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
    .map((entry) => join(dir, entry.name))
}

const listProjectDirs = async (): Promise<string[]> => {
  const root = getSessionsRoot()
  if (!existsSync(root)) return []
  const entries = await readdir(root, { withFileTypes: true })
  return entries.filter((entry) => entry.isDirectory()).map((entry) => join(root, entry.name))
}

const sortItems = (items: ReadonlyArray<PiSessionListItem>): PiSessionListItem[] =>
  [...items].sort((a, b) => {
    if (a.sourceRank !== b.sourceRank) return a.sourceRank - b.sourceRank
    return b.updatedAt - a.updatedAt
  })

const compactRankedDirs = (candidates: ReadonlyArray<RankedDir>): {
  readonly dirs: ReadonlyArray<RankedDir>
  readonly duplicateDirsSkipped: number
} => {
  const byDir = new Map<string, RankedDir>()
  let duplicateDirsSkipped = 0

  for (const candidate of candidates) {
    const previous = byDir.get(candidate.dir)
    if (!previous) {
      byDir.set(candidate.dir, candidate)
      continue
    }

    duplicateDirsSkipped++
    if (candidate.rank < previous.rank) {
      byDir.set(candidate.dir, candidate)
    }
  }

  return {
    dirs: [...byDir.values()].sort((a, b) => a.rank - b.rank || a.dir.localeCompare(b.dir)),
    duplicateDirsSkipped,
  }
}

const resolveRankedDirs = async (
  cwd: string,
  scope: PiSessionListScope,
  sessionDir?: string,
): Promise<ReturnType<typeof compactRankedDirs>> => {
  if (sessionDir) {
    return compactRankedDirs([{ dir: sessionDir, rank: 0 }])
  }

  if (scope === 'current') {
    return compactRankedDirs([{ dir: getDefaultSessionDir(cwd), rank: 0 }])
  }

  if (scope === 'all') {
    return compactRankedDirs((await listProjectDirs()).map((dir) => ({ dir, rank: 0 })))
  }

  const currentDir = getDefaultSessionDir(cwd)
  return compactRankedDirs([
    { dir: currentDir, rank: 0 },
    ...(await listProjectDirs()).map((dir) => ({ dir, rank: 1 })),
  ])
}

const getCachePath = (): string => process.env.TMNL_PI_SESSION_CACHE_PATH ?? DEFAULT_CACHE_PATH()

const readMetadataCache = async (cachePath = getCachePath()): Promise<CacheReadResult> => {
  const startedAt = performance.now()

  try {
    const content = await readFile(cachePath, 'utf8')
    const decoded = Schema.decodeUnknownEither(PiSessionMetadataCacheFile)(JSON.parse(content))
    if (Either.isLeft(decoded)) {
      return {
        entries: new Map(),
        path: cachePath,
        readMs: performance.now() - startedAt,
        corrupt: true,
      }
    }

    return {
      entries: new Map(decoded.right.entries.map((entry) => [entry.path, entry])),
      path: cachePath,
      readMs: performance.now() - startedAt,
      corrupt: false,
    }
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? (error as { readonly code?: unknown }).code
      : undefined

    return {
      entries: new Map(),
      path: cachePath,
      readMs: performance.now() - startedAt,
      corrupt: code !== 'ENOENT',
    }
  }
}

const writeMetadataCache = async (
  entries: ReadonlyArray<PiSessionMetadataCacheEntry>,
  cachePath = getCachePath(),
): Promise<CacheWriteResult> => {
  const startedAt = performance.now()
  await mkdir(dirname(cachePath), { recursive: true })

  const payload: typeof PiSessionMetadataCacheFile.Type = {
    _tag: 'PiSessionMetadataCacheFile',
    schemaVersion: CACHE_SCHEMA_VERSION,
    generatedAt: Date.now(),
    entries,
  }

  const tmpPath = `${cachePath}.tmp-${process.pid}-${Date.now()}`
  await writeFile(tmpPath, JSON.stringify(payload), 'utf8')
  await rename(tmpPath, cachePath)

  return {
    writeMs: performance.now() - startedAt,
    entriesWritten: entries.length,
  }
}

const withRequestRank = (
  item: PiSessionListItem,
  requestedCwd: string,
  sourceRank: number,
): PiSessionListItem => ({
  ...item,
  ref: {
    ...item.ref,
    path: item.ref.path,
  },
  localProject: item.ref.cwd === requestedCwd,
  sourceRank,
})

const isCacheHit = (
  entry: PiSessionMetadataCacheEntry | undefined,
  path: string,
  stats: FileStats,
): entry is PiSessionMetadataCacheEntry =>
  !!entry
  && entry.path === path
  && entry.item.ref.path === path
  && entry.size === stats.size
  && entry.mtimeMs === stats.mtimeMs

const listFast = async (options?: PiSessionSourceOptions): Promise<PiSessionListPayload> => {
  const startedAt = performance.now()
  const cwd = options?.cwd ?? process.cwd()
  const scope: PiSessionListScope = options?.scope ?? 'current-plus-all'
  const limit = options?.limit ?? DEFAULT_LIMIT

  const discoverStartedAt = performance.now()
  const { dirs, duplicateDirsSkipped } = await resolveRankedDirs(cwd, scope, options?.sessionDir)
  const discoverMs = performance.now() - discoverStartedAt

  const cache = await readMetadataCache()
  const effectCache = await Effect.runPromise(makeMetadataEffectCache())
  const effectStatsBefore = await Effect.runPromise(effectCache.cacheStats)
  const observedCacheEntries = new Map<string, PiSessionMetadataCacheEntry>()

  const parseStartedAt = performance.now()
  const byPath = new Map<string, PiSessionListItem>()
  let filesScanned = 0
  let duplicatePathsSkipped = 0
  let cacheMisses = 0
  let cacheStale = 0
  let diskCacheHits = 0
  let cacheInvalidSessions = 0
  let cacheLookupErrors = 0

  for (const { dir, rank } of dirs) {
    const files = await listJsonlFiles(dir)
    filesScanned += files.length
    const parsed = await Promise.all(files.map(async (file) => {
      const stats = await stat(file)
      const key = metadataCacheKey(file, stats)
      const cached = cache.entries.get(file)
      const alreadyInEffectCache = await Effect.runPromise(effectCache.contains(key))
      const warmHit = isCacheHit(cached, file, stats)

      if (!alreadyInEffectCache) {
        if (warmHit) {
          metadataWarmEntriesByKey.set(key, cached)
          diskCacheHits++
        } else if (cached) cacheStale++
        else cacheMisses++
      }

      const lookupResult = await Effect.runPromise(effectCache.get(key))

      switch (lookupResult._tag) {
        case 'WarmStartHit':
        case 'Parsed':
          observedCacheEntries.set(file, lookupResult.entry)
          return withRequestRank(lookupResult.entry.item, cwd, rank)
        case 'InvalidSession':
          cacheInvalidSessions++
          return null
        case 'LookupError':
          cacheLookupErrors++
          return null
      }
    }))
    for (const item of parsed) {
      if (!item) continue
      const previous = byPath.get(item.ref.path)
      if (previous) duplicatePathsSkipped++
      if (!previous || item.sourceRank < previous.sourceRank) {
        byPath.set(item.ref.path, item)
      }
    }
  }
  const parseMs = performance.now() - parseStartedAt
  const effectStatsAfter = await Effect.runPromise(effectCache.cacheStats)
  const effectCacheHits = Math.max(0, effectStatsAfter.hits - effectStatsBefore.hits)
  const effectCacheMisses = Math.max(0, effectStatsAfter.misses - effectStatsBefore.misses)

  let cacheWriteMs = 0
  let cacheEntriesWritten = 0
  const cacheNeedsWrite = cache.corrupt
    || cacheMisses > 0
    || cacheStale > 0
    || observedCacheEntries.size !== cache.entries.size

  if (cacheNeedsWrite) {
    try {
      const written = await writeMetadataCache([...observedCacheEntries.values()], cache.path)
      cacheWriteMs = written.writeMs
      cacheEntriesWritten = written.entriesWritten
    } catch {
      // Cache is an acceleration layer. Listing must never fail because cache write failed.
    }
  }

  const sortStartedAt = performance.now()
  const sessions = sortItems([...byPath.values()]).slice(0, limit)
  const sortMs = performance.now() - sortStartedAt
  const elapsedMs = performance.now() - startedAt

  const diagnostics: PiSessionListDiagnostics = {
    dirsScanned: dirs.length,
    filesScanned,
    duplicateDirsSkipped,
    duplicatePathsSkipped,
    bytesPerFile: FAST_LIST_BYTES,
    discoverMs: Math.round(discoverMs),
    parseMs: Math.round(parseMs),
    sortMs: Math.round(sortMs),
    cacheEnabled: true,
    cachePath: cache.path,
    cacheReadMs: Math.round(cache.readMs),
    cacheWriteMs: Math.round(cacheWriteMs),
    cacheHits: effectCacheHits + diskCacheHits,
    cacheMisses,
    cacheStale,
    cacheEntriesLoaded: cache.entries.size,
    cacheEntriesWritten,
    cacheCorrupt: cache.corrupt,
    effectCacheHits,
    effectCacheMisses,
    effectCacheSize: effectStatsAfter.size,
    diskCacheHits,
    cacheInvalidSessions,
    cacheLookupErrors,
  }

  return {
    sessions,
    loadedAt: Date.now(),
    elapsedMs: Math.round(elapsedMs),
    scope,
    diagnostics,
  }
}

const listFastEffect = Effect.fn('tmnl.harness.pi-session-source.list-fast')(function* (
  options?: PiSessionSourceOptions,
) {
  const result = yield* Effect.tryPromise({
    try: () => listFast(options),
    catch: toError('pi-session-list-failed', 'Failed to list pi CLI sessions'),
  })

  yield* Effect.annotateCurrentSpan({
    scope: result.scope,
    sessions: result.sessions.length,
    elapsedMs: result.elapsedMs,
    dirsScanned: result.diagnostics?.dirsScanned ?? 0,
    filesScanned: result.diagnostics?.filesScanned ?? 0,
    duplicateDirsSkipped: result.diagnostics?.duplicateDirsSkipped ?? 0,
    duplicatePathsSkipped: result.diagnostics?.duplicatePathsSkipped ?? 0,
  })

  yield* Effect.logDebug('pi session fast-list complete', result.diagnostics ?? {})
  return result
})

const eventTime = (entry: JsonRecord, fallback: number): number => {
  const messageTimestamp = isRecord(entry.message) ? entry.message.timestamp : undefined
  return parseDateMs(messageTimestamp, parseDateMs(entry.timestamp, fallback))
}

const snapshotSessionId = (piId: string): HarnessSessionId => `pi:${piId}` as HarnessSessionId
const messageId = (prefix: string, id: unknown): HarnessMessageId => `${prefix}:${String(id)}` as HarnessMessageId
const clientMessageId = (id: unknown): HarnessClientMessageId => `pi-client:${String(id)}` as HarnessClientMessageId

const isRenderablePiEntry = (entry: JsonRecord): boolean =>
  entry.type === 'message'
  || entry.type === 'custom_message'
  || entry.type === 'branch_summary'
  || entry.type === 'compaction'

const stableEntryKey = (entry: JsonRecord, index: number): string =>
  typeof entry.id === 'string' ? `${String(entry.type)}:${entry.id}` : `${String(entry.type)}:${index}`

const selectPreviewEntries = (
  entries: ReadonlyArray<JsonRecord>,
  maxEntries = DEFAULT_PREVIEW_MAX_ENTRIES,
): JsonRecord[] => {
  const renderable = entries.filter(isRenderablePiEntry)
  const indexed = renderable.map((entry, index) => ({ entry, key: stableEntryKey(entry, index) }))
  const tail = indexed.slice(-maxEntries)
  const tailKeys = new Set(tail.map((item) => item.key))
  const summary = [...indexed]
    .reverse()
    .find((item) =>
      (item.entry.type === 'compaction' || item.entry.type === 'branch_summary')
      && !tailKeys.has(item.key))

  return summary ? [summary.entry, ...tail.map((item) => item.entry)] : tail.map((item) => item.entry)
}

const truncatePreviewText = (text: string, limit?: number): string => {
  if (limit == null || text.length <= limit) return text
  const omitted = text.length - limit
  return `${text.slice(0, limit).trimEnd()}\n\n[preview truncated ${omitted.toLocaleString()} chars; full archive available via chunked hydration]`
}

const pushPiEntryEvents = (
  events: HarnessEvent[],
  rawEntry: JsonRecord,
  args: {
    readonly sessionId: HarnessSessionId
    readonly at: number
    readonly textLimit?: number
    seq: number
  },
): number => {
  const { sessionId, at, textLimit } = args
  let seq = args.seq

  if (rawEntry.type === 'message') {
    const role = roleFromMessage(rawEntry.message)
    const text = truncatePreviewText(textFromMessage(rawEntry.message), textLimit)
    if (!text) return seq

    if (role === 'user') {
      events.push(HarnessUserMessageEvent.make({
        sessionId,
        seq: ++seq,
        at,
        messageId: messageId('pi-user', rawEntry.id),
        clientMessageId: clientMessageId(rawEntry.id),
        text,
      }))
      return seq
    }

    if (role === 'assistant') {
      const mid = messageId('pi-assistant', rawEntry.id)
      events.push(HarnessAssistantStartEvent.make({
        sessionId,
        seq: ++seq,
        at,
        messageId: mid,
      }))
      events.push(HarnessAssistantFinalEvent.make({
        sessionId,
        seq: ++seq,
        at,
        messageId: mid,
        text,
      }))
      return seq
    }

    if (role === 'toolResult') {
      const message = isRecord(rawEntry.message) ? rawEntry.message : {}
      const toolCallId = typeof message.toolCallId === 'string'
        ? message.toolCallId
        : `pi-tool:${String(rawEntry.id)}`
      const toolName = typeof message.toolName === 'string' && message.toolName.length > 0
        ? message.toolName
        : 'pi.toolResult'
      events.push(HarnessToolEvent.make({
        sessionId,
        seq: ++seq,
        at,
        toolCallId,
        toolName,
        phase: 'end',
        payload: {
          result: [{ type: 'text', text }],
          isError: Boolean(message.isError),
        },
      }))
      return seq
    }

    // Tool/custom roles are still useful context in read-only replay.
    events.push(HarnessUserMessageEvent.make({
      sessionId,
      seq: ++seq,
      at,
      messageId: messageId(`pi-${role}`, rawEntry.id),
      clientMessageId: clientMessageId(rawEntry.id),
      text: truncatePreviewText(`[${role}] ${text}`, textLimit),
    }))
    return seq
  }

  if (rawEntry.type === 'custom_message') {
    const text = truncatePreviewText(textFromContent(rawEntry.content), textLimit)
    if (!text) return seq
    events.push(HarnessUserMessageEvent.make({
      sessionId,
      seq: ++seq,
      at,
      messageId: messageId('pi-custom', rawEntry.id),
      clientMessageId: clientMessageId(rawEntry.id),
      text,
    }))
    return seq
  }

  if (rawEntry.type === 'branch_summary' && typeof rawEntry.summary === 'string') {
    events.push(HarnessUserMessageEvent.make({
      sessionId,
      seq: ++seq,
      at,
      messageId: messageId('pi-branch-summary', rawEntry.id),
      clientMessageId: clientMessageId(rawEntry.id),
      text: truncatePreviewText(`[branch summary]\n${rawEntry.summary}`, textLimit),
    }))
    return seq
  }

  if (rawEntry.type === 'compaction' && typeof rawEntry.summary === 'string') {
    events.push(HarnessUserMessageEvent.make({
      sessionId,
      seq: ++seq,
      at,
      messageId: messageId('pi-compaction', rawEntry.id),
      clientMessageId: clientMessageId(rawEntry.id),
      text: truncatePreviewText(`[compaction summary]\n${rawEntry.summary}`, textLimit),
    }))
  }

  return seq
}

const snapshotFromPiEntries = (
  header: JsonRecord,
  entries: ReadonlyArray<JsonRecord>,
  options?: {
    readonly sessionIdOverride?: string
    readonly seqBase?: number
    readonly textLimit?: number
  },
): HarnessSnapshot => {
  if (header.type !== 'session' || typeof header.id !== 'string') {
    throw new Error('Invalid pi session header')
  }

  const sessionId = (options?.sessionIdOverride ?? snapshotSessionId(header.id)) as HarnessSessionId
  const events: HarnessEvent[] = []
  let seq = options?.seqBase ?? 0
  const createdAt = parseDateMs(header.timestamp, Date.now())

  events.push(HarnessSessionOpenedEvent.make({
    sessionId,
    seq: ++seq,
    at: createdAt,
    nodeId: 'pi-cli',
    role: 'code-assistant',
    agentId: 'pi-cli',
  }))

  for (const rawEntry of entries) {
    const at = eventTime(rawEntry, createdAt)
    seq = pushPiEntryEvents(events, rawEntry, { sessionId, at, seq, textLimit: options?.textLimit })
  }

  return new HarnessSnapshot({
    sessionId,
    headSeq: seq,
    events,
  })
}

const loadSnapshotFromPiFile = (path: string, sessionIdOverride?: string): HarnessSnapshot => {
  const manager = SessionManager.open(path)
  const header = manager.getHeader()
  if (!header) {
    throw new Error(`Invalid pi session header: ${path}`)
  }

  return snapshotFromPiEntries(header as unknown as JsonRecord, manager.getBranch() as unknown as JsonRecord[], {
    sessionIdOverride,
  })
}

const loadPreviewSnapshotFromPiFile = async (args: PiSessionPreviewOptions): Promise<HarnessSnapshot> => {
  const headerRecords = parseJsonLines(await readFirstChunk(args.path, FAST_LIST_BYTES))
  const header = headerRecords[0]
  if (!header || header.type !== 'session' || typeof header.id !== 'string') {
    throw new Error(`Invalid pi session header: ${args.path}`)
  }

  const tailBytes = args.tailBytes ?? DEFAULT_PREVIEW_TAIL_BYTES
  const maxEntries = args.maxEntries ?? DEFAULT_PREVIEW_MAX_ENTRIES
  const tailRecords = parseJsonLines(await readTailChunk(args.path, tailBytes))
  const sourceRecords = tailRecords.length > 0 ? tailRecords : headerRecords.slice(1)
  const entries = selectPreviewEntries(sourceRecords, maxEntries)

  return snapshotFromPiEntries(header, entries, {
    sessionIdOverride: args.sessionId,
    seqBase: PREVIEW_SEQ_BASE,
    textLimit: DEFAULT_PREVIEW_TEXT_CHARS,
  })
}

const makePiSessionSource = (): PiSessionSourceShape => ({
  list: (options) => listFastEffect(options),

  loadSnapshot: ({ path, sessionId }) =>
    Effect.try({
      try: () => loadSnapshotFromPiFile(path, sessionId),
      catch: toError('pi-session-load-failed', `Failed to load pi CLI session ${path}`),
    }).pipe(Effect.withSpan('tmnl.harness.pi-session-source.load-snapshot')),

  loadPreviewSnapshot: (args) =>
    Effect.tryPromise({
      try: () => loadPreviewSnapshotFromPiFile(args),
      catch: toError('pi-session-preview-failed', `Failed to load pi CLI session preview ${args.path}`),
    }).pipe(Effect.withSpan('tmnl.harness.pi-session-source.load-preview-snapshot')),
})

export const PiSessionSourceLive = Layer.succeed(PiSessionSource, makePiSessionSource())

export const PiSessionSourceTestApi = {
  compactRankedDirs,
  getDefaultSessionDir,
  listFast,
  loadPreviewSnapshotFromPiFile,
  loadSnapshotFromPiFile,
  resetMetadataEffectCache,
  selectPreviewEntries,
  textFromContent,
}
