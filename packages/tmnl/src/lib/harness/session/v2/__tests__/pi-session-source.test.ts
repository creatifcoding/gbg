import { execFile } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

import { PiSessionSourceTestApi } from '../pi-session-source'

const execFileAsync = promisify(execFile)
const line = (value: unknown) => JSON.stringify(value)

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
    } finally {
      await rm(fixture.dir, { recursive: true, force: true })
    }
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
