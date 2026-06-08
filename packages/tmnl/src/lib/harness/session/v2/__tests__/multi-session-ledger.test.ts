import { describe, expect, it, beforeEach } from 'vitest'

import {
  addSessionToGroup,
  asyncSessionSlots$,
  blessSession,
  createMultiSessionGroup,
  getMultiSessionLedgerSnapshot,
  multiSessionAnnotations$,
  multiSessionGroups$,
  openGroupAsAsyncSlots,
  removeSessionFromGroup,
  resetMultiSessionLedger,
} from '../multi-session-ledger'
import { sessionRegistry } from '../atoms'
import type { SessionRef } from '../pi-session-schemas'

const piRef = (id: string): SessionRef => ({
  _tag: 'PiCliSessionRef',
  id,
  path: `/tmp/${id}.jsonl`,
  cwd: '/tmp',
})

describe('multi-session ledger', () => {
  beforeEach(() => {
    resetMultiSessionLedger()
  })

  it('blesses and annotates a pi session without mutating source files', () => {
    const annotation = blessSession(piRef('s1'), {
      name: 'Field report',
      description: 'The useful one, finally.',
      tags: ['ops'],
    })

    expect(annotation.blessed).toBe(true)
    expect(annotation.name).toBe('Field report')
    expect(sessionRegistry.get(multiSessionAnnotations$)).toHaveLength(1)
  })

  it('creates groups and opens deterministic async slots', () => {
    const group = createMultiSessionGroup({
      name: 'Morning triage',
      refs: [piRef('s1'), piRef('s2')],
    })

    addSessionToGroup(group.id, piRef('s3'), { role: 'context' })
    const slots = openGroupAsAsyncSlots(group.id)

    expect(sessionRegistry.get(multiSessionGroups$)[0].members).toHaveLength(3)
    expect(slots.map((slot) => slot.id)).toEqual(['slot-0', 'slot-1', 'slot-2'])
    expect(slots.every((slot) => slot.status === 'loading')).toBe(true)
    expect(sessionRegistry.get(asyncSessionSlots$)).toHaveLength(3)
  })

  it('removes sessions from groups and reindexes order', () => {
    const group = createMultiSessionGroup({
      name: 'Pair',
      refs: [piRef('s1'), piRef('s2')],
    })

    const updated = removeSessionFromGroup(group.id, piRef('s1'))

    expect(updated?.members).toHaveLength(1)
    expect(updated?.members[0].order).toBe(0)
    expect(updated?.members[0].ref).toMatchObject({ id: 's2' })
  })

  it('exports a source-neutral ledger snapshot', () => {
    const group = createMultiSessionGroup({ name: 'Snapshot', refs: [piRef('s1')] })
    blessSession(piRef('s1'))
    openGroupAsAsyncSlots(group.id)

    const snapshot = getMultiSessionLedgerSnapshot()

    expect(snapshot._tag).toBe('MultiSessionLedgerSnapshot')
    expect(snapshot.annotations).toHaveLength(1)
    expect(snapshot.groups).toHaveLength(1)
    expect(snapshot.slots).toHaveLength(1)
  })
})
