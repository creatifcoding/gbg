import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RvnChatMessageShell } from '@/lib/rvn/chat/msg'

describe('RvnChatMessageShell', () => {
  it('hydrates attachment lane messageAnchorId from shell root context', () => {
    render(
      <RvnChatMessageShell.Root role="assistant" messageAnchorId="msg-1">
        <RvnChatMessageShell.AttachmentLane.Root>
          <RvnChatMessageShell.AttachmentLane.TelemetryBadge>
            telemetry
          </RvnChatMessageShell.AttachmentLane.TelemetryBadge>
        </RvnChatMessageShell.AttachmentLane.Root>
      </RvnChatMessageShell.Root>,
    )

    const lane = document.querySelector('[data-slot="rvn-chat-message-attachment-lane"]')
    expect(lane).not.toBeNull()
    expect(lane).toHaveAttribute('data-message-anchor-id', 'msg-1')
    const badge = screen.getByText('telemetry')
    expect(badge.closest('[data-slot="rvn-chat-message-telemetry-badge-slot"]')).toHaveAttribute(
      'data-message-anchor-id',
      'msg-1',
    )
  })

  it('hydrates body content streaming state from shell root context', () => {
    render(
      <RvnChatMessageShell.Root role="assistant" streaming>
        <RvnChatMessageShell.BodyContent.Root data-testid="body">
          stream
        </RvnChatMessageShell.BodyContent.Root>
      </RvnChatMessageShell.Root>,
    )

    expect(screen.getByTestId('body')).toHaveAttribute('data-streaming')
  })

  it('enforces attachment lane messageAnchorId ownership boundary', () => {
    expect(() =>
      render(
        <RvnChatMessageShell.Root role="assistant">
          <RvnChatMessageShell.AttachmentLane.Root />
        </RvnChatMessageShell.Root>,
      ),
    ).toThrow(/requires messageAnchorId/i)
  })
})
