import React, { useState } from 'react'
import { Registry, RegistryContext } from '@effect-atom/atom-react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { RvnHarnessChatSurface } from '@/components/testbed/conductor/RvnHarnessChatSurface'
import { inlineTaskEventsByThreadAtom } from '@/lib/conductor/atoms'
import type { ConductorChatMessage } from '@/components/testbed/conductor/ConductorAgentChatService'

function message(overrides?: Partial<ConductorChatMessage>): ConductorChatMessage {
  return {
    id: overrides?.id ?? 'm-1',
    role: overrides?.role ?? 'assistant',
    text: overrides?.text ?? 'hello',
    at: overrides?.at ?? new Date().toISOString(),
  }
}

function ControlledHarness(
  props: Omit<React.ComponentProps<typeof RvnHarnessChatSurface>, 'draft' | 'onDraftChange'>,
) {
  const [draft, setDraft] = useState('')

  return <RvnHarnessChatSurface {...props} draft={draft} onDraftChange={setDraft} />
}

function createRegistryWrapper(registry: Registry) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <RegistryContext.Provider value={registry as any}>{children}</RegistryContext.Provider>
  }
}

describe('RvnHarnessChatSurface contract', () => {
  it('preserves callback contracts (send/reset/exit/agent switch/draft/thread-scroll/expansion)', async () => {
    const onSend = vi.fn(async () => undefined)
    const onResetSession = vi.fn(async () => undefined)
    const onExitChat = vi.fn(async () => undefined)
    const onActiveAgentChange = vi.fn()
    const onThreadScrollTopChange = vi.fn()
    const onToggleExpansion = vi.fn()

    render(
      <ControlledHarness
        nodeId="node-a"
        title="COP ASSISTANT"
        agents={[
          { id: 'agent-a', name: 'Alpha', role: 'planner', model: 'gpt-5.3-codex', status: 'idle' },
          { id: 'agent-b', name: 'Beta', role: 'analyzer', model: 'gpt-5.3-codex', status: 'idle' },
        ]}
        activeAgentId="agent-a"
        onActiveAgentChange={onActiveAgentChange}
        messages={[message({ role: 'assistant', text: 'assistant reply' })]}
        statusRows={[{ id: 's-1', tone: 'info', text: 'S1 • metrics nominal' }]}
        streamingMessageId={null}
        expansionLevel="l3"
        onToggleExpansion={onToggleExpansion}
        onSend={onSend}
        onResetSession={onResetSession}
        onExitChat={onExitChat}
        onThreadScrollTopChange={onThreadScrollTopChange}
      />,
    )

    const composer = screen.getByRole('textbox', { name: /Conductor message composer/i })
    composer.textContent = '/status @WO-42'
    fireEvent.input(composer)

    fireEvent.click(screen.getByRole('button', { name: /Send message/i }))

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledTimes(1)
    })

    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '/status @WO-42',
        targetAgentId: 'agent-a',
        mentions: ['WO-42'],
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: /Reset Session/i }))
    expect(onResetSession).toHaveBeenCalledWith('agent-a')

    fireEvent.click(screen.getByRole('button', { name: /Exit chat/i }))
    expect(onExitChat).toHaveBeenCalledWith('agent-a')

    fireEvent.click(screen.getByRole('button', { name: /Collapse from full chat view/i }))
    expect(onToggleExpansion).toHaveBeenCalledWith('l2', 'agent-a')

    fireEvent.click(screen.getByRole('button', { name: /agent: alpha/i }))
    fireEvent.click(screen.getByRole('option', { name: /Beta/i }))
    expect(onActiveAgentChange).toHaveBeenCalledWith('agent-b')

    const thread = document.querySelector('[data-slot="rvn-conductor-chat-thread"]') as HTMLDivElement
    thread.scrollTop = 48
    fireEvent.scroll(thread)
    expect(onThreadScrollTopChange).toHaveBeenCalledWith(48)
  })

  it('preserves pause/reconnect controls and streaming/status rows rendering', () => {
    const onPause = vi.fn(async () => undefined)
    const onReconnect = vi.fn(async () => undefined)

    render(
      <ControlledHarness
        nodeId="node-a"
        title="COP ASSISTANT"
        agents={[
          { id: 'agent-a', name: 'Alpha', role: 'planner', model: 'gpt-5.3-codex', status: 'idle' },
        ]}
        activeAgentId="agent-a"
        onActiveAgentChange={() => undefined}
        messages={[message({ id: 'stream-1', role: 'assistant', text: 'delta' })]}
        statusRows={[{ id: 'warn-1', tone: 'warn', text: 'S3 • reconnect suggested' }]}
        streamingMessageId="stream-1"
        expansionLevel="l2"
        onSend={async () => undefined}
        onPause={onPause}
        onReconnect={onReconnect}
      />,
    )

    expect(screen.getByText('S3 • reconnect suggested')).toBeInTheDocument()
    expect(screen.getByText('delta▌')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Pause stream/i }))
    expect(onPause).toHaveBeenCalledWith('agent-a')

    fireEvent.click(screen.getByRole('button', { name: /Reconnect node chat/i }))
    expect(onReconnect).toHaveBeenCalledWith('agent-a')
  })

  it('renders inline task attachment lane for assistant messages', () => {
    const registry = Registry.make()
    registry.set(inlineTaskEventsByThreadAtom('node:agent-a'), [
      {
        _tag: 'InlineHarnessTaskUpserted',
        threadId: 'node:agent-a',
        messageAnchorId: 'm-1',
        taskId: 'tool-call-1',
        title: 'Search docs',
        status: 'running',
        progress: null,
        seq: 1,
        at: new Date().toISOString(),
        message: 'Tool execution started',
      },
    ])

    const wrapper = createRegistryWrapper(registry)

    render(
      <RvnHarnessChatSurface
        nodeId="node-a"
        title="COP ASSISTANT"
        agents={[
          { id: 'agent-a', name: 'Alpha', role: 'planner', model: 'gpt-5.3-codex', status: 'idle' },
        ]}
        activeAgentId="agent-a"
        onActiveAgentChange={() => undefined}
        messages={[message({ id: 'm-1', role: 'assistant', text: 'assistant reply' })]}
        onSend={async () => undefined}
      />,
      { wrapper },
    )

    expect(screen.getByText('Search docs')).toBeInTheDocument()
    expect(screen.getByText('Tool execution started')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="rvn-chat-message-attachment-lane"]')).not.toBeNull()
  })
})
