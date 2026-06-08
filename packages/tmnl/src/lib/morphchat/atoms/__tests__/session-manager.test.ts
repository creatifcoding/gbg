import { describe, expect, it, beforeEach, vi } from 'vitest'

vi.mock('../../hooks/useHarnessAdapter', () => {
  const { Atom } = require('@effect-atom/atom')
  return {
    harnessRuntimeAtom: {
      fn: () => (f: any) => Atom.fn((arg: any, ctx: any) => f(arg, ctx)),
    },
    statusRows$: Atom.family((_id: string) => Atom.make([])),
  }
})

import { morphChatRegistry } from '../registry'
import {
  drawerSessionList$,
  filteredDrawerSessionList$,
  localSessionList$,
  piSessionList$,
  sessionAnnotations$,
  sessionList$,
  sessionQuery$,
} from '../session-manager'
import type { PiSessionListItem, SessionAnnotation } from '@/lib/harness/session/v2/pi-session-schemas'

describe('session-manager drawer source atoms', () => {
  beforeEach(() => {
    morphChatRegistry.reset()
  })

  it('projects harness, local, and pi CLI sources into one drawer list', () => {
    const instanceId = 'drawer-source-test'
    const now = Date.now()
    const piItem: PiSessionListItem = {
      _tag: 'PiSessionListItem',
      ref: {
        _tag: 'PiCliSessionRef',
        id: 'pi-session-1',
        path: '/tmp/pi-session-1.jsonl',
        cwd: '/workspace/tmnl',
      },
      title: 'Pi CLI import',
      createdAt: now - 3_000,
      updatedAt: now,
      messageCount: 7,
      preview: 'pi replay preview',
      localProject: true,
      sourceRank: 0,
    }

    morphChatRegistry.set(sessionList$(instanceId), [
      {
        sessionId: 'harness-1',
        name: 'Harness one',
        autoTitle: 'Harness auto',
        tags: [],
        status: 'active',
        starred: false,
        createdAt: now - 10_000,
        updatedAt: now - 9_000,
        messageCount: 2,
        modelId: 'sonnet',
        provider: 'anthropic',
        previewSnippet: 'harness preview',
        nodeId: 'node-1',
        role: 'general',
      },
    ])
    morphChatRegistry.set(localSessionList$, [
      {
        sessionId: 'local-1',
        name: '',
        autoTitle: 'Local one',
        tags: [],
        status: 'active',
        starred: false,
        createdAt: now - 8_000,
        updatedAt: now - 7_000,
        messageCount: 3,
        modelId: 'unknown',
        provider: 'local',
        previewSnippet: 'local preview',
        nodeId: '',
        role: 'coder',
      },
    ])
    morphChatRegistry.set(piSessionList$(instanceId), [piItem])

    const sessions = morphChatRegistry.get(drawerSessionList$(instanceId))

    expect(sessions.map((session) => session.sourceKind)).toEqual(['pi-cli', 'local', 'harness'])
    expect(sessions[0]).toMatchObject({
      sessionId: 'pi-cli:/tmp/pi-session-1.jsonl',
      sourceKind: 'pi-cli',
      piPath: '/tmp/pi-session-1.jsonl',
      previewSnippet: 'pi replay preview',
    })
  })

  it('applies annotations and filters against source-aware metadata', () => {
    const instanceId = 'drawer-annotation-test'
    const now = Date.now()
    const annotation: SessionAnnotation = {
      _tag: 'SessionAnnotation',
      ref: {
        _tag: 'PiCliSessionRef',
        id: 'pi-session-2',
        path: '/tmp/pi-session-2.jsonl',
        cwd: '/workspace/tmnl',
      },
      name: 'Blessed pi run',
      description: 'critical replay candidate',
      blessed: true,
      tags: ['blessed', 'ops'],
      updatedAt: now,
    }

    morphChatRegistry.set(piSessionList$(instanceId), [
      {
        _tag: 'PiSessionListItem',
        ref: annotation.ref as Extract<SessionAnnotation['ref'], { _tag: 'PiCliSessionRef' }>,
        title: 'Raw pi title',
        createdAt: now - 1_000,
        updatedAt: now - 1_000,
        messageCount: 4,
        preview: '',
        localProject: false,
        sourceRank: 1,
      },
    ])
    morphChatRegistry.set(sessionAnnotations$, [annotation])
    morphChatRegistry.set(sessionQuery$(instanceId), { search: 'critical', filter: 'starred' })

    const filtered = morphChatRegistry.get(filteredDrawerSessionList$(instanceId))

    expect(filtered).toHaveLength(1)
    expect(filtered[0]).toMatchObject({
      name: 'Blessed pi run',
      starred: true,
      status: 'starred',
      annotationDescription: 'critical replay candidate',
    })
    expect(filtered[0].tags).toEqual(expect.arrayContaining(['blessed', 'ops', 'pi-cli']))
  })
})
