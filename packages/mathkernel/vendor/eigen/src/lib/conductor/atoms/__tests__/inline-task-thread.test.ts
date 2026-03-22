import { describe, expect, it } from 'vitest'
import * as Registry from '@effect-atom/atom/Registry'
import {
  inlineTaskAppendEventOp,
  inlineTaskEventsByThreadAtom,
  inlineTaskEventsSubscribableByThreadAtom,
  inlineTaskExpandedTasksByScopeAtom,
  inlineTaskThreadStateAtom,
  toInlineTaskUiStateKey,
} from '../inline-task-thread'

describe('inline-task-thread atoms', () => {
  it('scopes expanded tasks by thread + messageAnchorId', () => {
    const registry = Registry.make()

    registry.set(inlineTaskEventsByThreadAtom('thread-a'), [
      {
        _tag: 'InlineHarnessTaskUpserted',
        threadId: 'thread-a',
        messageAnchorId: 'msg-1',
        taskId: 'task-1',
        title: 'Tool: fetch telemetry',
        status: 'running',
        progress: 15,
        seq: 1,
        at: new Date().toISOString(),
      },
      {
        _tag: 'InlineHarnessTaskUpserted',
        threadId: 'thread-a',
        messageAnchorId: 'msg-2',
        taskId: 'task-2',
        title: 'Tool: build summary',
        status: 'queued',
        progress: null,
        seq: 2,
        at: new Date().toISOString(),
      },
    ])

    const msg1Scope = toInlineTaskUiStateKey('thread-a', 'msg-1')
    const msg2Scope = toInlineTaskUiStateKey('thread-a', 'msg-2')

    const msg1Tasks = registry.get(inlineTaskExpandedTasksByScopeAtom(msg1Scope))
    const msg2Tasks = registry.get(inlineTaskExpandedTasksByScopeAtom(msg2Scope))

    expect(msg1Tasks).toHaveLength(1)
    expect(msg1Tasks[0]?.taskId).toBe('task-1')
    expect(msg2Tasks).toHaveLength(1)
    expect(msg2Tasks[0]?.taskId).toBe('task-2')
  })

  it('guards against duplicate or stale seq in append event op', async () => {
    const registry = Registry.make()

    registry.mount(inlineTaskAppendEventOp)

    const event = {
      _tag: 'InlineHarnessTaskUpserted' as const,
      threadId: 'thread-b',
      messageAnchorId: 'msg-1',
      taskId: 'task-1',
      title: 'Tool: inspect node',
      status: 'running' as const,
      progress: 10,
      seq: 42,
      at: new Date().toISOString(),
      message: 'starting',
    }

    registry.set(inlineTaskAppendEventOp, event)
    registry.set(inlineTaskAppendEventOp, event)
    registry.set(inlineTaskAppendEventOp, { ...event, seq: 40, message: 'stale' })

    await new Promise((resolve) => setTimeout(resolve, 0))

    const state = registry.get(inlineTaskThreadStateAtom('thread-b'))

    expect(state.eventCount).toBe(1)
    expect(state.lastSeq).toBe(42)
    expect(state.tasks).toHaveLength(1)
    expect(state.tasks[0]?.message).toBe('starting')
  })

  it('emits subscribable updates when events append', async () => {
    const registry = Registry.make()
    const snapshots: number[] = []

    const cancel = registry.subscribe(
      inlineTaskEventsSubscribableByThreadAtom('thread-c'),
      (events) => snapshots.push(events.length),
      { immediate: true },
    )

    registry.set(inlineTaskEventsByThreadAtom('thread-c'), [
      {
        _tag: 'InlineHarnessTaskUpserted',
        threadId: 'thread-c',
        messageAnchorId: 'msg-1',
        taskId: 'task-1',
        title: 'Tool: dry-run',
        status: 'running',
        progress: null,
        seq: 1,
        at: new Date().toISOString(),
      },
    ])

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(snapshots[0]).toBe(0)
    expect(snapshots.at(-1)).toBe(1)

    cancel()
  })
})
