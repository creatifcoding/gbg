import { describe, expect, it } from 'vitest'
import { Atom } from '@effect-atom/atom'

import { createEventProcessor } from '../harness-event-processor'
import { morphChatRegistry } from '../../atoms/registry'
import { CONNECTED, STREAMING_IDLE, type ChatMessage, type ConnectionState, type StreamingState, type AgentInfo } from '../../schemas/message-types'

const mkMessage = (overrides: Partial<ChatMessage>): ChatMessage => ({
  id: 'm-default',
  role: 'agent',
  content: '',
  timestamp: new Date().toISOString(),
  status: 'sent',
  parts: [],
  ...overrides,
})

describe('interleaved branch-local updates', () => {
  it('applies tool update to target message atom without rewriting messages$ array', () => {
    const messages$ = Atom.make<ReadonlyArray<ChatMessage>>([])
    const connection$ = Atom.make<ConnectionState>(CONNECTED)
    const streaming$ = Atom.make<StreamingState>(STREAMING_IDLE)
    const agents$ = Atom.make<ReadonlyArray<AgentInfo>>([])

    const msgAAtom = Atom.make<ChatMessage | null>(null)
    const msgBAtom = Atom.make<ChatMessage | null>(null)

    const msgA = mkMessage({
      id: 'm-a',
      status: 'streaming',
      parts: [
        {
          _tag: 'tool-invocation',
          toolCallId: 'tool-1',
          toolName: 'genifer_refine',
          state: 'running',
        },
      ],
    })
    const msgB = mkMessage({
      id: 'm-b',
      status: 'complete',
      content: 'untouched',
    })

    morphChatRegistry.set(messages$, [msgA, msgB])
    morphChatRegistry.set(msgAAtom, msgA)
    morphChatRegistry.set(msgBAtom, msgB)

    const processor = createEventProcessor({
      atoms: {
        messages$,
        connection$,
        streaming$,
        agents$,
      },
      agentName: 'tester',
      getMessageAtom: (messageId: string) => (messageId === 'm-a' ? msgAAtom : msgBAtom),
    })

    const beforeMessagesRef = morphChatRegistry.get(messages$)
    const beforeBRef = morphChatRegistry.get(msgBAtom)

    processor.processEvent({
      _tag: 'chat:v2/tool_event',
      sessionId: 's-1' as any,
      seq: 1,
      at: Date.now(),
      toolCallId: 'tool-1',
      toolName: 'genifer_refine',
      phase: 'update',
      payload: {
        details: {
          stage: 'streaming',
          treePatch: { op: 'set', path: '/elements/form/props/title', value: 'Hello' },
          patchSeq: 1,
        },
      },
    } as any)

    const afterMessagesRef = morphChatRegistry.get(messages$)
    const afterA = morphChatRegistry.get(msgAAtom)
    const afterB = morphChatRegistry.get(msgBAtom)

    // Branch-local contract: hot tool updates should not rewrite global messages array
    expect(afterMessagesRef).toBe(beforeMessagesRef)

    // Target branch updated
    const toolPart = afterA?.parts?.find((p) => p._tag === 'tool-invocation') as any
    expect(toolPart?.output?.details?.patchSeq).toBe(1)

    // Non-target branch stable
    expect(afterB).toBe(beforeBRef)
  })
})
