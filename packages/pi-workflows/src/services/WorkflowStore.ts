import { Context, Effect, Layer } from 'effect'
import { AtomRegistry } from 'effect/unstable/reactivity'

import type { WorkflowRun, WorkflowRunId } from '../domain/schemas'
import { workflowRunIndexAtom, workflowRunsAtom } from '../state/atoms'
import type { WorkflowStoreShape } from './types'

function upsertRun(runs: ReadonlyArray<WorkflowRun>, run: WorkflowRun): ReadonlyArray<WorkflowRun> {
  const index = runs.findIndex((candidate) => candidate.id === run.id)
  if (index === -1) {
    return [...runs, run]
  }

  return [...runs.slice(0, index), run, ...runs.slice(index + 1)]
}

export class WorkflowStore extends Context.Service<WorkflowStore, WorkflowStoreShape>()(
  '@tmnl/pi-workflows/WorkflowStore',
) {
  static readonly atomLayer = Layer.effect(
    WorkflowStore,
    Effect.gen(function* () {
      const registry = yield* AtomRegistry.AtomRegistry

      return WorkflowStore.of({
        upsertRun: Effect.fn('@tmnl/pi-workflows/WorkflowStore.atom.upsertRun')(function* (run) {
          registry.update(workflowRunsAtom, (runs) => upsertRun(runs, run))
        }),

        getRun: Effect.fn('@tmnl/pi-workflows/WorkflowStore.atom.getRun')(function* (runId) {
          return registry.get(workflowRunIndexAtom).get(runId)
        }),

        listRuns: Effect.fn('@tmnl/pi-workflows/WorkflowStore.atom.listRuns')(function* () {
          return registry.get(workflowRunsAtom)
        }),
      })
    }),
  )

  static readonly memoryLayer = Layer.sync(WorkflowStore, () => {
    const runs = new Map<WorkflowRunId, WorkflowRun>()

    return WorkflowStore.of({
      upsertRun: Effect.fn('@tmnl/pi-workflows/WorkflowStore.memory.upsertRun')(function* (run) {
        runs.set(run.id, run)
      }),

      getRun: Effect.fn('@tmnl/pi-workflows/WorkflowStore.memory.getRun')(function* (runId) {
        return runs.get(runId)
      }),

      listRuns: Effect.fn('@tmnl/pi-workflows/WorkflowStore.memory.listRuns')(function* () {
        return [...runs.values()]
      }),
    })
  })
}

export const WorkflowStoreAtom = WorkflowStore.atomLayer
export const WorkflowStoreMemory = WorkflowStore.memoryLayer
