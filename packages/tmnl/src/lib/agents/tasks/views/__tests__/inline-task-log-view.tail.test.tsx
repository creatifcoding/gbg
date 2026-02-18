import { Layer } from 'effect'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MockTransportServiceCustom } from '../../services/MockTransportService'
import { AgentTaskServiceBase } from '../../services/layers'
import {
  AgentTaskLogAtomSurfaceCustom,
  createAgentTaskLogAtomSurfaceRuntime,
} from '../../atoms/surface'
import { InlineTaskLogView } from '../inline-task-log-view'

const fastSurfaceRuntime = createAgentTaskLogAtomSurfaceRuntime(
  AgentTaskLogAtomSurfaceCustom(
    AgentTaskServiceBase.pipe(
      Layer.provide(
        MockTransportServiceCustom({
          intervalMs: 0,
          jitterMs: 0,
          infinite: true,
          seed: 13,
        }),
      ),
    ),
  ),
)

const installScrollMetrics = (
  element: HTMLDivElement,
  metrics: { scrollHeight: number; clientHeight: number; scrollTop: number },
) => {
  Object.defineProperty(element, 'scrollHeight', {
    value: metrics.scrollHeight,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(element, 'clientHeight', {
    value: metrics.clientHeight,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(element, 'scrollTop', {
    value: metrics.scrollTop,
    configurable: true,
    writable: true,
  })
}

describe('InlineTaskLogView tail semantics', () => {
  it('switches to inspect on scroll-up and resumes tail via jump-to-latest', async () => {
    const { container } = render(
      <InlineTaskLogView
        taskId="tail-semantics-1"
        atomSurfaceAtom={fastSurfaceRuntime.atomSurfaceAtom}
      />,
    )

    await waitFor(() => {
      expect(screen.queryByText('Waiting for log entries…')).not.toBeInTheDocument()
    })

    const scrollEl = container.querySelector('.at-log-view__scroll') as HTMLDivElement
    expect(scrollEl).toBeTruthy()

    installScrollMetrics(scrollEl, {
      scrollHeight: 1200,
      clientHeight: 300,
      scrollTop: 500,
    })

    fireEvent.scroll(scrollEl)
    expect(screen.getByText('PAUSED')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText(/\+\d+ new/)).toBeInTheDocument()
    })

    const jumpButton = await screen.findByRole('button', { name: /latest/i })
    fireEvent.click(jumpButton)

    await waitFor(() => {
      expect(screen.getByText('LIVE')).toBeInTheDocument()
      expect(screen.queryByText(/\+\d+ new/)).not.toBeInTheDocument()
    })
  })

  it('returns to tail and clears unread when user scrolls back near bottom threshold', async () => {
    const { container } = render(
      <InlineTaskLogView
        taskId="tail-semantics-2"
        atomSurfaceAtom={fastSurfaceRuntime.atomSurfaceAtom}
      />,
    )

    await waitFor(() => {
      expect(screen.queryByText('Waiting for log entries…')).not.toBeInTheDocument()
    })

    const scrollEl = container.querySelector('.at-log-view__scroll') as HTMLDivElement
    expect(scrollEl).toBeTruthy()

    installScrollMetrics(scrollEl, {
      scrollHeight: 1200,
      clientHeight: 300,
      scrollTop: 500,
    })

    fireEvent.scroll(scrollEl)

    await waitFor(() => {
      expect(screen.getByText('PAUSED')).toBeInTheDocument()
      expect(screen.getByText(/\+\d+ new/)).toBeInTheDocument()
    })

    installScrollMetrics(scrollEl, {
      scrollHeight: 1200,
      clientHeight: 300,
      // distanceFromBottom = 1200 - (876 + 300) = 24 (threshold boundary)
      scrollTop: 876,
    })

    fireEvent.scroll(scrollEl)

    await waitFor(() => {
      expect(screen.getByText('LIVE')).toBeInTheDocument()
      expect(screen.queryByText(/\+\d+ new/)).not.toBeInTheDocument()
    })
  })
})
