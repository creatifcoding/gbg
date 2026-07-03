import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'

import { WorkflowScriptRunner, makeWorkflowManagedRuntime } from '../src/services/index'
import { decodeRunId } from '../src/services/utils'

const globals = {
  phase: () => undefined,
  log: () => undefined,
  agent: async () => 'agent',
  parallel: async () => [],
  pipeline: async () => [],
}

describe('restricted workflow script runner', () => {
  it('executes a default workflow function with controlled globals', async () => {
    const runtime = makeWorkflowManagedRuntime()

    try {
      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const runner = yield* WorkflowScriptRunner
          return yield* runner.execute({
            runId: decodeRunId('run-script-smoke'),
            input: { subject: 'tmnl' },
            script: `export const meta = { name: "runner", description: "runner" } as const\nexport default async function workflow(input) { phase('run'); log('seen', input); return input.subject }`,
            globals,
          })
        }),
      )

      expect(result).toBe('tmnl')
    } finally {
      await runtime.dispose()
    }
  })

  it('blocks direct process access', async () => {
    const runtime = makeWorkflowManagedRuntime()

    try {
      await expect(
        runtime.runPromise(
          Effect.gen(function* () {
            const runner = yield* WorkflowScriptRunner
            return yield* runner.execute({
              runId: decodeRunId('run-script-block'),
              input: null,
              script: `export const meta = { name: "bad", description: "bad" } as const\nexport default async function workflow() { return process.cwd() }`,
              globals,
            })
          }),
        ),
      ).rejects.toThrow(/Workflow script execution failed/)
    } finally {
      await runtime.dispose()
    }
  })

  it('allows banned words inside strings while blocking real APIs', async () => {
    const runtime = makeWorkflowManagedRuntime()

    try {
      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const runner = yield* WorkflowScriptRunner
          return yield* runner.execute({
            runId: decodeRunId('run-script-string-safe'),
            input: null,
            script: `export const meta = { name: "strings", description: "strings" } as const\nexport default async function workflow() { return 'process node: require Bun Deno import' }`,
            globals,
          })
        }),
      )

      expect(result).toBe('process node: require Bun Deno import')
    } finally {
      await runtime.dispose()
    }
  })

  it('blocks nondeterministic Date.now and Math.random at runtime', async () => {
    const runtime = makeWorkflowManagedRuntime()

    try {
      for (const script of [
        `export const meta = { name: "date", description: "date" } as const\nexport default async function workflow() { return Date.now() }`,
        `export const meta = { name: "random", description: "random" } as const\nexport default async function workflow() { return Math.random() }`,
      ]) {
        await expect(
          runtime.runPromise(
            Effect.gen(function* () {
              const runner = yield* WorkflowScriptRunner
              return yield* runner.execute({
                runId: decodeRunId('run-script-nondeterminism'),
                input: null,
                script,
                globals,
              })
            }),
          ),
        ).rejects.toThrow(/Workflow script execution failed/)
      }
    } finally {
      await runtime.dispose()
    }
  })
})
