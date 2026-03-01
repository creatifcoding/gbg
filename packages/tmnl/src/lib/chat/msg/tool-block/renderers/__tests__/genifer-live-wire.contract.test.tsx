import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Atom } from '@effect-atom/atom'

import { GeniferGenerateRenderer } from '../genifer-renderers'
import { createEventProcessor } from '@/lib/morphchat/adapters/harness-event-processor'
import { morphChatRegistry } from '@/lib/morphchat/atoms/registry'
import {
  CONNECTED,
  STREAMING_IDLE,
  type AgentInfo,
  type ChatMessage,
  type ConnectionState,
  type StreamingState,
} from '@/lib/morphchat/schemas/message-types'

const mkMessage = (overrides: Partial<ChatMessage>): ChatMessage => ({
  id: 'm-default',
  role: 'agent',
  content: '',
  timestamp: new Date().toISOString(),
  status: 'sent',
  parts: [],
  ...overrides,
})

describe('genifer live wire (tool update -> chat renderer)', () => {
  it('renders progressively from streamed treePatch details merged by event processor', async () => {
    const messages$ = Atom.make<ReadonlyArray<ChatMessage>>([])
    const connection$ = Atom.make<ConnectionState>(CONNECTED)
    const streaming$ = Atom.make<StreamingState>(STREAMING_IDLE)
    const agents$ = Atom.make<ReadonlyArray<AgentInfo>>([])

    const msgAtom = Atom.make<ChatMessage | null>(null)

    const message = mkMessage({
      id: 'm-genifer',
      status: 'streaming',
      parts: [
        {
          _tag: 'tool-invocation',
          toolCallId: 'tool-1',
          toolName: 'genifer_generate',
          state: 'running',
        },
      ],
    })

    morphChatRegistry.set(messages$, [message])
    morphChatRegistry.set(msgAtom, message)

    const processor = createEventProcessor({
      atoms: { messages$, connection$, streaming$, agents$ },
      agentName: 'tester',
      getMessageAtom: () => msgAtom,
    })

    const readOutput = () => {
      const current = morphChatRegistry.get(msgAtom)
      const toolPart = current?.parts?.find((p) => p._tag === 'tool-invocation') as any
      return toolPart?.output
    }

    const { rerender } = render(
      <GeniferGenerateRenderer
        input={{ prompt: 'live wire test' }}
        output={readOutput()}
        state="running"
        toolCallId="tool-1"
      />,
    )

    // Snapshot: send a full treeSnapshot (how the harness actually delivers initial state)
    processor.processEvent({
      _tag: 'chat:v2/tool_event',
      sessionId: 's-1' as any,
      seq: 1,
      at: Date.now(),
      toolCallId: 'tool-1',
      toolName: 'genifer_generate',
      phase: 'update',
      payload: {
        details: {
          stage: 'streaming',
          surfaceId: 'surface-1',
          patchSeq: 1,
          streamKey: 'tool-1',
          treeSnapshot: {
            root: 'txt-1',
            elements: {
              'txt-1': {
                key: 'txt-1',
                type: 'Text',
                props: {},
                content: 'Live Wire Visible',
                children: [],
                parentKey: null,
              },
            },
          },
        },
      },
    } as any)

    rerender(
      <GeniferGenerateRenderer
        input={{ prompt: 'live wire test' }}
        output={readOutput()}
        state="running"
        toolCallId="tool-1"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Live Wire Visible')).toBeInTheDocument()
    })
  })
})
