import { readFile } from 'node:fs/promises'

import { Context, Effect, Layer } from 'effect'
import * as Schema from 'effect/Schema'

import { WorkflowCompileError, WorkflowContractError } from '../domain/errors'
import { WorkflowDescriptor, WorkflowMeta, type WorkflowDescriptor as WorkflowDescriptorType } from '../domain/schemas'
import { extractLiteralMeta } from './meta-literal'
import type { CompiledWorkflow, WorkflowCompilerShape } from './types'
import { decodeDigest, decodeWorkflowName, digestString } from './utils'

function descriptorForScript(
  source: Parameters<WorkflowCompilerShape['inspect']>[0],
  script: string,
): WorkflowDescriptorType {
  const meta = extractLiteralMeta(script)

  return Schema.decodeUnknownSync(WorkflowDescriptor)({
    meta,
    source: {
      ...source,
      digest: source.digest ?? digestString(script),
    },
    discoveredAt: Date.now(),
  })
}

function inspectInlineSource(source: Parameters<WorkflowCompilerShape['inspect']>[0]): WorkflowDescriptorType {
  if (source.kind === 'inline') return descriptorForScript(source, source.value)
  return Schema.decodeUnknownSync(WorkflowDescriptor)({
    meta: Schema.decodeUnknownSync(WorkflowMeta)({
      name: source.kind === 'path' ? source.value.split('/').pop()?.replace(/\.[^.]+$/, '') || 'path-workflow' : source.value,
      description: `${source.kind} workflow`,
    }),
    source: {
      ...source,
      digest: source.digest ?? decodeDigest(`unhashed-${source.kind}-${source.value}`),
    },
    discoveredAt: Date.now(),
  })
}

function loadScript(source: Parameters<WorkflowCompilerShape['compile']>[0]) {
  if (source.kind === 'inline') return Effect.succeed(source.value)
  if (source.kind === 'path') {
    return Effect.tryPromise({
      try: () => readFile(source.value, 'utf8'),
      catch: (cause) =>
        new WorkflowCompileError({
          message: `Failed to read workflow file: ${source.value}`,
          cause,
        }),
    })
  }
  return Effect.fail(
    new WorkflowCompileError({
      message: `Compilation for ${source.kind} workflow sources is deferred.`,
      workflowName: decodeWorkflowName(source.value),
    }),
  )
}

export class WorkflowCompiler extends Context.Service<WorkflowCompiler, WorkflowCompilerShape>()(
  '@tmnl/pi-workflows/WorkflowCompiler',
) {
  static readonly layer = Layer.succeed(WorkflowCompiler)({
    inspect: Effect.fn('@tmnl/pi-workflows/WorkflowCompiler.inspect')(function* (source) {
      const script = source.kind === 'inline' || source.kind === 'path' ? yield* loadScript(source) : undefined
      try {
        return script === undefined ? inspectInlineSource(source) : descriptorForScript(source, script)
      } catch (cause) {
        return yield* Effect.fail(
          new WorkflowContractError({
            message: 'Workflow metadata did not match the V0 contract.',
            cause,
          }),
        )
      }
    }),

    compile: Effect.fn('@tmnl/pi-workflows/WorkflowCompiler.compile')(function* (source) {
      const script = yield* loadScript(source)
      const descriptor = descriptorForScript(source, script)
      return {
        descriptor,
        script,
      } satisfies CompiledWorkflow
    }),
  })
}

export const WorkflowCompilerLive = WorkflowCompiler.layer
