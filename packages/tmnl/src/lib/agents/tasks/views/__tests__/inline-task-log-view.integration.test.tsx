import { DateTime, Effect, Layer, Stream } from 'effect'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { serializeLine } from '../../codec/jsonl-codec'
import { AgentTaskLogEntry } from '../../schemas'
import { AgentTaskServiceBase } from '../../services/layers'
import { TransportService } from '../../services/TransportService'
import {
  AgentTaskLogAtomSurfaceCustom,
  createAgentTaskLogAtomSurfaceRuntime,
} from '../../atoms/surface'
import { InlineTaskLogView } from '../inline-task-log-view'

const TASK_ID = 'integration-deterministic-1'

const FIXTURE_LINES: ReadonlyArray<string> = [
  serializeLine(
    new AgentTaskLogEntry({
      id: 'entry-001',
      timestamp: DateTime.unsafeMake(1_700_000_000_001),
      level: 'INFO',
      source: 'runtime',
      message: 'runtime boot complete',
      parentTaskId: TASK_ID,
      metadata: { phase: 'boot' },
    }),
  ),
  serializeLine(
    new AgentTaskLogEntry({
      id: 'entry-002',
      timestamp: DateTime.unsafeMake(1_700_000_000_002),
      level: 'WARN',
      source: 'worker',
      message: 'checkpoint latency spike',
      parentTaskId: TASK_ID,
      metadata: { latencyMs: 222 },
    }),
  ),
  'not-json-at-all',
  serializeLine(
    new AgentTaskLogEntry({
      id: 'entry-003',
      timestamp: DateTime.unsafeMake(1_700_000_000_003),
      level: 'ERROR',
      source: 'durability',
      message: 'outbox retry exhausted',
      parentTaskId: TASK_ID,
      metadata: { retries: 3 },
    }),
  ),
  serializeLine(
    new AgentTaskLogEntry({
      id: 'entry-004',
      timestamp: DateTime.unsafeMake(1_700_000_000_004),
      level: 'INFO',
      source: 'runtime',
      message: 'archive checkpoint flushed',
      parentTaskId: TASK_ID,
      metadata: { chunk: 4 },
    }),
  ),
]

const readRowCount = (container: HTMLElement) =>
  container.querySelectorAll('.at-log-entry').length

const makeDeterministicSurfaceRuntime = () => {
  const transportLayer = Layer.succeed(TransportService, {
    subscribe: (taskId: string) =>
      Effect.succeed(Stream.fromIterable(taskId === TASK_ID ? FIXTURE_LINES : [])),
    publish: () => Effect.void,
  })

  return createAgentTaskLogAtomSurfaceRuntime(
    AgentTaskLogAtomSurfaceCustom(
      AgentTaskServiceBase.pipe(
        Layer.provide(transportLayer),
      ),
    ),
  )
}

describe('InlineTaskLogView integration (deterministic transport)', () => {
  it('renders deterministic stream and applies source + regex filters', async () => {
    const runtime = makeDeterministicSurfaceRuntime()

    const { container } = render(
      <InlineTaskLogView taskId={TASK_ID} atomSurfaceAtom={runtime.atomSurfaceAtom} />,
    )

    await waitFor(() => {
      expect(readRowCount(container)).toBe(4)
      expect(screen.queryByText('Waiting for log entries…')).not.toBeInTheDocument()
    })

    const sourceInput = screen.getByPlaceholderText('Source…') as HTMLInputElement
    fireEvent.change(sourceInput, { target: { value: 'runtime' } })

    await waitFor(() => {
      expect(readRowCount(container)).toBe(2)
    })

    const regexInput = screen.getByPlaceholderText('/regex/') as HTMLInputElement
    fireEvent.change(regexInput, { target: { value: 'checkpoint' } })

    await waitFor(() => {
      expect(readRowCount(container)).toBe(1)
      expect(screen.getByText('archive checkpoint flushed')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /clear/i }))

    await waitFor(() => {
      expect(readRowCount(container)).toBe(4)
    })
  })

  it('commits dorks on Enter and supports row detail expansion', async () => {
    const runtime = makeDeterministicSurfaceRuntime()

    const { container } = render(
      <InlineTaskLogView taskId={TASK_ID} atomSurfaceAtom={runtime.atomSurfaceAtom} />,
    )

    await waitFor(() => {
      expect(readRowCount(container)).toBe(4)
    })

    const search = screen.getByPlaceholderText(/Search or dork/) as HTMLInputElement
    fireEvent.change(search, { target: { value: 'category:warn' } })

    expect(search.value).toBe('category:warn')
    expect(screen.queryByText('CATEGORY')).toBeNull()

    fireEvent.keyDown(search, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText('CATEGORY')).toBeInTheDocument()
      expect(screen.getByText('category:warn')).toBeInTheDocument()
      expect(readRowCount(container)).toBe(1)
    })

    const firstLine = container.querySelector('.at-log-entry__line') as HTMLDivElement
    expect(firstLine).toBeTruthy()
    fireEvent.click(firstLine)

    await waitFor(() => {
      expect(container.querySelector('.rvn-chat__inline-task-detail')).toBeTruthy()
    })
  })
})
