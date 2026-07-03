import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'

import { WorkflowRegistry, WorkflowRuntime, makeWorkflowManagedRuntime } from '../src/services/index'

describe('project/user workflow discovery', () => {
  it('discovers workflow files from PI_WORKFLOWS_DIR and runs by meta name', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pi-workflows-discovery-'))
    const previous = process.env.PI_WORKFLOWS_DIR
    process.env.PI_WORKFLOWS_DIR = dir

    await writeFile(
      join(dir, 'hello.workflow.ts'),
      `export const meta = { name: "discovered-hello", description: "Discovered" } as const\nexport default async function workflow(input) { phase('hello'); return await agent('hello ' + input.name, { label: 'hello-agent' }) }`,
      'utf8',
    )

    const runtime = makeWorkflowManagedRuntime()
    try {
      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const registry = yield* WorkflowRegistry
          const sources = yield* registry.listSources()
          const workflows = yield* WorkflowRuntime
          const run = yield* workflows.run({ name: 'discovered-hello', input: { name: 'Prime' } })
          return { sources, run }
        }),
      )

      expect(result.sources).toHaveLength(1)
      expect(result.sources[0]?.kind).toBe('path')
      expect(result.run.descriptor.meta.name).toBe('discovered-hello')
      expect(result.run.result).toBe('[fake:hello-agent] hello Prime')
    } finally {
      await runtime.dispose()
      if (previous === undefined) delete process.env.PI_WORKFLOWS_DIR
      else process.env.PI_WORKFLOWS_DIR = previous
      await rm(dir, { recursive: true, force: true })
    }
  })
})
