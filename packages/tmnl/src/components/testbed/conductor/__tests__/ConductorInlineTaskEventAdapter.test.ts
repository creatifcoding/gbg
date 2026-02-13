import { describe, expect, it } from 'vitest'

import { mapHarnessEventToInlineTaskEvents } from '@/components/testbed/conductor/ConductorAgentChatService'

describe('ConductorInlineTaskEventAdapter', () => {
  it('maps tool_event start into running task upsert', () => {
    const events = mapHarnessEventToInlineTaskEvents({
      nodeId: 'agent-a',
      messageAnchorId: 'assistant-msg-1',
      event: {
        _tag: 'chat:v2/tool_event',
        sessionId: 'session-1' as any,
        seq: 12,
        at: Date.now(),
        toolCallId: 'tool-1',
        toolName: 'search_docs',
        phase: 'start',
        payload: { message: 'starting', progress: 0 },
      },
    })

    expect(events).toHaveLength(1)
    expect(events[0]?._tag).toBe('InlineHarnessTaskUpserted')
    expect(events[0]?.status).toBe('running')
    expect(events[0]?.threadId).toBe('node:agent-a')
    expect(events[0]?.messageAnchorId).toBe('assistant-msg-1')
  })

  it('maps tool_event end with error payload into failed task event', () => {
    const events = mapHarnessEventToInlineTaskEvents({
      nodeId: 'agent-a',
      event: {
        _tag: 'chat:v2/tool_event',
        sessionId: 'session-1' as any,
        seq: 13,
        at: Date.now(),
        toolCallId: 'tool-2',
        toolName: 'emit_report',
        phase: 'end',
        payload: { error: 'timeout' },
      },
    })

    expect(events).toHaveLength(1)
    expect(events[0]?._tag).toBe('InlineHarnessTaskFailed')
    expect(events[0]?.status).toBe('failed')
    expect(events[0]?.message).toBe('timeout')
  })
})
