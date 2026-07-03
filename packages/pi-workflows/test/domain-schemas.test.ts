import { describe, expect, it } from 'vitest'
import * as Schema from 'effect/Schema'

import {
  RunStarted,
  WorkflowJournalEntry,
  WorkflowMeta,
  WorkflowSource,
} from '../src/domain/index'

describe('workflow domain schemas', () => {
  it('decodes V0 workflow metadata', () => {
    const meta = Schema.decodeUnknownSync(WorkflowMeta)({
      name: 'deep-audit',
      description: 'Audit from several angles.',
      phases: ['survey', 'synthesis'],
      maxConcurrency: 4,
      tags: ['audit'],
    })

    expect(meta.name).toBe('deep-audit')
    expect(meta.phases).toEqual(['survey', 'synthesis'])
  })

  it('preserves tagged journal entry discriminants', () => {
    const source = Schema.decodeUnknownSync(WorkflowSource)({
      kind: 'inline',
      value: 'export default async function workflow() {}',
      digest: 'script-digest',
    })

    const entry = Schema.decodeUnknownSync(WorkflowJournalEntry)({
      _tag: 'RunStarted',
      runId: 'run-1',
      workflowName: 'deep-audit',
      source,
      inputDigest: 'input-digest',
      at: 1,
    })

    expect(entry._tag).toBe('RunStarted')
    expect(Schema.decodeUnknownSync(RunStarted)(entry)._tag).toBe('RunStarted')
  })
})
