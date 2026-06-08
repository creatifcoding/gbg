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
import { open as openFile, readdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { Context, Effect, Layer, Option, Schema } from 'effect'
import { getAgentDir, SessionManager } from '@mariozechner/pi-coding-agent'

import {
  HarnessAssistantFinalEvent,
  HarnessAssistantStartEvent,
  HarnessClientMessageId,
  HarnessMessageId,
  HarnessSessionId,
  HarnessSessionOpenedEvent,
  HarnessSnapshot,
  HarnessUserMessageEvent,
  type HarnessEvent,
} from '../../schemas'
import {
  PiSessionListOptions,
  PiSessionListPayload,
  type PiSessionListItem,
  type PiSessionListScope,
} from './pi-session-schemas'

const FAST_LIST_BYTES = 256 * 1024
const DEFAULT_LIMIT = 200

type JsonRecord = Record<string, unknown>

type PiSessionSourceOptions = typeof PiSessionListOptions.Type

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

const buildFastListItem = async (
  path: string,
  requestedCwd: string,
  sourceRank: number,
): Promise<PiSessionListItem | null> => {
  const [stats, chunk] = await Promise.all([stat(path), readFirstChunk(path)])
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

const listFast = async (options?: PiSessionSourceOptions): Promise<PiSessionListPayload> => {
  const startedAt = performance.now()
  const cwd = options?.cwd ?? process.cwd()
  const scope: PiSessionListScope = options?.scope ?? 'current-plus-all'
  const limit = options?.limit ?? DEFAULT_LIMIT

  const dirs: Array<{ dir: string; rank: number }> = []
  if (options?.sessionDir) {
    dirs.push({ dir: options.sessionDir, rank: 0 })
  } else if (scope === 'current') {
    dirs.push({ dir: getDefaultSessionDir(cwd), rank: 0 })
  } else if (scope === 'all') {
    dirs.push(...(await listProjectDirs()).map((dir) => ({ dir, rank: 0 })))
  } else {
    dirs.push({ dir: getDefaultSessionDir(cwd), rank: 0 })
    dirs.push(...(await listProjectDirs()).map((dir) => ({ dir, rank: 1 })))
  }

  const byPath = new Map<string, PiSessionListItem>()
  for (const { dir, rank } of dirs) {
    const files = await listJsonlFiles(dir)
    const parsed = await Promise.all(files.map((file) => buildFastListItem(file, cwd, rank)))
    for (const item of parsed) {
      if (!item) continue
      const previous = byPath.get(item.ref.path)
      if (!previous || item.sourceRank < previous.sourceRank) {
        byPath.set(item.ref.path, item)
      }
    }
  }

  const sessions = sortItems([...byPath.values()]).slice(0, limit)
  return {
    sessions,
    loadedAt: Date.now(),
    elapsedMs: Math.round(performance.now() - startedAt),
    scope,
  }
}

const eventTime = (entry: JsonRecord, fallback: number): number => {
  const messageTimestamp = isRecord(entry.message) ? entry.message.timestamp : undefined
  return parseDateMs(messageTimestamp, parseDateMs(entry.timestamp, fallback))
}

const snapshotSessionId = (piId: string): HarnessSessionId => `pi:${piId}` as HarnessSessionId
const messageId = (prefix: string, id: unknown): HarnessMessageId => `${prefix}:${String(id)}` as HarnessMessageId
const clientMessageId = (id: unknown): HarnessClientMessageId => `pi-client:${String(id)}` as HarnessClientMessageId

const loadSnapshotFromPiFile = (path: string, sessionIdOverride?: string): HarnessSnapshot => {
  const manager = SessionManager.open(path)
  const header = manager.getHeader()
  if (!header) {
    throw new Error(`Invalid pi session header: ${path}`)
  }

  const sessionId = (sessionIdOverride ?? snapshotSessionId(header.id)) as HarnessSessionId
  const events: HarnessEvent[] = []
  let seq = 0
  const createdAt = parseDateMs(header.timestamp, Date.now())

  events.push(HarnessSessionOpenedEvent.make({
    sessionId,
    seq: ++seq,
    at: createdAt,
    nodeId: 'pi-cli',
    role: 'code-assistant',
    agentId: 'pi-cli',
  }))

  for (const rawEntry of manager.getBranch() as unknown as JsonRecord[]) {
    const at = eventTime(rawEntry, createdAt)

    if (rawEntry.type === 'message') {
      const role = roleFromMessage(rawEntry.message)
      const text = textFromMessage(rawEntry.message)
      if (!text) continue

      if (role === 'user') {
        events.push(HarnessUserMessageEvent.make({
          sessionId,
          seq: ++seq,
          at,
          messageId: messageId('pi-user', rawEntry.id),
          clientMessageId: clientMessageId(rawEntry.id),
          text,
        }))
        continue
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
        continue
      }

      // Tool/custom roles are still useful context in read-only replay.
      events.push(HarnessUserMessageEvent.make({
        sessionId,
        seq: ++seq,
        at,
        messageId: messageId(`pi-${role}`, rawEntry.id),
        clientMessageId: clientMessageId(rawEntry.id),
        text: `[${role}] ${text}`,
      }))
      continue
    }

    if (rawEntry.type === 'custom_message') {
      const text = textFromContent(rawEntry.content)
      if (!text) continue
      events.push(HarnessUserMessageEvent.make({
        sessionId,
        seq: ++seq,
        at,
        messageId: messageId('pi-custom', rawEntry.id),
        clientMessageId: clientMessageId(rawEntry.id),
        text,
      }))
      continue
    }

    if (rawEntry.type === 'branch_summary' && typeof rawEntry.summary === 'string') {
      events.push(HarnessUserMessageEvent.make({
        sessionId,
        seq: ++seq,
        at,
        messageId: messageId('pi-branch-summary', rawEntry.id),
        clientMessageId: clientMessageId(rawEntry.id),
        text: `[branch summary]\n${rawEntry.summary}`,
      }))
      continue
    }

    if (rawEntry.type === 'compaction' && typeof rawEntry.summary === 'string') {
      events.push(HarnessUserMessageEvent.make({
        sessionId,
        seq: ++seq,
        at,
        messageId: messageId('pi-compaction', rawEntry.id),
        clientMessageId: clientMessageId(rawEntry.id),
        text: `[compaction summary]\n${rawEntry.summary}`,
      }))
    }
  }

  return new HarnessSnapshot({
    sessionId,
    headSeq: seq,
    events,
  })
}

const makePiSessionSource = (): PiSessionSourceShape => ({
  list: (options) =>
    Effect.tryPromise({
      try: () => listFast(options),
      catch: toError('pi-session-list-failed', 'Failed to list pi CLI sessions'),
    }).pipe(Effect.withSpan('tmnl.harness.pi-session-source.list')),

  loadSnapshot: ({ path, sessionId }) =>
    Effect.try({
      try: () => loadSnapshotFromPiFile(path, sessionId),
      catch: toError('pi-session-load-failed', `Failed to load pi CLI session ${path}`),
    }).pipe(Effect.withSpan('tmnl.harness.pi-session-source.load-snapshot')),
})

export const PiSessionSourceLive = Layer.succeed(PiSessionSource, makePiSessionSource())

export const PiSessionSourceTestApi = {
  getDefaultSessionDir,
  listFast,
  loadSnapshotFromPiFile,
  textFromContent,
}
