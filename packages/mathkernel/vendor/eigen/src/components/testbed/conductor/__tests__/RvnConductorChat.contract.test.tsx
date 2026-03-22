import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { RvnConductorChat } from '@/components/testbed/conductor/RvnConductorChat'

describe('RvnConductorChat compound API contract', () => {
  it('exposes Header/Context/Thread/Composer families with slot semantics', () => {
    render(
      <RvnConductorChat.Root nodeId="node-a" mode="chat_full">
        <RvnConductorChat.Header.Root>
          <RvnConductorChat.Header.AgentSwitch>agent switch</RvnConductorChat.Header.AgentSwitch>
          <RvnConductorChat.Header.SessionStatus>online</RvnConductorChat.Header.SessionStatus>
          <RvnConductorChat.Header.ResetSession>reset</RvnConductorChat.Header.ResetSession>
        </RvnConductorChat.Header.Root>

        <RvnConductorChat.Context.Root>
          <RvnConductorChat.Context.TopChips>top chip</RvnConductorChat.Context.TopChips>
          <RvnConductorChat.Context.InputChips>input chip</RvnConductorChat.Context.InputChips>
          <RvnConductorChat.Context.CollapseToggle>collapse</RvnConductorChat.Context.CollapseToggle>
        </RvnConductorChat.Context.Root>

        <RvnConductorChat.Thread.Root>
          <RvnConductorChat.Thread.StatusRow>status</RvnConductorChat.Thread.StatusRow>
          <RvnConductorChat.Thread.UserMessage at="now">hello</RvnConductorChat.Thread.UserMessage>
          <RvnConductorChat.Thread.AssistantMessage at="now">
            <RvnConductorChat.Thread.AssistantMessage.FinalBody>
              world
            </RvnConductorChat.Thread.AssistantMessage.FinalBody>
          </RvnConductorChat.Thread.AssistantMessage>
          <RvnConductorChat.Thread.ErrorBanner>error row</RvnConductorChat.Thread.ErrorBanner>
        </RvnConductorChat.Thread.Root>

        <RvnConductorChat.Composer.Root>
          <RvnConductorChat.Composer.SuggestionRail>rail</RvnConductorChat.Composer.SuggestionRail>
          <RvnConductorChat.Composer.SuggestionPopup>popup</RvnConductorChat.Composer.SuggestionPopup>
          <RvnConductorChat.Composer.ContentEditable value="" onValueChange={() => undefined} />
          <RvnConductorChat.Composer.PrimaryAction>send</RvnConductorChat.Composer.PrimaryAction>
          <RvnConductorChat.Composer.ReconnectAction>reconnect</RvnConductorChat.Composer.ReconnectAction>
        </RvnConductorChat.Composer.Root>
      </RvnConductorChat.Root>,
    )

    expect(screen.getByText('agent switch').closest('[data-slot]')).toHaveAttribute(
      'data-slot',
      'rvn-conductor-chat-header-agent-switch',
    )
    expect(screen.getByText('top chip').closest('[data-slot]')).toHaveAttribute(
      'data-slot',
      'rvn-conductor-chat-context-top-chips',
    )
    expect(screen.getByText('error row').closest('[data-slot]')).toHaveAttribute(
      'data-slot',
      'rvn-conductor-chat-error-banner',
    )
    expect(screen.getByRole('textbox', { name: /Conductor message composer/i })).toBeInTheDocument()
  })

  it('routes collapse/exit controls through root callbacks', () => {
    const onModeChange = vi.fn()
    const onExitChat = vi.fn()

    render(
      <RvnConductorChat.Root
        nodeId="node-a"
        mode="chat_full"
        onModeChange={onModeChange}
        onExitChat={onExitChat}
      >
        <RvnConductorChat.Header.Root>
          <RvnConductorChat.Header.CollapseToL2>collapse to l2</RvnConductorChat.Header.CollapseToL2>
          <RvnConductorChat.Header.ExitL3>exit</RvnConductorChat.Header.ExitL3>
        </RvnConductorChat.Header.Root>
      </RvnConductorChat.Root>,
    )

    fireEvent.click(screen.getByRole('button', { name: /collapse to l2/i }))
    fireEvent.click(screen.getByRole('button', { name: /exit/i }))

    expect(onModeChange).toHaveBeenCalledWith('expanded')
    expect(onExitChat).toHaveBeenCalledTimes(1)
  })

  it('keeps contenteditable as controlled surface', () => {
    const onValueChange = vi.fn()

    render(
      <RvnConductorChat.Root nodeId="node-a" mode="chat_full">
        <RvnConductorChat.Composer.Root>
          <RvnConductorChat.Composer.ContentEditable value="hello" onValueChange={onValueChange} />
        </RvnConductorChat.Composer.Root>
      </RvnConductorChat.Root>,
    )

    const textbox = screen.getByRole('textbox', { name: /Conductor message composer/i })
    textbox.textContent = 'hello world'
    fireEvent.input(textbox)

    expect(onValueChange).toHaveBeenCalledWith('hello world')
  })

  it('throws when compound nodes render outside root provider', () => {
    expect(() => render(<RvnConductorChat.Header.Root />)).toThrow(
      /must be used inside RvnConductorChat.Root/i,
    )
  })
})
