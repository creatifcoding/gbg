import { DateTime } from 'effect'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AgentTaskLogEntry } from '../../schemas/log-entry'
import { LOG_LEVEL_SEVERITY, logLevelDataAttr } from '../../schemas/log-level'
import type { AssembledLogEntry } from '../../services/CodecService'
import { LogEntryRow } from '../log-entry-row'

const makeEntry = (): AssembledLogEntry => {
  const entry = new AgentTaskLogEntry({
    id: 'row-1',
    timestamp: DateTime.unsafeNow(),
    level: 'INFO',
    source: 'runtime',
    message: 'task started',
    metadata: { worker: 'alpha' },
    payload: { phase: 'boot' },
  })

  return {
    entry,
    severityOrd: LOG_LEVEL_SEVERITY.INFO,
    levelAttr: logLevelDataAttr('INFO'),
    timestampDisplay: DateTime.formatIso(entry.timestamp),
    relativeTime: 'just now',
    key: entry.id,
  }
}

describe('LogEntryRow compound', () => {
  it('renders default row layout and toggles detail on line click', () => {
    const { container } = render(<LogEntryRow entry={makeEntry()} />)

    expect(container.querySelector('[data-slot="log-entry-row-line"]')).toBeTruthy()
    expect(container.querySelector('[data-slot="log-entry-row-message"]')?.textContent).toContain('task started')

    const line = container.querySelector('.at-log-entry__line') as HTMLDivElement
    fireEvent.click(line)

    expect(container.querySelector('[data-slot="log-entry-row-detail"]')).toBeTruthy()
  })

  it('supports custom compound composition', () => {
    const entry = makeEntry()

    const { container } = render(
      <LogEntryRow entry={entry}>
        <LogEntryRow.Line>
          <LogEntryRow.Level />
          <LogEntryRow.Message value="custom message" />
        </LogEntryRow.Line>
        <LogEntryRow.Detail>
          <div data-testid="custom-detail">custom detail</div>
        </LogEntryRow.Detail>
      </LogEntryRow>,
    )

    expect(screen.getByText('custom message')).toBeInTheDocument()
    expect(screen.queryByTestId('custom-detail')).not.toBeInTheDocument()

    const line = container.querySelector('.at-log-entry__line') as HTMLDivElement
    fireEvent.click(line)

    expect(screen.getByTestId('custom-detail')).toBeInTheDocument()
  })
})
