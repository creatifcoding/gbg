import { execFile } from 'node:child_process'
import { appendFile, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

import { PiSessionSourceTestApi } from '../pi-session-source'

const execFileAsync = promisify(execFile)
const line = (value: unknown) => JSON.stringify(value)

async function withCachePath<T>(fn: (cachePath: string) => Promise<T>): Promise<T> {
  const previous = process.env.TMNL_PI_SESSION_CACHE_PATH
  const dir = await mkdtemp(join(tmpdir(), 'tmnl-pi-session-cache-'))
  const cachePath = join(dir, 'cache.json')
  process.env.TMNL_PI_SESSION_CACHE_PATH = cachePath
  PiSessionSourceTestApi.resetMetadataEffectCache()

  try {
    return await fn(cachePath)
  } finally {
    PiSessionSourceTestApi.resetMetadataEffectCache()
    if (previous === undefined) delete process.env.TMNL_PI_SESSION_CACHE_PATH
    else process.env.TMNL_PI_SESSION_CACHE_PATH = previous
    await rm(dir, { recursive: true, force: true })
  }
}

async function makeFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'tmnl-pi-session-'))
  const cwd = '/workspace/tmnl-fixture'
  const file = join(dir, '2026-01-01T00-00-00_sess-1.jsonl')
  const jsonl = [
    line({ type: 'session', version: 1, id: 'sess-1', timestamp: '2026-01-01T00:00:00.000Z', cwd }),
    line({ type: 'session_info', id: 'info-1', parentId: null, timestamp: '2026-01-01T00:00:01.000Z', name: 'Named pi session' }),
    line({ type: 'message', id: 'u-1', parentId: null, timestamp: '2026-01-01T00:00:02.000Z', message: { role: 'user', content: 'Hello pi', timestamp: Date.parse('2026-01-01T00:00:02.000Z') } }),
    line({ type: 'message', id: 'a-1', parentId: 'u-1', timestamp: '2026-01-01T00:00:03.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'Hello harness' }], timestamp: Date.parse('2026-01-01T00:00:03.000Z'), api: 'messages', provider: 'anthropic', model: 'claude-test', usage: {}, stopReason: 'stop' } }),
  ].join('\n') + '\n'
  await writeFile(file, jsonl)
  return { dir, file, cwd }
}

describe('PiSessionSource', () => {
  it('lists pi sessions with bounded fast metadata', async () => {
    const fixture = await makeFixture()
    try {
      const result = await PiSessionSourceTestApi.listFast({
        scope: 'current',
        cwd: fixture.cwd,
        sessionDir: fixture.dir,
      })

      expect(result.sessions).toHaveLength(1)
      expect(result.sessions[0]._tag).toBe('PiSessionListItem')
      expect(result.sessions[0].title).toBe('Named pi session')
      expect(result.sessions[0].preview).toContain('Hello pi')
      expect(result.sessions[0].localProject).toBe(true)
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0)
      expect(result.diagnostics).toMatchObject({
        dirsScanned: 1,
        filesScanned: 1,
        duplicateDirsSkipped: 0,
        duplicatePathsSkipped: 0,
      })
    } finally {
      await rm(fixture.dir, { recursive: true, force: true })
    }
  })

  it('reuses warm metadata cache entries for unchanged files', async () => {
    await withCachePath(async () => {
      const fixture = await makeFixture()
      try {
        const cold = await PiSessionSourceTestApi.listFast({
          scope: 'current',
          cwd: fixture.cwd,
          sessionDir: fixture.dir,
        })
        const warm = await PiSessionSourceTestApi.listFast({
          scope: 'current',
          cwd: fixture.cwd,
          sessionDir: fixture.dir,
        })

        expect(cold.diagnostics).toMatchObject({
          cacheHits: 0,
          cacheMisses: 1,
          cacheEntriesWritten: 1,
          effectCacheHits: 0,
          effectCacheMisses: 1,
          diskCacheHits: 0,
        })
        expect(warm.diagnostics).toMatchObject({
          cacheHits: 1,
          cacheMisses: 0,
          cacheStale: 0,
          effectCacheHits: 1,
          effectCacheMisses: 0,
          diskCacheHits: 0,
          cacheInvalidSessions: 0,
          cacheLookupErrors: 0,
        })
        expect(warm.sessions[0].title).toBe('Named pi session')
      } finally {
        await rm(fixture.dir, { recursive: true, force: true })
      }
    })
  })

  it('invalidates cached metadata when a session file changes', async () => {
    await withCachePath(async () => {
      const fixture = await makeFixture()
      try {
        await PiSessionSourceTestApi.listFast({
          scope: 'current',
          cwd: fixture.cwd,
          sessionDir: fixture.dir,
        })
        await appendFile(
          fixture.file,
          line({ type: 'message', id: 'u-2', timestamp: '2026-01-01T00:00:04.000Z', message: { role: 'user', content: 'Changed cache input', timestamp: Date.parse('2026-01-01T00:00:04.000Z') } }) + '\n',
        )

        const refreshed = await PiSessionSourceTestApi.listFast({
          scope: 'current',
          cwd: fixture.cwd,
          sessionDir: fixture.dir,
        })

        expect(refreshed.diagnostics).toMatchObject({
          cacheHits: 0,
          cacheMisses: 0,
          cacheStale: 1,
        })
        expect(refreshed.sessions[0].messageCount).toBe(3)
      } finally {
        await rm(fixture.dir, { recursive: true, force: true })
      }
    })
  })

  it('classifies readable non-session jsonl files as invalid, not lookup errors', async () => {
    await withCachePath(async () => {
      const fixture = await makeFixture()
      try {
        await writeFile(join(fixture.dir, 'not-a-session.jsonl'), line({ type: 'message', id: 'orphan' }) + '\n')

        const result = await PiSessionSourceTestApi.listFast({
          scope: 'current',
          cwd: fixture.cwd,
          sessionDir: fixture.dir,
        })

        expect(result.sessions).toHaveLength(1)
        expect(result.diagnostics).toMatchObject({
          cacheInvalidSessions: 1,
          cacheLookupErrors: 0,
        })
      } finally {
        await rm(fixture.dir, { recursive: true, force: true })
      }
    })
  })

  it('falls back to bounded scan when the metadata cache is corrupt', async () => {
    await withCachePath(async (cachePath) => {
      const fixture = await makeFixture()
      try {
        await writeFile(cachePath, '{not-json')
        const result = await PiSessionSourceTestApi.listFast({
          scope: 'current',
          cwd: fixture.cwd,
          sessionDir: fixture.dir,
        })

        expect(result.sessions).toHaveLength(1)
        expect(result.diagnostics).toMatchObject({
          cacheCorrupt: true,
          cacheMisses: 1,
        })
      } finally {
        await rm(fixture.dir, { recursive: true, force: true })
      }
    })
  })

  it('drops deleted session files from the persisted metadata cache', async () => {
    await withCachePath(async (cachePath) => {
      const fixture = await makeFixture()
      try {
        const secondFile = join(fixture.dir, '2026-01-01T00-00-05_sess-2.jsonl')
        await writeFile(secondFile, [
          line({ type: 'session', version: 1, id: 'sess-2', timestamp: '2026-01-01T00:00:05.000Z', cwd: fixture.cwd }),
          line({ type: 'message', id: 'u-1', timestamp: '2026-01-01T00:00:06.000Z', message: { role: 'user', content: 'Second session', timestamp: Date.parse('2026-01-01T00:00:06.000Z') } }),
        ].join('\n') + '\n')

        await PiSessionSourceTestApi.listFast({
          scope: 'current',
          cwd: fixture.cwd,
          sessionDir: fixture.dir,
        })
        await rm(secondFile, { force: true })
        const result = await PiSessionSourceTestApi.listFast({
          scope: 'current',
          cwd: fixture.cwd,
          sessionDir: fixture.dir,
        })
        const cache = JSON.parse(await readFile(cachePath, 'utf8')) as { entries: unknown[] }

        expect(result.sessions).toHaveLength(1)
        expect(result.diagnostics?.cacheEntriesWritten).toBe(1)
        expect(cache.entries).toHaveLength(1)
      } finally {
        await rm(fixture.dir, { recursive: true, force: true })
      }
    })
  })

  it('dedupes ranked dirs while preserving the best project rank', () => {
    const result = PiSessionSourceTestApi.compactRankedDirs([
      { dir: '/sessions/current', rank: 0 },
      { dir: '/sessions/other', rank: 1 },
      { dir: '/sessions/current', rank: 1 },
      { dir: '/sessions/current', rank: 2 },
    ])

    expect(result.duplicateDirsSkipped).toBe(2)
    expect(result.dirs).toEqual([
      { dir: '/sessions/current', rank: 0 },
      { dir: '/sessions/other', rank: 1 },
    ])
  })

  it('loads pi JSONL as a synthetic harness snapshot', async () => {
    const fixture = await makeFixture()
    try {
      const snapshot = PiSessionSourceTestApi.loadSnapshotFromPiFile(fixture.file)

      expect(snapshot.sessionId).toBe('pi:sess-1')
      expect(snapshot.events.map((event) => event._tag)).toEqual([
        'chat:v2/session_opened',
        'chat:v2/user_message',
        'chat:v2/assistant_start',
        'chat:v2/assistant_final',
      ])
      expect(snapshot.events[1]).toMatchObject({ text: 'Hello pi' })
      expect(snapshot.events[3]).toMatchObject({ text: 'Hello harness' })
    } finally {
      await rm(fixture.dir, { recursive: true, force: true })
    }
  })

  it('projects pi toolResult messages as harness tool events', async () => {
    const fixture = await makeFixture()
    try {
      await appendFile(
        fixture.file,
        line({
          type: 'message',
          id: 'tool-1',
          timestamp: '2026-01-01T00:00:04.000Z',
          message: {
            role: 'toolResult',
            toolCallId: 'call-tool-1',
            toolName: 'skill-output',
            content: [{ type: 'text', text: '#!/usr/bin/env python3\nprint("muse")' }],
            timestamp: Date.parse('2026-01-01T00:00:04.000Z'),
          },
        }) + '\n',
      )

      const snapshot = PiSessionSourceTestApi.loadSnapshotFromPiFile(fixture.file)
      const toolEvent = snapshot.events.find((event) => event._tag === 'chat:v2/tool_event')

      expect(toolEvent).toMatchObject({
        _tag: 'chat:v2/tool_event',
        toolCallId: 'call-tool-1',
        toolName: 'skill-output',
        phase: 'end',
        payload: {
          result: [{ type: 'text', text: '#!/usr/bin/env python3\nprint("muse")' }],
          isError: false,
        },
      })
      expect(snapshot.events).not.toContainEqual(expect.objectContaining({
        _tag: 'chat:v2/user_message',
        text: expect.stringContaining('[toolResult]'),
      }))
    } finally {
      await rm(fixture.dir, { recursive: true, force: true })
    }
  })

  it('loads a bounded preview window with the latest summary and tail entries', async () => {
    const fixture = await makeFixture()
    try {
      await appendFile(
        fixture.file,
        [
          line({ type: 'compaction', id: 'c-1', timestamp: '2026-01-01T00:00:04.000Z', summary: 'Useful compacted context' }),
          line({ type: 'message', id: 'u-2', timestamp: '2026-01-01T00:00:05.000Z', message: { role: 'user', content: 'Older user turn', timestamp: Date.parse('2026-01-01T00:00:05.000Z') } }),
          line({ type: 'message', id: 'a-2', timestamp: '2026-01-01T00:00:06.000Z', message: { role: 'assistant', content: 'Older assistant turn', timestamp: Date.parse('2026-01-01T00:00:06.000Z') } }),
          line({ type: 'message', id: 'u-3', timestamp: '2026-01-01T00:00:07.000Z', message: { role: 'user', content: 'Newest user turn', timestamp: Date.parse('2026-01-01T00:00:07.000Z') } }),
          line({ type: 'message', id: 'a-3', timestamp: '2026-01-01T00:00:08.000Z', message: { role: 'assistant', content: 'Newest assistant turn', timestamp: Date.parse('2026-01-01T00:00:08.000Z') } }),
        ].join('\n') + '\n',
      )

      const snapshot = await PiSessionSourceTestApi.loadPreviewSnapshotFromPiFile({
        path: fixture.file,
        maxEntries: 2,
        tailBytes: 1024 * 1024,
      })

      expect(snapshot.sessionId).toBe('pi:sess-1')
      expect(snapshot.events[0].seq).toBeGreaterThan(100_000_000)
      expect(snapshot.events.map((event) => event._tag)).toEqual([
        'chat:v2/session_opened',
        'chat:v2/user_message',
        'chat:v2/user_message',
        'chat:v2/assistant_start',
        'chat:v2/assistant_final',
      ])
      expect(snapshot.events[1]).toMatchObject({ text: '[compaction summary]\nUseful compacted context' })
      expect(snapshot.events[2]).toMatchObject({ text: 'Newest user turn' })
      expect(snapshot.events[4]).toMatchObject({ text: 'Newest assistant turn' })
    } finally {
      await rm(fixture.dir, { recursive: true, force: true })
    }
  })

  it('exercises the pi session list CLI benchmark against a fixture directory', async () => {
    const fixture = await makeFixture()
    try {
      const { stdout } = await execFileAsync(
        'bun',
        [
          'scripts/spikes/pi-session-list-bench.ts',
          '--cwd',
          fixture.cwd,
          '--session-dir',
          fixture.dir,
          '--scope',
          'current',
          '--limit',
          '10',
          '--skip-sdk',
        ],
        {
          cwd: process.cwd(),
          timeout: 20_000,
        },
      )

      const lines = stdout.trim().split('\n').filter(Boolean)
      expect(lines).toHaveLength(1)
      const result = JSON.parse(lines[0]) as { label: string; count: number; elapsedMs: number }
      expect(result.label).toBe('tmnl.fast-list.current')
      expect(result.count).toBe(1)
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0)
    } finally {
      await rm(fixture.dir, { recursive: true, force: true })
    }
  }, 30_000)
})
