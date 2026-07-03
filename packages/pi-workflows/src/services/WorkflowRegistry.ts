import { readdir, readFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'

import { Context, Effect, Layer } from 'effect'

import { WorkflowContractError, WorkflowDiscoveryError } from '../domain/errors'
import type { WorkflowSource } from '../domain/schemas'
import { extractLiteralMeta } from './meta-literal'
import type { WorkflowRegistryShape, WorkflowRequest } from './types'
import { decodeWorkflowSource, digestString } from './utils'

function workflowSearchDirs(): ReadonlyArray<string> {
  const envDirs = process.env.PI_WORKFLOWS_DIR?.split(':').filter(Boolean) ?? []
  return [
    ...envDirs,
    join(process.cwd(), '.pi', 'workflows'),
    join(process.cwd(), '.claude', 'workflows'),
    join(process.cwd(), 'workflows'),
  ].map((path) => resolve(path))
}

function discoverWorkflows(): Effect.Effect<ReadonlyArray<DiscoveredWorkflow>, WorkflowDiscoveryError> {
  return Effect.tryPromise({
    try: async () => {
      const discovered: DiscoveredWorkflow[] = []
      for (const dir of workflowSearchDirs()) {
        for (const file of await listWorkflowFiles(dir)) {
          const script = await readFile(file, 'utf8')
          const source = decodeWorkflowSource({
            kind: 'path',
            value: file,
            digest: digestString(script),
          })
          discovered.push({
            source,
            name: workflowNameForFile(file, script),
          })
        }
      }
      return discovered
    },
    catch: (cause) =>
      new WorkflowDiscoveryError({
        message: 'Failed to discover saved workflows.',
        cause,
      }),
  })
}

async function listWorkflowFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const files = await Promise.all(
      entries.map(async (entry) => {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) return await listWorkflowFiles(path)
        if (!entry.isFile() || !WORKFLOW_EXTENSIONS.has(extname(entry.name))) return []
        return [path]
      }),
    )
    return files.flat().sort((a, b) => a.localeCompare(b))
  } catch (error) {
    if (isNotFound(error)) return []
    throw error
  }
}

function workflowNameForFile(file: string, script: string): string {
  try {
    return String(extractLiteralMeta(script).name)
  } catch {
    return basename(file, extname(file))
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'ENOENT'
}

function selectedRequestSource(request: WorkflowRequest): ReadonlyArray<'name' | 'path' | 'inline'> {
  return [
    request.name ? 'name' : undefined,
    request.path ? 'path' : undefined,
    request.script ? 'inline' : undefined,
  ].filter(Boolean) as ReadonlyArray<'name' | 'path' | 'inline'>
}

type DiscoveredWorkflow = {
  readonly source: WorkflowSource
  readonly name: string
}

const WORKFLOW_EXTENSIONS = new Set(['.js', '.mjs', '.ts', '.mts'])

export class WorkflowRegistry extends Context.Service<WorkflowRegistry, WorkflowRegistryShape>()(
  '@tmnl/pi-workflows/WorkflowRegistry',
) {
  static readonly layer = Layer.succeed(WorkflowRegistry)({
    listSources: Effect.fn('@tmnl/pi-workflows/WorkflowRegistry.listSources')(function* () {
      const workflows = yield* discoverWorkflows()
      return workflows.map((workflow) => workflow.source)
    }),

    resolveSource: Effect.fn('@tmnl/pi-workflows/WorkflowRegistry.resolveSource')(function* (request) {
      const selected = selectedRequestSource(request)

      if (selected.length !== 1) {
        return yield* Effect.fail(
          new WorkflowContractError({
            message: 'Choose exactly one workflow source: name, path, or script.',
            field: 'name|path|script',
          }),
        )
      }

      if (request.script) {
        return decodeWorkflowSource({
          kind: 'inline',
          value: request.script,
          digest: digestString(request.script),
        }) satisfies WorkflowSource
      }

      if (request.path) {
        return decodeWorkflowSource({
          kind: 'path',
          value: resolve(request.path),
        }) satisfies WorkflowSource
      }

      const workflows = yield* discoverWorkflows()
      const match = workflows.find((workflow) => workflow.name === request.name)
      if (match) return match.source

      return yield* Effect.fail(
        new WorkflowDiscoveryError({
          message: `No saved workflow named '${request.name ?? 'unknown'}' was found.`,
          path: request.name,
        }),
      )
    }),
  })
}

export const WorkflowRegistryLive = WorkflowRegistry.layer
