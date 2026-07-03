import vm from 'node:vm'

import { Context, Effect, Layer } from 'effect'

import { WorkflowRuntimeError } from '../domain/errors'
import type { WorkflowRunId } from '../domain/schemas'

export type WorkflowCoordinatorGlobals = {
  readonly phase: (name: string) => void | Promise<void>
  readonly log: (message: string, details?: unknown) => void | Promise<void>
  readonly agent: (prompt: string, options?: unknown) => Promise<unknown>
  readonly parallel: (tasks: ReadonlyArray<() => unknown | Promise<unknown>>, options?: unknown) => Promise<ReadonlyArray<unknown>>
  readonly pipeline: (
    items: ReadonlyArray<unknown>,
    stages: ReadonlyArray<(item: unknown, index: number) => unknown | Promise<unknown>>,
    options?: unknown,
  ) => Promise<ReadonlyArray<unknown>>
}

export type WorkflowScriptExecuteInput = {
  readonly runId: WorkflowRunId
  readonly script: string
  readonly input: unknown
  readonly globals: WorkflowCoordinatorGlobals
  readonly timeoutMs?: number
}

export type WorkflowScriptRunnerShape = {
  readonly execute: (input: WorkflowScriptExecuteInput) => Effect.Effect<unknown, WorkflowRuntimeError>
}

export class WorkflowScriptRunner extends Context.Service<WorkflowScriptRunner, WorkflowScriptRunnerShape>()(
  '@tmnl/pi-workflows/WorkflowScriptRunner',
) {
  static readonly vmLayer = Layer.succeed(WorkflowScriptRunner)({
    execute: Effect.fn('@tmnl/pi-workflows/WorkflowScriptRunner.vm.execute')(function* (input) {
      let workflow: WorkflowFunction
      try {
        workflow = compileWorkflowFunction(input.script, input.globals, input.timeoutMs ?? 1_000)
      } catch (cause) {
        return yield* Effect.fail(
          new WorkflowRuntimeError({
            message: 'Workflow script execution failed.',
            runId: input.runId,
            cause,
          }),
        )
      }

      return yield* Effect.tryPromise({
        try: () => Promise.resolve(workflow(input.input)),
        catch: (cause) =>
          new WorkflowRuntimeError({
            message: 'Workflow script execution failed.',
            runId: input.runId,
            cause,
          }),
      })
    }),
  })
}

export const WorkflowScriptRunnerVm = WorkflowScriptRunner.vmLayer

type WorkflowFunction = (input: unknown) => unknown | Promise<unknown>

function compileWorkflowFunction(
  source: string,
  globals: WorkflowCoordinatorGlobals,
  timeoutMs: number,
): WorkflowFunction {
  const transformed = transformWorkflowModule(source)
  const sandbox = makeSandbox(globals)
  const script = new vm.Script(`${transformed}\n; workflow`, {
    filename: 'pi-workflow.vm.js',
  })
  const workflow = script.runInNewContext(sandbox, {
    timeout: timeoutMs,
    displayErrors: true,
  })

  if (typeof workflow !== 'function') {
    throw new Error('Workflow script must export a default function.')
  }

  return workflow as WorkflowFunction
}

function transformWorkflowModule(source: string): string {
  assertNoTopLevelModuleAccess(source)

  let transformed = source.replace(/export\s+const\s+meta\s*=/g, 'const meta =')
  transformed = transformed.replace(/\s+as\s+const/g, '')

  transformed = transformed.replace(
    /export\s+default\s+async\s+function\s+workflow\s*\(/,
    'async function workflow(',
  )
  transformed = transformed.replace(/export\s+default\s+function\s+workflow\s*\(/, 'function workflow(')
  transformed = transformed.replace(/export\s+default\s+async\s+function\s*\(/, 'async function workflow(')
  transformed = transformed.replace(/export\s+default\s+function\s*\(/, 'function workflow(')
  transformed = transformed.replace(/export\s+default\s+async\s*\(/, 'const workflow = async (')
  transformed = transformed.replace(/export\s+default\s*\(/, 'const workflow = (')

  if (/export\s+default/.test(transformed)) {
    throw new Error('Unsupported default export shape. Use `export default async function workflow(input) { ... }`.')
  }

  return transformed
}

function assertNoTopLevelModuleAccess(source: string): void {
  const searchable = maskStringsAndComments(source)
  const banned = [
    /\bimport\s*(?:\(|[\w*{])/,
    /\brequire\s*\(/,
    /\bprocess\b/,
    /\bBun\b/,
    /\bDeno\b/,
    /\bchild_process\b/,
    /\bnode:/,
  ]

  for (const pattern of banned) {
    if (pattern.test(searchable)) {
      throw new Error(`Workflow script uses a banned API: ${pattern}`)
    }
  }
}

function maskStringsAndComments(source: string): string {
  let out = ''
  let index = 0
  let quote: '"' | "'" | '`' | null = null
  let escaped = false
  let lineComment = false
  let blockComment = false

  while (index < source.length) {
    const char = source[index]
    const next = source[index + 1]

    if (lineComment) {
      out += char === '\n' ? '\n' : ' '
      if (char === '\n') lineComment = false
      index++
      continue
    }

    if (blockComment) {
      out += char === '\n' ? '\n' : ' '
      if (char === '*' && next === '/') {
        out += ' '
        index += 2
        blockComment = false
      } else {
        index++
      }
      continue
    }

    if (quote) {
      out += char === '\n' ? '\n' : ' '
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        quote = null
      }
      index++
      continue
    }

    if (char === '/' && next === '/') {
      out += '  '
      index += 2
      lineComment = true
      continue
    }

    if (char === '/' && next === '*') {
      out += '  '
      index += 2
      blockComment = true
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      out += ' '
      quote = char
      index++
      continue
    }

    out += char
    index++
  }

  return out
}

function makeSandbox(globals: WorkflowCoordinatorGlobals): vm.Context {
  const restrictedMath = Object.freeze({
    ...Math,
    random: () => {
      throw new Error('Math.random() is unavailable inside workflow scripts.')
    },
  })

  const RestrictedDate = class extends Date {
    constructor(value?: string | number | Date) {
      if (arguments.length === 0) {
        throw new Error('Argless new Date() is unavailable inside workflow scripts.')
      }
      super(value as string | number | Date)
    }

    static override now(): number {
      throw new Error('Date.now() is unavailable inside workflow scripts.')
    }
  }

  return vm.createContext({
    phase: globals.phase,
    log: globals.log,
    agent: globals.agent,
    parallel: globals.parallel,
    pipeline: globals.pipeline,
    Math: restrictedMath,
    Date: RestrictedDate,
    Promise,
    Array,
    Object,
    String,
    Number,
    Boolean,
    JSON,
    console: undefined,
    process: undefined,
    require: undefined,
    Function: undefined,
    eval: undefined,
    Bun: undefined,
    Deno: undefined,
    setTimeout: undefined,
    setInterval: undefined,
    clearTimeout: undefined,
    clearInterval: undefined,
  })
}
