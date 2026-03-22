import { Layer } from 'effect'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MockTransportServiceCustom } from '../../services/MockTransportService'
import { AgentTaskServiceBase } from '../../services/layers'
import {
  AgentTaskLogAtomSurfaceCustom,
  createAgentTaskLogAtomSurfaceRuntime,
} from '../../atoms/surface'
import { InlineTaskLogView } from '../inline-task-log-view'

const compoundSurfaceRuntime = createAgentTaskLogAtomSurfaceRuntime(
  AgentTaskLogAtomSurfaceCustom(
    AgentTaskServiceBase.pipe(
      Layer.provide(
        MockTransportServiceCustom({
          intervalMs: 0,
          jitterMs: 0,
          infinite: true,
          seed: 9,
        }),
      ),
    ),
  ),
)

describe('InlineTaskLogView compound container', () => {
  it('supports slot composition while preserving context-driven wiring', async () => {
    const { container } = render(
      <InlineTaskLogView
        taskId="compound-log-view-1"
        atomSurfaceAtom={compoundSurfaceRuntime.atomSurfaceAtom}
      >
        <InlineTaskLogView.Header>
          <InlineTaskLogView.Title>Custom Log Surface</InlineTaskLogView.Title>
        </InlineTaskLogView.Header>
        <InlineTaskLogView.FilterBar />
        <InlineTaskLogView.Scroll>
          <InlineTaskLogView.Body>
            <InlineTaskLogView.Empty>No entries yet</InlineTaskLogView.Empty>
            <InlineTaskLogView.Entries />
          </InlineTaskLogView.Body>
        </InlineTaskLogView.Scroll>
        <InlineTaskLogView.TailControls />
      </InlineTaskLogView>,
    )

    expect(screen.getByText('Custom Log Surface')).toBeInTheDocument()
    expect(container.querySelector('[data-slot="log-view-root"]')).toBeTruthy()
    expect(container.querySelector('[data-slot="log-view-scroll"]')).toBeTruthy()

    await waitFor(() => {
      expect(container.querySelector('[data-slot="log-view-entries"]')).toBeTruthy()
    })
  })
})
