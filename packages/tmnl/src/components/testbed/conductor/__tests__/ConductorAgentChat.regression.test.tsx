import React, { useState } from 'react'
import { Registry, RegistryContext } from '@effect-atom/atom-react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  ConductorAgentChat,
  type ConductorAgentChatRootProps,
  type ConductorChatStatusRow,
} from '@/components/testbed/conductor/ConductorAgentChat'
import { inlineTaskEventsByThreadAtom } from '@/lib/conductor/atoms'

const message = (overrides?: Partial<{ id: string; role: 'user' | 'assistant' | 'system'; text: string; at: string }>) => ({
  id: overrides?.id ?? 'm-1',
  role: overrides?.role ?? 'assistant',
  text: overrides?.text ?? 'hello',
  at: overrides?.at ?? new Date().toISOString(),
})

function renderChat(
  overrides?: Partial<ConductorAgentChatRootProps>,
  options?: Parameters<typeof render>[1],
) {
  const onSend = overrides?.onSend ?? vi.fn(async () => undefined)

  const props: ConductorAgentChatRootProps = {
    title: 'COP ASSISTANT',
    agents: [
      { id: 'agent-a', name: 'Alpha', role: 'planner', model: 'gpt-5.3-codex', status: 'idle' },
    ],
    activeAgentId: 'agent-a',
    onActiveAgentChange: vi.fn(),
    messages: [message()],
    onSend,
    children: (
      <>
        <ConductorAgentChat.Header />
        <ConductorAgentChat.QuickActions />
        <ConductorAgentChat.Thread />
        <ConductorAgentChat.Composer />
      </>
    ),
    ...overrides,
  }

  return render(<ConductorAgentChat.Root {...props} />, options)
}

function createRegistryWrapper(registry: Registry) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <RegistryContext.Provider value={registry as any}>{children}</RegistryContext.Provider>
  }
}

function ControlledDraftHarness({
  initialDraft = '',
  statusRows = [],
  streamingMessageId = null,
  onPause,
}: {
  initialDraft?: string
  statusRows?: ReadonlyArray<ConductorChatStatusRow>
  streamingMessageId?: string | null
  onPause?: (targetAgentId: string) => void
}) {
  const [draft, setDraft] = useState(initialDraft)

  return (
    <ConductorAgentChat.Root
      title="COP ASSISTANT"
      agents={[{ id: 'agent-a', name: 'Alpha', role: 'planner', model: 'gpt-5.3-codex', status: 'idle' }]}
      activeAgentId="agent-a"
      onActiveAgentChange={() => undefined}
      messages={[message()]}
      slashCommands={[{ id: 'status', command: '/status', description: 'System status' }]}
      draft={draft}
      onDraftChange={setDraft}
      statusRows={statusRows}
      streamingMessageId={streamingMessageId}
      onPause={onPause}
      onReconnect={() => Promise.resolve()}
      onSend={async () => undefined}
    >
      <ConductorAgentChat.Header />
      <ConductorAgentChat.QuickActions />
      <ConductorAgentChat.Thread />
      <ConductorAgentChat.Composer />
    </ConductorAgentChat.Root>
  )
}

describe('ConductorAgentChat regression matrix', () => {
  it('renders canonical connection/message/session chips in header', () => {
    renderChat({
      connectionState: 'resyncing',
      messageState: 'assistant_streaming',
      sessionLabel: 'session-abc-123',
    })

    expect(screen.getByText('resyncing')).toBeInTheDocument()
    expect(screen.getByText('assistant_streaming')).toBeInTheDocument()
    expect(screen.getByText('session-abc-123')).toBeInTheDocument()
  })

  it('hides quick actions while composer has draft content', () => {
    renderChat({
      quickActions: ['RUN STATUS'],
      draft: 'working draft',
      onDraftChange: vi.fn(),
    })

    expect(screen.queryByRole('button', { name: 'RUN STATUS' })).toBeNull()
  })

  it('enforces escape precedence: close suggestions first, then pause while streaming', async () => {
    const onPause = vi.fn()

    render(<ControlledDraftHarness initialDraft="/st" streamingMessageId="stream-1" onPause={onPause} />)

    const textbox = screen.getByRole('textbox', { name: /Conductor message composer/i })
    expect(screen.getByRole('listbox', { name: /Composer suggestions/i })).toBeInTheDocument()

    fireEvent.keyDown(textbox, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('listbox', { name: /Composer suggestions/i })).toBeNull()
    })

    fireEvent.keyDown(textbox, { key: 'Escape' })
    expect(onPause).toHaveBeenCalledWith('agent-a')
  })

  it('focuses reconnect action when escape pressed under reconnect-needed state', () => {
    render(
      <ControlledDraftHarness
        statusRows={[{ id: 'offline', tone: 'warn', text: 'Connection lost' }]}
      />,
    )

    const textbox = screen.getByRole('textbox', { name: /Conductor message composer/i })
    const reconnect = screen.getByRole('button', { name: /Reconnect node chat/i })

    fireEvent.keyDown(textbox, { key: 'Escape' })
    expect(document.activeElement).toBe(reconnect)
  })

  it('applies slash suggestion with Tab instead of sending', async () => {
    render(<ControlledDraftHarness initialDraft="/st" />)

    const textbox = screen.getByRole('textbox', { name: /Conductor message composer/i })
    fireEvent.keyDown(textbox, { key: 'Tab' })

    await waitFor(() => {
      expect(textbox.textContent).toBe('/status ')
    })
  })

  it('wires header controls for reset session and exit chat', () => {
    const onResetSession = vi.fn(async () => undefined)
    const onExitChat = vi.fn(async () => undefined)

    renderChat({ onResetSession, onExitChat, expansionLevel: 'l3' })

    fireEvent.click(screen.getByRole('button', { name: /Reset Session/i }))
    fireEvent.click(screen.getByRole('button', { name: /Exit chat/i }))

    expect(onResetSession).toHaveBeenCalledWith('agent-a')
    expect(onExitChat).toHaveBeenCalledWith('agent-a')
  })

  it('hides exit chat control outside l3 expansion', () => {
    renderChat({ expansionLevel: 'l2' })

    expect(screen.queryByRole('button', { name: /Exit chat/i })).toBeNull()
  })

  it('toggles mode buttons with accessible pressed state', () => {
    renderChat()

    const terminal = screen.getByRole('button', { name: /Terminal mode/i })
    const ai = screen.getByRole('button', { name: /AI mode/i })

    expect(terminal).toHaveAttribute('aria-pressed', 'false')
    expect(ai).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(terminal)

    expect(terminal).toHaveAttribute('aria-pressed', 'true')
    expect(ai).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps composer focus after slash insertion controls', async () => {
    render(<ControlledDraftHarness initialDraft="" />)

    const textbox = screen.getByRole('textbox', { name: /Conductor message composer/i })
    const slashInsert = screen.getByRole('button', { name: /Insert slash command/i })

    fireEvent.click(slashInsert)

    await waitFor(() => {
      expect(textbox.textContent).toBe('/')
      expect(document.activeElement).toBe(textbox)
    })
  })

  it('keeps composer focus after mention insertion controls', async () => {
    render(<ControlledDraftHarness initialDraft="" />)

    const textbox = screen.getByRole('textbox', { name: /Conductor message composer/i })
    const mentionInsert = screen.getByRole('button', { name: /Insert entity mention/i })

    fireEvent.click(mentionInsert)

    await waitFor(() => {
      expect(textbox.textContent).toBe('@')
      expect(document.activeElement).toBe(textbox)
    })
  })

  it('renders inline task attachment rows for assistant message anchor scope', () => {
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
    const { container } = renderChat({}, { wrapper })

    expect(screen.getByText('Search docs')).toBeInTheDocument()
    expect(screen.getByText('Tool execution started')).toBeInTheDocument()
    expect(
      container.querySelector('[data-slot="rvn-chat-inline-task-row-indicator"][data-status="running"]'),
    ).not.toBeNull()
  })
})
