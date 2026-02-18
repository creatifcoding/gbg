import { DateTime } from 'effect'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AgentTaskLogEntry } from '../../schemas/log-entry'
import { LOG_LEVEL_SEVERITY, logLevelDataAttr } from '../../schemas/log-level'
import type { AssembledLogEntry } from '../../services/CodecService'
import { LogEntryDetail } from '../log-entry-detail'

const makeEntry = (): AssembledLogEntry => {
  const entry = new AgentTaskLogEntry({
    id: 'detail-1',
    timestamp: DateTime.unsafeNow(),
    level: 'ERROR',
    source: 'runtime',
    message: 'boom',
    metadata: { node: 'alpha', flushContainer: 'buffer-A' },
    payload: { value: 42, stackTrace: 'Error: boom\n at line 1' },
    traceId: 'trace-1',
    spanId: 'span-1',
    toolCallId: 'tool-1',
    parentTaskId: 'task-1',
  })

  return {
    entry,
    severityOrd: LOG_LEVEL_SEVERITY.ERROR,
    levelAttr: logLevelDataAttr('ERROR'),
    timestampDisplay: DateTime.formatIso(entry.timestamp),
    relativeTime: 'just now',
    key: entry.id,
  }
}

describe('LogEntryDetail compound', () => {
  it('renders default compound layout from root', () => {
    render(<LogEntryDetail entry={makeEntry()} />)

    expect(screen.getByText('Payload JSON')).toBeInTheDocument()
    expect(screen.getByText('Metadata JSON')).toBeInTheDocument()
    expect(screen.getByText('Flush Containers')).toBeInTheDocument()
    expect(screen.getByText('Stack Trace')).toBeInTheDocument()
  })

  it('supports child composition with context-backed subcomponents', () => {
    render(
      <LogEntryDetail entry={makeEntry()}>
        <LogEntryDetail.Fields />
        <LogEntryDetail.MetadataJson />
      </LogEntryDetail>,
    )

    expect(screen.getByText('Metadata JSON')).toBeInTheDocument()
    expect(screen.queryByText('Payload JSON')).not.toBeInTheDocument()
  })
})
