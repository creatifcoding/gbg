import { Atom } from 'effect/unstable/reactivity'

import type { WorkflowRun, WorkflowRunId } from '../domain/schemas'

export const workflowRunsAtom = Atom.make<ReadonlyArray<WorkflowRun>>([])

export const workflowRunIndexAtom = Atom.make((get) => {
  const runs = get(workflowRunsAtom)
  return new Map<WorkflowRunId, WorkflowRun>(runs.map((run) => [run.id, run]))
})

export const workflowRunCountAtom = Atom.make((get) => get(workflowRunsAtom).length)
