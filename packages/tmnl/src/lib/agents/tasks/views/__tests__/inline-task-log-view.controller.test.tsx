import { Atom } from '@effect-atom/atom'
import { Effect, Layer } from 'effect'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MockTransportServiceCustom } from '../../services/MockTransportService'
import { AgentTaskServiceBase } from '../../services/layers'
import {
  AgentTaskLogAtomSurfaceCustom,
  createAgentTaskLogAtomSurfaceRuntime,
} from '../../atoms/surface'
import { InlineTaskLogView } from '../inline-task-log-view'

const makeRuntime = (config?: Parameters<typeof MockTransportServiceCustom>[0]) =>
  createAgentTaskLogAtomSurfaceRuntime(
    AgentTaskLogAtomSurfaceCustom(
      AgentTaskServiceBase.pipe(
        Layer.provide(
          MockTransportServiceCustom({
            intervalMs: 0,
            jitterMs: 0,
            infinite: true,
            seed: 101,
            ...config,
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

const readVisibleCount = (container: HTMLElement): number => {
  const countNode = container.querySelector('.at-log-tail-controls__count')
  expect(countNode).toBeTruthy()
  const text = countNode?.textContent ?? ''
  const numeric = Number.parseInt(text, 10)
  expect(Number.isNaN(numeric)).toBe(false)
  return numeric
}

describe('InlineTaskLogView controller extraction regressions', () => {
  it('resets inspect/unread state on task switch', async () => {
    const runtime = makeRuntime({ seed: 111 })

    const { container, rerender } = render(
      <InlineTaskLogView taskId="controller-switch-a" atomSurfaceAtom={runtime.atomSurfaceAtom} />,
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

    rerender(
      <InlineTaskLogView taskId="controller-switch-b" atomSurfaceAtom={runtime.atomSurfaceAtom} />,
    )

    await waitFor(() => {
      expect(screen.getByText('LIVE')).toBeInTheDocument()
      expect(screen.queryByText(/\+\d+ new/)).toBeNull()
    })
  })

  it('remounts cleanly with same task/runtime boundary after inspect state', async () => {
    const runtime = makeRuntime({ seed: 222 })

    const first = render(
      <InlineTaskLogView taskId="controller-remount" atomSurfaceAtom={runtime.atomSurfaceAtom} />,
    )

    await waitFor(() => {
      expect(screen.queryByText('Waiting for log entries…')).not.toBeInTheDocument()
    })

    const firstScrollEl = first.container.querySelector('.at-log-view__scroll') as HTMLDivElement
    expect(firstScrollEl).toBeTruthy()

    installScrollMetrics(firstScrollEl, {
      scrollHeight: 1200,
      clientHeight: 300,
      scrollTop: 500,
    })

    fireEvent.scroll(firstScrollEl)

    await waitFor(() => {
      expect(screen.getByText('PAUSED')).toBeInTheDocument()
      expect(screen.getByText(/\+\d+ new/)).toBeInTheDocument()
    })

    first.unmount()

    const second = render(
      <InlineTaskLogView taskId="controller-remount" atomSurfaceAtom={runtime.atomSurfaceAtom} />,
    )

    await waitFor(() => {
      expect(screen.getByText('LIVE')).toBeInTheDocument()
      expect(screen.queryByText(/\+\d+ new/)).toBeNull()
      expect(readVisibleCount(second.container)).toBeGreaterThan(0)
    })
  })

  it('falls back to default mock stream when injected atom surface fails', async () => {
    const failingRuntimeAtom = Atom.runtime(Layer.empty)
    const failingAtomSurfaceAtom = failingRuntimeAtom.atom(
      Effect.fail('surface init failed'),
    ) as unknown as Parameters<typeof InlineTaskLogView>[0]['atomSurfaceAtom']

    const { container } = render(
      <InlineTaskLogView
        taskId="controller-fallback-on-failure"
        atomSurfaceAtom={failingAtomSurfaceAtom}
      />,
    )

    await waitFor(
      () => {
        expect(screen.queryByText('Waiting for log entries…')).not.toBeInTheDocument()
        expect(readVisibleCount(container)).toBeGreaterThan(0)
      },
      { timeout: 5000 },
    )
  })

  it(
    'preserves bounded retention cap at 1000 rendered entries under high-volume stream',
    async () => {
      const runtime = makeRuntime({
        seed: 333,
      })

      const { container } = render(
        <InlineTaskLogView taskId="controller-retention-cap" atomSurfaceAtom={runtime.atomSurfaceAtom} />,
      )

      await waitFor(
        () => {
          const count = readVisibleCount(container)
          expect(count).toBeGreaterThanOrEqual(900)
          expect(count).toBeLessThanOrEqual(1000)
        },
        { timeout: 10_000 },
      )
    },
    15_000,
  )
})
