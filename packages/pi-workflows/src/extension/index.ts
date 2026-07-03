import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { Text } from '@earendil-works/pi-tui'
import { Effect } from 'effect'
import { Type } from 'typebox'

import { decodeRunId, makeWorkflowManagedRuntime, WorkflowRegistry, WorkflowRuntime, WorkflowStore } from '../services/index'
import { EXTENSION_NAME } from './constants'

type WorkflowToolParams = {
  readonly name?: string
  readonly script?: string
  readonly path?: string
  readonly input?: unknown
  readonly resume?: boolean
  readonly dryRun?: boolean
}

type WorkflowToolDetails = {
  readonly extension: typeof EXTENSION_NAME
  readonly valid: boolean
  readonly source: string
  readonly mode?: string
  readonly result?: unknown
  readonly resume?: boolean
  readonly error?: unknown
}

const WorkflowToolParameters = Type.Object({
  name: Type.Optional(Type.String({ description: 'Saved workflow name to run.' })),
  script: Type.Optional(Type.String({ description: 'Inline workflow script source.' })),
  path: Type.Optional(Type.String({ description: 'Explicit workflow file path.' })),
  input: Type.Optional(Type.Unknown({ description: 'JSON-serializable workflow input.' })),
  resume: Type.Optional(Type.Boolean({ description: 'Attempt same-session prefix replay.' })),
  dryRun: Type.Optional(Type.Boolean({ description: 'Parse/validate only; do not run child agents.' })),
})

function selectedSource(params: WorkflowToolParams): string {
  const selected = [
    params.name ? `name:${params.name}` : undefined,
    params.path ? `path:${params.path}` : undefined,
    params.script ? 'inline-script' : undefined,
  ].filter(Boolean)

  if (selected.length !== 1) {
    return 'invalid-source-selection'
  }

  return selected[0] ?? 'invalid-source-selection'
}

function registerWorkflowTool(pi: ExtensionAPI, runtime: ReturnType<typeof makeWorkflowManagedRuntime>): void {
  pi.registerTool({
    name: 'workflow',
    label: 'Workflow',
    description: 'Run or inspect a Pi workflow script through the Effect v4 workflow runtime.',
    parameters: WorkflowToolParameters,
    async execute(_toolCallId, params: WorkflowToolParams, _signal, _onUpdate, ctx) {
      const source = selectedSource(params)
      if (source === 'invalid-source-selection') {
        const details: WorkflowToolDetails = { extension: EXTENSION_NAME, valid: false, source }
        return {
          content: [{ type: 'text', text: `[${EXTENSION_NAME}] choose exactly one of name, path, or script.` }],
          details,
        }
      }

      try {
        if (params.dryRun) {
          const descriptor = await runtime.runPromise(
            Effect.gen(function* () {
              const workflows = yield* WorkflowRuntime
              return yield* workflows.dryRun(params)
            }),
          )
          const details: WorkflowToolDetails = {
            extension: EXTENSION_NAME,
            valid: true,
            mode: 'dry-run',
            source,
            result: descriptor,
            resume: params.resume === true,
          }
          return {
            content: [{ type: 'text', text: `[${EXTENSION_NAME}] dry-run ok: ${descriptor.meta.name}` }],
            details,
          }
        }

        const approved = await requestLaunchApproval(ctx, source, params)
        if (!approved) {
          const details: WorkflowToolDetails = {
            extension: EXTENSION_NAME,
            valid: false,
            mode: 'cancelled',
            source,
          }
          return {
            content: [{ type: 'text', text: `[${EXTENSION_NAME}] launch cancelled.` }],
            details,
          }
        }

        const runResult = await runtime.runPromise(
          Effect.gen(function* () {
            const workflows = yield* WorkflowRuntime
            return yield* workflows.run(params)
          }),
        )
        const details: WorkflowToolDetails = {
          extension: EXTENSION_NAME,
          valid: true,
          mode: 'run',
          source,
          result: runResult,
          resume: params.resume === true,
        }
        return {
          content: [
            {
              type: 'text',
              text: `[${EXTENSION_NAME}] run ok: ${runResult.descriptor.meta.name} (${runResult.run.id})`,
            },
          ],
          details,
        }
      } catch (error) {
        const details: WorkflowToolDetails = {
          extension: EXTENSION_NAME,
          valid: false,
          mode: params.dryRun ? 'dry-run' : 'run',
          source,
          error,
        }
        return {
          content: [{ type: 'text', text: `[${EXTENSION_NAME}] workflow failed: ${formatError(error)}` }],
          details,
        }
      }
    },

    renderResult(result, _options, theme) {
      const details = result.details as WorkflowToolDetails | undefined
      return new Text(renderWorkflowToolLines(details, theme).join('\n'), 0, 0)
    },
  })
}

async function requestLaunchApproval(
  ctx: { readonly hasUI?: boolean; readonly ui?: { readonly confirm?: (title: string, message: string) => Promise<boolean> | boolean } },
  source: string,
  params: WorkflowToolParams,
): Promise<boolean> {
  if (params.dryRun) return true
  if (ctx.hasUI === false) return true
  if (typeof ctx.ui?.confirm !== 'function') return true
  return await ctx.ui.confirm(
    'Launch Pi workflow?',
    `Source: ${source}\nResume: ${params.resume === true ? 'yes' : 'no'}\n\nWorkflow scripts can launch subagents. Continue?`,
  )
}

function renderWorkflowToolLines(
  details: WorkflowToolDetails | undefined,
  theme: { fg: (role: any, text: string) => string; bold: (text: string) => string },
): ReadonlyArray<string> {
  if (!details) {
    return [theme.fg('muted', 'No workflow details returned.')]
  }

  const result = details.result as
    | { readonly run?: { readonly id?: string; readonly status?: string; readonly calls?: ReadonlyArray<unknown> }; readonly descriptor?: { readonly meta?: { readonly name?: string } } }
    | { readonly meta?: { readonly name?: string } }
    | undefined
  const hasDescriptor = isRecord(result) && 'descriptor' in result
  const hasRun = isRecord(result) && 'run' in result
  const workflowName = hasDescriptor
    ? (result as { readonly descriptor?: { readonly meta?: { readonly name?: string } } }).descriptor?.meta?.name
    : (result as { readonly meta?: { readonly name?: string } } | undefined)?.meta?.name
  const run = hasRun
    ? (result as { readonly run?: { readonly id?: string; readonly status?: string; readonly calls?: ReadonlyArray<unknown> } }).run
    : undefined

  return [
    theme.fg(details.valid ? 'success' : 'error', theme.bold(`Pi Workflow · ${details.mode ?? 'unknown'}`)),
    theme.fg('muted', `source: ${details.source}`),
    ...(workflowName ? [theme.fg('text', `workflow: ${workflowName}`)] : []),
    ...(run?.id ? [theme.fg('text', `run: ${run.id}`)] : []),
    ...(run?.status ? [theme.fg('text', `status: ${run.status}`)] : []),
    ...(run?.calls ? [theme.fg('muted', `agent calls: ${run.calls.length}`), ...renderProgressTree(run.calls, theme)] : []),
    ...(details.error ? [theme.fg('error', `error: ${formatError(details.error)}`)] : []),
  ]
}

function renderProgressTree(
  calls: ReadonlyArray<unknown>,
  theme: { fg: (role: any, text: string) => string; bold: (text: string) => string },
): ReadonlyArray<string> {
  if (calls.length === 0) return []
  const visible = calls.slice(0, 6)
  return [
    theme.fg('muted', 'progress'),
    ...visible.map((call, index) => {
      const branch = index === visible.length - 1 && calls.length <= visible.length ? '└─' : '├─'
      const record = isRecord(call) ? call : {}
      const key = typeof record.key === 'string' ? record.key : `call-${index + 1}`
      const status = typeof record.status === 'string' ? record.status : 'unknown'
      const phase = typeof record.phase === 'string' ? ` · ${record.phase}` : ''
      return theme.fg(status === 'failed' ? 'error' : status === 'replayed' ? 'accent' : 'text', `${branch} ${key} [${status}]${phase}`)
    }),
    ...(calls.length > visible.length ? [theme.fg('muted', `└─ … ${calls.length - visible.length} more`)] : []),
  ]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function registerWorkflowsCommand(pi: ExtensionAPI, runtime: ReturnType<typeof makeWorkflowManagedRuntime>): void {
  pi.registerCommand('workflows', {
    description: 'List, inspect, run, or resume Pi workflows',
    handler: async (args, ctx) => {
      const trimmed = args.trim()
      const [subcommand = 'list', ...rest] = trimmed.length > 0 ? trimmed.split(/\s+/) : ['list']

      switch (subcommand) {
        case 'list': {
          const state = await runtime.runPromise(
            Effect.gen(function* () {
              const registry = yield* WorkflowRegistry
              const store = yield* WorkflowStore
              const sources = yield* registry.listSources()
              const runs = yield* store.listRuns()
              return { sources, runs }
            }),
          )
          ctx.ui.notify(
            `${state.sources.length} saved workflows discovered; ${state.runs.length} run(s) in memory.`,
            'info',
          )
          return
        }
        case 'inspect': {
          const id = rest[0]
          if (!id) {
            ctx.ui.notify('Usage: /workflows inspect <runId>', 'warning')
            return
          }
          const run = await runtime.runPromise(
            Effect.gen(function* () {
              const store = yield* WorkflowStore
              return yield* store.getRun(decodeRunId(id))
            }),
          )
          ctx.ui.notify(
            run
              ? `Workflow run ${run.id}: ${run.workflowName} · ${run.status} · ${run.calls.length} call(s)`
              : `No in-memory workflow run found for ${id}.`,
            run ? 'info' : 'warning',
          )
          return
        }
        case 'run': {
          const name = rest[0]
          if (!name) {
            ctx.ui.notify('Usage: /workflows run <name>', 'warning')
            return
          }
          try {
            const result = await runtime.runPromise(
              Effect.gen(function* () {
                const workflows = yield* WorkflowRuntime
                return yield* workflows.run({ name })
              }),
            )
            ctx.ui.notify(`Workflow run ${result.run.id} completed: ${result.descriptor.meta.name}`, 'info')
          } catch (error) {
            ctx.ui.notify(`Workflow run failed: ${formatError(error)}`, 'error')
          }
          return
        }
        case 'resume': {
          const runId = rest[0]
          if (!runId) {
            ctx.ui.notify('Usage: /workflows resume <runId>', 'warning')
            return
          }
          const run = await runtime.runPromise(
            Effect.gen(function* () {
              const store = yield* WorkflowStore
              return yield* store.getRun(decodeRunId(runId))
            }),
          )
          ctx.ui.notify(
            run
              ? `Resume candidate found for ${run.workflowName}. Re-run the same workflow with resume: true to replay completed calls.`
              : `No in-memory workflow run found for ${runId}.`,
            run ? 'info' : 'warning',
          )
          return
        }
        default:
          ctx.ui.notify('Usage: /workflows [list|inspect <name>|run <name>|resume <runId>]', 'warning')
      }
    },
  })
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { readonly message: unknown }).message)
  }
  return String(error)
}

export default function piWorkflowsExtension(pi: ExtensionAPI): void {
  const runtime = makeWorkflowManagedRuntime()

  registerWorkflowTool(pi, runtime)
  registerWorkflowsCommand(pi, runtime)

  pi.on('session_start', async (_event, ctx) => {
    ctx.ui.setStatus(EXTENSION_NAME, 'workflow runtime loaded')
  })

  pi.on('session_shutdown', async (_event, ctx) => {
    ctx.ui.setStatus(EXTENSION_NAME, undefined)
    await runtime.dispose()
  })
}
