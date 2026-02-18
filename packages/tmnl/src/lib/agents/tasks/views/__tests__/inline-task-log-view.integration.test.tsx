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

const makeIntegrationSurfaceRuntime = () =>
  createAgentTaskLogAtomSurfaceRuntime(
    AgentTaskLogAtomSurfaceCustom(
      AgentTaskServiceBase.pipe(
        Layer.provide(
          MockTransportServiceCustom({
            intervalMs: 0,
            jitterMs: 0,
            infinite: true,
            seed: 21,
          }),
        ),
      ),
    ),
  )

describe('InlineTaskLogView integration smoke', () => {
  it('does not chip partial dork tokens while typing (regression)', async () => {
    const integrationSurfaceRuntime = makeIntegrationSurfaceRuntime()

    render(
      <InlineTaskLogView
        taskId="integration-dork-partial-1"
        atomSurfaceAtom={integrationSurfaceRuntime.atomSurfaceAtom}
      />,
    )

    await waitFor(() => {
      expect(screen.queryByText('Waiting for log entries…')).not.toBeInTheDocument()
    })

    const search = screen.getByPlaceholderText(/Search or dork/) as HTMLInputElement

    fireEvent.change(search, { target: { value: 'scope:r' } })

    expect(search.value).toBe('scope:r')
    expect(screen.queryByText('SCOPE')).toBeNull()
    expect(screen.queryByText('scope:r')).toBeNull()

    fireEvent.change(search, { target: { value: 'scope:runtime,' } })

    await waitFor(() => {
      expect(screen.getByText('SCOPE')).toBeInTheDocument()
      expect(screen.getByText('scope:runtime')).toBeInTheDocument()
      expect(search.value).toBe('')
    })
  })

  it('covers stream -> QueryDSL filter -> row detail expansion pipeline', async () => {
    const integrationSurfaceRuntime = makeIntegrationSurfaceRuntime()

    const { container } = render(
      <InlineTaskLogView
        taskId="integration-pipeline-1"
        atomSurfaceAtom={integrationSurfaceRuntime.atomSurfaceAtom}
      />,
    )

    await waitFor(() => {
      expect(screen.queryByText('Waiting for log entries…')).not.toBeInTheDocument()
    })

    const search = screen.getByPlaceholderText(/Search or dork/) as HTMLInputElement
    fireEvent.change(search, { target: { value: 'category:info runtime' } })

    // Dork tokens should not chip while user is still typing.
    expect(screen.queryByText('CATEGORY')).toBeNull()
    expect(search.value).toBe('category:info runtime')

    fireEvent.keyDown(search, { key: 'Enter' })

    await waitFor(() => {
      const rows = container.querySelectorAll('.at-log-entry')
      expect(rows.length).toBeGreaterThan(0)
      expect(screen.getByText('CATEGORY')).toBeInTheDocument()
      expect(screen.getByText('category:info')).toBeInTheDocument()
      expect(search.value).toBe('runtime')
    })

    expect(screen.queryByRole('button', { name: /remove category:info/i })).toBeNull()

    const chip = screen.getByText('category:info').closest('.at-log-filter-bar__dork-chip') as HTMLSpanElement
    expect(chip).toBeTruthy()
    fireEvent.mouseEnter(chip)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /remove category:info/i })).toBeInTheDocument()
    })

    const firstRow = container.querySelector('.at-log-entry__line') as HTMLDivElement
    expect(firstRow).toBeTruthy()
    fireEvent.click(firstRow)

    await waitFor(() => {
      expect(container.querySelector('.rvn-chat__inline-task-detail')).toBeTruthy()
    })
  })
})
