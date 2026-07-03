import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, expect, it } from 'vitest'
import { Effect, Layer, ManagedRuntime } from 'effect'
import { AtomRegistry } from 'effect/unstable/reactivity'

import {
  SubagentAdapterFake,
  WorkflowCompilerLive,
  WorkflowJournal,
  WorkflowJournalJsonl,
  WorkflowRegistryLive,
  WorkflowRuntime,
  WorkflowRuntimeLive,
  WorkflowScriptRunnerVm,
  WorkflowStateLayer,
  makeWorkflowManagedRuntime,
} from '../src/services/index'

describe('same-session deterministic prefix replay', () => {
  it('replays completed agent calls by stable key on matching script/input digest', async () => {
    const runtime = makeWorkflowManagedRuntime()
    const script = `export const meta = { name: "resume-smoke", description: "resume" } as const\nexport default async function workflow(input) { return await agent('work ' + input.subject, { label: 'stable-call' }) }`

    try {
      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const workflows = yield* WorkflowRuntime
          const journal = yield* WorkflowJournal
          const first = yield* workflows.run({ script, input: { subject: 'alpha' } })
          const second = yield* workflows.run({ script, input: { subject: 'alpha' }, resume: true })
          const entries = yield* journal.entriesForRun(second.run.id)
          return { first, second, entries }
        }),
      )

      expect(result.first.result).toBe('[fake:stable-call] work alpha')
      expect(result.second.result).toBe('[fake:stable-call] work alpha')
      expect(result.second.run.calls[0]?.status).toBe('replayed')
      expect(result.entries).toContainEqual(
        expect.objectContaining({ _tag: 'AgentCallSucceeded', key: 'stable-call', replayed: true }),
      )
    } finally {
      await runtime.dispose()
    }
  })

  it('does not replay when input digest changes', async () => {
    const runtime = makeWorkflowManagedRuntime()
    const script = `export const meta = { name: "resume-input", description: "resume" } as const\nexport default async function workflow(input) { return await agent('work ' + input.subject, { label: 'stable-call' }) }`

    try {
      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const workflows = yield* WorkflowRuntime
          yield* workflows.run({ script, input: { subject: 'alpha' } })
          return yield* workflows.run({ script, input: { subject: 'beta' }, resume: true })
        }),
      )

      expect(result.result).toBe('[fake:stable-call] work beta')
      expect(result.run.calls[0]?.status).toBe('succeeded')
    } finally {
      await runtime.dispose()
    }
  })

  it('replays from a persisted JSONL journal across runtime instances', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pi-workflows-resume-'))
    const journalPath = join(dir, 'journal.jsonl')
    const script = `export const meta = { name: "resume-persisted", description: "resume" } as const\nexport default async function workflow() { return await agent('persisted', { label: 'persisted-call' }) }`

    const makeRuntime = () =>
      ManagedRuntime.make(
        WorkflowRuntimeLive.pipe(
          Layer.provideMerge(
            Layer.mergeAll(
              WorkflowRegistryLive,
              WorkflowCompilerLive,
              WorkflowJournalJsonl(journalPath),
              WorkflowStateLayer,
              WorkflowScriptRunnerVm,
              SubagentAdapterFake,
            ).pipe(Layer.provideMerge(AtomRegistry.layer)),
          ),
        ),
      )

    const firstRuntime = makeRuntime()
    try {
      await firstRuntime.runPromise(
        Effect.gen(function* () {
          const workflows = yield* WorkflowRuntime
          yield* workflows.run({ script })
        }),
      )
    } finally {
      await firstRuntime.dispose()
    }

    const secondRuntime = makeRuntime()
    try {
      const resumed = await secondRuntime.runPromise(
        Effect.gen(function* () {
          const workflows = yield* WorkflowRuntime
          return yield* workflows.run({ script, resume: true })
        }),
      )

      expect(resumed.run.calls[0]?.status).toBe('replayed')
    } finally {
      await secondRuntime.dispose()
      await rm(dir, { recursive: true, force: true })
    }
  })
})
