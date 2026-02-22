import { Type } from '@sinclair/typebox'
import { getSourceLogger } from '../shared/logging/index.ts'

type ExtensionAPI = {
  registerTool: (tool: {
    name: string
    label?: string
    description?: string
    parameters: unknown
    execute: (
      toolCallId: string,
      params: Record<string, unknown>,
      signal: AbortSignal,
      onUpdate?: (update: { content: Array<{ type: string; text: string }> }) => void,
      ctx?: unknown,
    ) => Promise<{ content: Array<{ type: string; text: string }>; details?: unknown; isError?: boolean }>
  }) => void
  registerCommand: (
    name: string,
    command: {
      description?: string
      handler: (
        args: string | undefined,
        ctx: {
          hasUI: boolean
          ui: {
            notify: (message: string, level: 'info' | 'success' | 'warning' | 'error') => void
          }
        },
      ) => Promise<void> | void
    },
  ) => void
}
import { Registry } from '@effect-atom/atom-react'
import * as Result from '@effect-atom/atom/Result'
import { Schema } from 'effect'
import {
  hypothesisLabRuntimeAtom,
  hypothesisLabOps,
  runAtom,
  hypothesesAtom,
  compiledPlanAtom,
  evidenceAtom,
  matrixAtom,
  verdictAtom,
  replayReportAtom,
  auditEventsAtom,
  statusAtom,
  errorMessageAtom,
} from '../../../src/lib/hypothesis-lab/v1'

const FINALIZE_OVERRIDE_PHRASE = 'I_ACKNOWLEDGE_EISENHOWER_OVERRIDE'

const logger = getSourceLogger('eisenhower')

function log(level: 'debug' | 'info' | 'warn' | 'error', message: string) {
  logger.emit(level, message)
}

const CreateRunInput = Schema.Struct({
  actor: Schema.NonEmptyString,
  context: Schema.String,
  hypothesisAStatement: Schema.NonEmptyString,
  hypothesisAAssumptions: Schema.optional(Schema.Array(Schema.String)),
  hypothesisBStatement: Schema.NonEmptyString,
  hypothesisBAssumptions: Schema.optional(Schema.Array(Schema.String)),
})

type CreateRunInput = typeof CreateRunInput.Type

const CompilePlanInput = Schema.Struct({
  actor: Schema.NonEmptyString,
})

type CompilePlanInput = typeof CompilePlanInput.Type

const EmptyInput = Schema.Struct({})

const RatifyPhase1Input = Schema.Struct({
  actor: Schema.NonEmptyString,
  rationale: Schema.NonEmptyString,
  acknowledgeConflict: Schema.optional(Schema.Boolean),
  dualRunConsistent: Schema.optional(Schema.Boolean),
})

type RatifyPhase1Input = typeof RatifyPhase1Input.Type

const RatifyPhase2Input = Schema.Struct({
  actor: Schema.NonEmptyString,
  rationale: Schema.NonEmptyString,
  humanSignoff: Schema.optional(Schema.Boolean),
})

type RatifyPhase2Input = typeof RatifyPhase2Input.Type

const StatusInput = Schema.Struct({
  includeAuditTail: Schema.optional(Schema.Number),
})

type StatusInput = typeof StatusInput.Type

const ArtifactPackInput = Schema.Struct({
  profile: Schema.optional(Schema.NonEmptyString),
  includeExamples: Schema.optional(Schema.Boolean),
  runId: Schema.optional(Schema.String),
})

type ArtifactPackInput = typeof ArtifactPackInput.Type

const RunStrictInput = Schema.Struct({
  actor: Schema.NonEmptyString,
  context: Schema.String,
  hypothesisAStatement: Schema.NonEmptyString,
  hypothesisAAssumptions: Schema.optional(Schema.Array(Schema.String)),
  hypothesisBStatement: Schema.NonEmptyString,
  hypothesisBAssumptions: Schema.optional(Schema.Array(Schema.String)),
  phase1Actor: Schema.optional(Schema.NonEmptyString),
  phase1Rationale: Schema.optional(Schema.NonEmptyString),
  acknowledgeConflict: Schema.optional(Schema.Boolean),
  dualRunConsistent: Schema.optional(Schema.Boolean),
  phase2Actor: Schema.optional(Schema.NonEmptyString),
  phase2Rationale: Schema.optional(Schema.NonEmptyString),
  humanSignoff: Schema.optional(Schema.Boolean),
  requireReplayPass: Schema.optional(Schema.Boolean),
  requireZeroStrictDrift: Schema.optional(Schema.Boolean),
})

type RunStrictInput = typeof RunStrictInput.Type

const OverrideFinalizeInput = Schema.Struct({
  actor: Schema.NonEmptyString,
  rationale: Schema.NonEmptyString,
  runId: Schema.optional(Schema.String),
  confirmPhrase: Schema.optional(Schema.NonEmptyString),
})

type OverrideFinalizeInput = typeof OverrideFinalizeInput.Type

type Snapshot = {
  readonly runId: string | null
  readonly runContext: string | null
  readonly status: string
  readonly planId: string | null
  readonly hypothesisCount: number
  readonly evidenceCount: number
  readonly matrixId: string | null
  readonly winner: string | null
  readonly ratificationPhase: string | null
  readonly ratified: boolean
  readonly ratifiedBy: string | null
  readonly replayStatus: string | null
  readonly strictDriftCount: number | null
  readonly tolerantDriftCount: number | null
  readonly replayId: string | null
  readonly auditEventCount: number
  readonly errorMessage: string | null
  readonly overrideActive: boolean
  readonly overrideId: string | null
}

type OverrideRecord = {
  readonly overrideId: string
  readonly runId: string
  readonly actor: string
  readonly rationale: string
  readonly createdAt: number
  readonly confirmPhrase: string
}

const finalizeOverrides = new Map<string, OverrideRecord>()

const registry = Registry.make()

const mountedAtoms: ReadonlyArray<unknown> = [
  hypothesisLabRuntimeAtom,
  runAtom,
  hypothesesAtom,
  compiledPlanAtom,
  evidenceAtom,
  matrixAtom,
  verdictAtom,
  replayReportAtom,
  auditEventsAtom,
  statusAtom,
  errorMessageAtom,
  hypothesisLabOps.createRun,
  hypothesisLabOps.compileDefaultPlan,
  hypothesisLabOps.runValidation,
  hypothesisLabOps.draftVerdict,
  hypothesisLabOps.ratifyVerdict,
  hypothesisLabOps.replay,
]

for (const atom of mountedAtoms) {
  registry.mount(atom as never)
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

async function waitForOperationResult<A>(
  atom: unknown,
  timeoutMs = 15_000,
): Promise<Result.Result<A, unknown>> {
  const startedAt = Date.now()

  while (true) {
    const result = registry.get(atom as never) as Result.Result<A, unknown>
    if (!Result.isWaiting(result)) {
      return result
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for operation result after ${timeoutMs}ms`)
    }

    await sleep(10)
  }
}

async function runOp<A>(
  atom: unknown,
  input: unknown,
  label: string,
): Promise<A> {
  log('debug', `${label}:start`)
  registry.set(atom as never, input as never)

  const result = await waitForOperationResult<A>(atom)
  if (Result.isSuccess(result)) {
    log('info', `${label}:ok`)
    return result.value
  }

  const fallback = registry.get(errorMessageAtom)
  const failure = fallback ?? `${label} failed`
  log('error', `${label}:fail ${failure}`)
  throw new Error(failure)
}

function decodeInput<A>(
  schema: Schema.Schema<A>,
  params: unknown,
  toolName: string,
):
  | { readonly ok: true; readonly value: A; readonly message: string }
  | { readonly ok: false; readonly value: null; readonly message: string } {
  try {
    const value = Schema.decodeUnknownSync(schema)(params)
    return { ok: true, value, message: '' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log('warn', `invalid-input ${toolName}: ${message}`)
    return { ok: false, value: null, message: `Invalid ${toolName} input: ${message}` }
  }
}

function snapshotState(): Snapshot {
  const run = registry.get(runAtom)
  const plan = registry.get(compiledPlanAtom)
  const hypotheses = registry.get(hypothesesAtom)
  const evidence = registry.get(evidenceAtom)
  const matrix = registry.get(matrixAtom)
  const verdict = registry.get(verdictAtom)
  const replay = registry.get(replayReportAtom)
  const auditEvents = registry.get(auditEventsAtom)
  const status = registry.get(statusAtom)
  const errorMessage = registry.get(errorMessageAtom)
  const override = run?.id ? finalizeOverrides.get(run.id) : undefined

  return {
    runId: run?.id ?? null,
    runContext: run?.context ?? null,
    status,
    planId: plan?.planId ?? null,
    hypothesisCount: hypotheses.length,
    evidenceCount: evidence.length,
    matrixId: matrix?.id ?? null,
    winner: verdict?.winner ?? null,
    ratificationPhase: verdict?.ratificationPhase ?? null,
    ratified: verdict?.ratified ?? false,
    ratifiedBy: verdict?.ratifiedBy ?? null,
    replayStatus: replay?.status ?? null,
    strictDriftCount: replay?.strictDriftCount ?? null,
    tolerantDriftCount: replay?.tolerantDriftCount ?? null,
    replayId: replay?.replayId ?? null,
    auditEventCount: auditEvents.length,
    errorMessage,
    overrideActive: override !== undefined,
    overrideId: override?.overrideId ?? null,
  }
}

function formatStatus(snapshot: Snapshot, includeAuditTail?: number): string {
  if (!snapshot.runId) {
    return 'Eisenhower Decision OS: no active run.'
  }

  const auditTail = includeAuditTail && includeAuditTail > 0
    ? registry
      .get(auditEventsAtom)
      .slice(Math.max(0, registry.get(auditEventsAtom).length - includeAuditTail))
      .map((event) => event._tag)
      .join(', ')
    : null

  return [
    `Eisenhower Decision OS status: ${snapshot.status}`,
    `runId=${snapshot.runId}`,
    `planId=${snapshot.planId ?? 'n/a'}`,
    `winner=${snapshot.winner ?? 'n/a'} phase=${snapshot.ratificationPhase ?? 'n/a'} ratified=${snapshot.ratified}`,
    `replay=${snapshot.replayStatus ?? 'n/a'} strict=${snapshot.strictDriftCount ?? 0} tolerant=${snapshot.tolerantDriftCount ?? 0}`,
    `events=${snapshot.auditEventCount} evidence=${snapshot.evidenceCount}`,
    snapshot.overrideActive
      ? `override=active id=${snapshot.overrideId ?? 'n/a'}`
      : 'override=none',
    snapshot.errorMessage ? `error=${snapshot.errorMessage}` : null,
    auditTail ? `auditTail=${auditTail}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n')
}

function buildArtifactPack(snapshot: Snapshot, input: ArtifactPackInput) {
  const profile = input.profile ?? 'default-strict'
  const runRef = input.runId ?? snapshot.runId ?? 'pending-run'

  return {
    generatedAt: new Date().toISOString(),
    profile,
    runRef,
    promptTemplates: [
      {
        id: 'eisenhower.strict.run.v1',
        title: 'Strict Run Orchestrator Prompt',
        template: [
          'Execute a deterministic Eisenhower Decision OS run.',
          'Keep all trust gates enforced.',
          'If strict replay drift > 0, stop and require explicit override.',
        ].join(' '),
      },
      {
        id: 'eisenhower.override.request.v1',
        title: 'Override Request Prompt',
        template: [
          'Request explicit finalize override for run {{runId}}.',
          'Actor: {{actor}}',
          'Rationale: {{rationale}}',
          `Confirm phrase: ${FINALIZE_OVERRIDE_PHRASE}`,
        ].join('\n'),
      },
    ],
    decisionFrames: [
      {
        id: 'aggregate-vs-eisenhower',
        description: 'Frame conflicts between weighted aggregate and Eisenhower quadrant outcomes.',
      },
      {
        id: 'phase-gate-ratification',
        description: 'Two-phase ratification with explicit conflict acknowledgement and human signoff.',
      },
    ],
    playbooks: [
      {
        id: 'strict-default',
        steps: [
          'create_run',
          'compile_plan',
          'run_validation',
          'draft_verdict',
          'ratify_phase1',
          'ratify_phase2',
          'replay',
        ],
      },
      {
        id: 'explicit-override',
        steps: [
          'status',
          'override_finalize',
          'status',
        ],
      },
    ],
    guardrailPolicies: [
      {
        id: 'strict-finalization-default',
        policy: 'Replay must pass and strict drift must be zero unless override is explicitly recorded.',
      },
      {
        id: 'dual-run-consistency-required',
        policy: 'Phase 1 ratification requires dualRunConsistent=true.',
      },
      {
        id: 'human-signoff-required',
        policy: 'Phase 2 ratification requires humanSignoff=true.',
      },
    ],
    agentProfiles: [
      {
        id: 'eisenhower-operator',
        role: 'Executes deterministic runs and reports lifecycle snapshots.',
      },
      {
        id: 'eisenhower-auditor',
        role: 'Inspects replay drift, trust-gate history, and override lineage.',
      },
    ],
    examples: input.includeExamples === true
      ? {
        strictRun: {
          tool: 'eisenhower_run_strict',
          params: {
            actor: 'operator',
            context: 'Choose between execution path A and B',
            hypothesisAStatement: 'Path A maximizes near-term throughput',
            hypothesisBStatement: 'Path B improves long-term reliability',
          },
        },
        override: {
          tool: 'eisenhower_override_finalize',
          params: {
            actor: 'owner',
            rationale: 'Accepted replay drift due to approved migration window',
            runId: runRef,
            confirmPhrase: FINALIZE_OVERRIDE_PHRASE,
          },
        },
      }
      : undefined,
  }
}

function normalizeCreateRunInput(input: CreateRunInput) {
  return {
    actor: input.actor,
    context: input.context,
    hypothesisAStatement: input.hypothesisAStatement,
    hypothesisAAssumptions: input.hypothesisAAssumptions ?? [],
    hypothesisBStatement: input.hypothesisBStatement,
    hypothesisBAssumptions: input.hypothesisBAssumptions ?? [],
  }
}

function normalizeStrictInput(input: RunStrictInput) {
  return {
    actor: input.actor,
    context: input.context,
    hypothesisAStatement: input.hypothesisAStatement,
    hypothesisAAssumptions: input.hypothesisAAssumptions ?? [],
    hypothesisBStatement: input.hypothesisBStatement,
    hypothesisBAssumptions: input.hypothesisBAssumptions ?? [],
    phase1Actor: input.phase1Actor ?? input.actor,
    phase1Rationale: input.phase1Rationale ?? 'Phase 1 conflict acknowledgement.',
    acknowledgeConflict: input.acknowledgeConflict ?? true,
    dualRunConsistent: input.dualRunConsistent ?? true,
    phase2Actor: input.phase2Actor ?? input.actor,
    phase2Rationale: input.phase2Rationale ?? 'Phase 2 final signoff.',
    humanSignoff: input.humanSignoff ?? true,
    requireReplayPass: input.requireReplayPass ?? true,
    requireZeroStrictDrift: input.requireZeroStrictDrift ?? true,
  }
}

async function executeStrictRun(
  input: RunStrictInput,
  onUpdate?: (update: { content: Array<{ type: string; text: string }> }) => void,
): Promise<{
  readonly summary: string
  readonly snapshot: Snapshot
  readonly strictFailures: ReadonlyArray<string>
  readonly override: OverrideRecord | null
}> {
  const request = normalizeStrictInput(input)

  log('info', `run_strict:start actor=${request.actor}`)
  onUpdate?.({ content: [{ type: 'text', text: 'Eisenhower: create run' }] })
  const run = await runOp<{ id: string }>(
    hypothesisLabOps.createRun,
    {
      actor: request.actor,
      context: request.context,
      hypothesisAStatement: request.hypothesisAStatement,
      hypothesisAAssumptions: request.hypothesisAAssumptions,
      hypothesisBStatement: request.hypothesisBStatement,
      hypothesisBAssumptions: request.hypothesisBAssumptions,
    },
    'eisenhower_create_run',
  )

  onUpdate?.({ content: [{ type: 'text', text: 'Eisenhower: compile plan' }] })
  const plan = await runOp<{ planId: string }>(
    hypothesisLabOps.compileDefaultPlan,
    { actor: request.actor },
    'eisenhower_compile_plan',
  )

  onUpdate?.({ content: [{ type: 'text', text: 'Eisenhower: run validation' }] })
  await runOp(hypothesisLabOps.runValidation, undefined, 'eisenhower_run_validation')

  onUpdate?.({ content: [{ type: 'text', text: 'Eisenhower: draft verdict' }] })
  await runOp(hypothesisLabOps.draftVerdict, undefined, 'eisenhower_draft_verdict')

  onUpdate?.({ content: [{ type: 'text', text: 'Eisenhower: ratify phase1' }] })
  await runOp(
    hypothesisLabOps.ratifyVerdict,
    {
      actor: request.phase1Actor,
      rationale: request.phase1Rationale,
      acknowledgeConflict: request.acknowledgeConflict,
      dualRunConsistent: request.dualRunConsistent,
    },
    'eisenhower_ratify_phase1',
  )

  onUpdate?.({ content: [{ type: 'text', text: 'Eisenhower: ratify phase2' }] })
  await runOp(
    hypothesisLabOps.ratifyVerdict,
    {
      actor: request.phase2Actor,
      rationale: request.phase2Rationale,
      humanSignoff: request.humanSignoff,
    },
    'eisenhower_ratify_phase2',
  )

  onUpdate?.({ content: [{ type: 'text', text: 'Eisenhower: replay' }] })
  await runOp(hypothesisLabOps.replay, undefined, 'eisenhower_replay')

  const snapshot = snapshotState()
  const strictFailures: string[] = []

  if (request.requireReplayPass && snapshot.replayStatus === 'failed') {
    strictFailures.push('Replay status is failed.')
  }

  if (request.requireZeroStrictDrift && (snapshot.strictDriftCount ?? 0) > 0) {
    strictFailures.push(`Strict drift count is ${snapshot.strictDriftCount ?? 0}; expected 0.`)
  }

  if (!snapshot.ratified) {
    strictFailures.push('Verdict is not ratified.')
  }

  const override = snapshot.runId ? (finalizeOverrides.get(snapshot.runId) ?? null) : null

  const summary = [
    `Eisenhower run complete for ${run.id}.`,
    `plan=${plan.planId}`,
    `winner=${snapshot.winner ?? 'n/a'} ratifiedBy=${snapshot.ratifiedBy ?? 'n/a'}`,
    `replay=${snapshot.replayStatus ?? 'n/a'} strict=${snapshot.strictDriftCount ?? 0} tolerant=${snapshot.tolerantDriftCount ?? 0}`,
  ].join('\n')

  log(
    strictFailures.length > 0 ? 'warn' : 'info',
    `run_strict:complete runId=${snapshot.runId ?? 'n/a'} winner=${snapshot.winner ?? 'n/a'} replay=${snapshot.replayStatus ?? 'n/a'} strict=${snapshot.strictDriftCount ?? 0} tolerant=${snapshot.tolerantDriftCount ?? 0}`
  )

  return {
    summary,
    snapshot,
    strictFailures,
    override,
  }
}

function registerEisenhowerStatusCommand(pi: ExtensionAPI, commandName: string) {
  pi.registerCommand(commandName, {
    description: 'Show current Eisenhower Decision OS run status',
    handler: async (_args, ctx) => {
      const statusText = formatStatus(snapshotState())
      if (ctx.hasUI) {
        ctx.ui.notify(statusText, 'info')
      }
    },
  })
}

function registerEisenhowerTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'eisenhower_create_run',
    label: 'Eisenhower Create Run',
    description: 'Create an Eisenhower decision run with two hypotheses.',
    parameters: Type.Object({
      actor: Type.String(),
      context: Type.String(),
      hypothesisAStatement: Type.String(),
      hypothesisAAssumptions: Type.Optional(Type.Array(Type.String())),
      hypothesisBStatement: Type.String(),
      hypothesisBAssumptions: Type.Optional(Type.Array(Type.String())),
    }),
    async execute(_toolCallId, params) {
      const decoded = decodeInput(CreateRunInput, params, 'eisenhower_create_run')
      if (!decoded.ok) {
        return {
          content: [{ type: 'text', text: decoded.message }],
          isError: true,
        }
      }

      try {
        const run = await runOp<{ id: string }>(
          hypothesisLabOps.createRun,
          normalizeCreateRunInput(decoded.value),
          'eisenhower_create_run',
        )
        const snapshot = snapshotState()
        return {
          content: [{ type: 'text', text: `Eisenhower run created: ${run.id}` }],
          details: { run, snapshot },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `eisenhower_create_run failed: ${message}` }],
          details: { snapshot: snapshotState() },
          isError: true,
        }
      }
    },
  })

  pi.registerTool({
    name: 'eisenhower_compile_plan',
    label: 'Eisenhower Compile Plan',
    description: 'Compile the default deterministic decision plan.',
    parameters: Type.Object({
      actor: Type.String(),
    }),
    async execute(_toolCallId, params) {
      const decoded = decodeInput(CompilePlanInput, params, 'eisenhower_compile_plan')
      if (!decoded.ok) {
        return {
          content: [{ type: 'text', text: decoded.message }],
          isError: true,
        }
      }

      try {
        const plan = await runOp<{ planId: string }>(
          hypothesisLabOps.compileDefaultPlan,
          { actor: decoded.value.actor },
          'eisenhower_compile_plan',
        )

        return {
          content: [{ type: 'text', text: `Eisenhower plan compiled: ${plan.planId}` }],
          details: { plan, snapshot: snapshotState() },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `eisenhower_compile_plan failed: ${message}` }],
          details: { snapshot: snapshotState() },
          isError: true,
        }
      }
    },
  })

  pi.registerTool({
    name: 'eisenhower_run_validation',
    label: 'Eisenhower Run Validation',
    description: 'Execute validation hooks and collect evidence.',
    parameters: Type.Object({}),
    async execute(_toolCallId, params) {
      const decoded = decodeInput(EmptyInput, params, 'eisenhower_run_validation')
      if (!decoded.ok) {
        return {
          content: [{ type: 'text', text: decoded.message }],
          isError: true,
        }
      }

      try {
        const output = await runOp(hypothesisLabOps.runValidation, undefined, 'eisenhower_run_validation')
        return {
          content: [{ type: 'text', text: 'Eisenhower validation completed.' }],
          details: { output, snapshot: snapshotState() },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `eisenhower_run_validation failed: ${message}` }],
          details: { snapshot: snapshotState() },
          isError: true,
        }
      }
    },
  })

  pi.registerTool({
    name: 'eisenhower_draft_verdict',
    label: 'Eisenhower Draft Verdict',
    description: 'Draft the decision matrix and provisional verdict.',
    parameters: Type.Object({}),
    async execute(_toolCallId, params) {
      const decoded = decodeInput(EmptyInput, params, 'eisenhower_draft_verdict')
      if (!decoded.ok) {
        return {
          content: [{ type: 'text', text: decoded.message }],
          isError: true,
        }
      }

      try {
        const draft = await runOp(hypothesisLabOps.draftVerdict, undefined, 'eisenhower_draft_verdict')
        return {
          content: [{ type: 'text', text: 'Eisenhower verdict drafted.' }],
          details: { draft, snapshot: snapshotState() },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `eisenhower_draft_verdict failed: ${message}` }],
          details: { snapshot: snapshotState() },
          isError: true,
        }
      }
    },
  })

  pi.registerTool({
    name: 'eisenhower_ratify_phase1',
    label: 'Eisenhower Ratify Phase 1',
    description: 'Advance ratification to phase 1 acknowledgement.',
    parameters: Type.Object({
      actor: Type.String(),
      rationale: Type.String(),
      acknowledgeConflict: Type.Optional(Type.Boolean()),
      dualRunConsistent: Type.Optional(Type.Boolean()),
    }),
    async execute(_toolCallId, params) {
      const decoded = decodeInput(RatifyPhase1Input, params, 'eisenhower_ratify_phase1')
      if (!decoded.ok) {
        return {
          content: [{ type: 'text', text: decoded.message }],
          isError: true,
        }
      }

      try {
        const verdict = await runOp(
          hypothesisLabOps.ratifyVerdict,
          {
            actor: decoded.value.actor,
            rationale: decoded.value.rationale,
            acknowledgeConflict: decoded.value.acknowledgeConflict ?? true,
            dualRunConsistent: decoded.value.dualRunConsistent ?? true,
          },
          'eisenhower_ratify_phase1',
        )

        return {
          content: [{ type: 'text', text: 'Eisenhower phase 1 ratification complete.' }],
          details: { verdict, snapshot: snapshotState() },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `eisenhower_ratify_phase1 failed: ${message}` }],
          details: { snapshot: snapshotState() },
          isError: true,
        }
      }
    },
  })

  pi.registerTool({
    name: 'eisenhower_ratify_phase2',
    label: 'Eisenhower Ratify Phase 2',
    description: 'Finalize ratification with human signoff.',
    parameters: Type.Object({
      actor: Type.String(),
      rationale: Type.String(),
      humanSignoff: Type.Optional(Type.Boolean()),
    }),
    async execute(_toolCallId, params) {
      const decoded = decodeInput(RatifyPhase2Input, params, 'eisenhower_ratify_phase2')
      if (!decoded.ok) {
        return {
          content: [{ type: 'text', text: decoded.message }],
          isError: true,
        }
      }

      try {
        const verdict = await runOp(
          hypothesisLabOps.ratifyVerdict,
          {
            actor: decoded.value.actor,
            rationale: decoded.value.rationale,
            humanSignoff: decoded.value.humanSignoff ?? true,
          },
          'eisenhower_ratify_phase2',
        )

        return {
          content: [{ type: 'text', text: 'Eisenhower phase 2 ratification complete.' }],
          details: { verdict, snapshot: snapshotState() },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `eisenhower_ratify_phase2 failed: ${message}` }],
          details: { snapshot: snapshotState() },
          isError: true,
        }
      }
    },
  })

  pi.registerTool({
    name: 'eisenhower_replay',
    label: 'Eisenhower Replay',
    description: 'Replay audit events and classify drift.',
    parameters: Type.Object({}),
    async execute(_toolCallId, params) {
      const decoded = decodeInput(EmptyInput, params, 'eisenhower_replay')
      if (!decoded.ok) {
        return {
          content: [{ type: 'text', text: decoded.message }],
          isError: true,
        }
      }

      try {
        const replay = await runOp(hypothesisLabOps.replay, undefined, 'eisenhower_replay')
        return {
          content: [{ type: 'text', text: 'Eisenhower replay completed.' }],
          details: { replay, snapshot: snapshotState() },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `eisenhower_replay failed: ${message}` }],
          details: { snapshot: snapshotState() },
          isError: true,
        }
      }
    },
  })

  pi.registerTool({
    name: 'eisenhower_status',
    label: 'Eisenhower Status',
    description: 'Return current lifecycle status snapshot.',
    parameters: Type.Object({
      includeAuditTail: Type.Optional(Type.Number()),
    }),
    async execute(_toolCallId, params) {
      const decoded = decodeInput(StatusInput, params, 'eisenhower_status')
      if (!decoded.ok) {
        return {
          content: [{ type: 'text', text: decoded.message }],
          isError: true,
        }
      }

      const snapshot = snapshotState()
      return {
        content: [{ type: 'text', text: formatStatus(snapshot, decoded.value.includeAuditTail) }],
        details: { snapshot },
      }
    },
  })

  pi.registerTool({
    name: 'eisenhower_generate_artifacts',
    label: 'Eisenhower Generate Artifacts',
    description: 'Generate Decision OS artifacts (templates, frames, playbooks, guardrails, profiles).',
    parameters: Type.Object({
      profile: Type.Optional(Type.String()),
      includeExamples: Type.Optional(Type.Boolean()),
      runId: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params) {
      const decoded = decodeInput(ArtifactPackInput, params, 'eisenhower_generate_artifacts')
      if (!decoded.ok) {
        return {
          content: [{ type: 'text', text: decoded.message }],
          isError: true,
        }
      }

      const snapshot = snapshotState()
      const artifacts = buildArtifactPack(snapshot, decoded.value)
      return {
        content: [{
          type: 'text',
          text: [
            'Eisenhower artifact pack generated.',
            `profile=${artifacts.profile}`,
            `runRef=${artifacts.runRef}`,
            `templates=${artifacts.promptTemplates.length} frames=${artifacts.decisionFrames.length} playbooks=${artifacts.playbooks.length}`,
          ].join('\n'),
        }],
        details: {
          snapshot,
          artifacts,
        },
      }
    },
  })

  pi.registerTool({
    name: 'eisenhower_run_strict',
    label: 'Eisenhower Run Strict',
    description: 'Run full strict Eisenhower orchestration lifecycle.',
    parameters: Type.Object({
      actor: Type.String(),
      context: Type.String(),
      hypothesisAStatement: Type.String(),
      hypothesisAAssumptions: Type.Optional(Type.Array(Type.String())),
      hypothesisBStatement: Type.String(),
      hypothesisBAssumptions: Type.Optional(Type.Array(Type.String())),
      phase1Actor: Type.Optional(Type.String()),
      phase1Rationale: Type.Optional(Type.String()),
      acknowledgeConflict: Type.Optional(Type.Boolean()),
      dualRunConsistent: Type.Optional(Type.Boolean()),
      phase2Actor: Type.Optional(Type.String()),
      phase2Rationale: Type.Optional(Type.String()),
      humanSignoff: Type.Optional(Type.Boolean()),
      requireReplayPass: Type.Optional(Type.Boolean()),
      requireZeroStrictDrift: Type.Optional(Type.Boolean()),
    }),
    async execute(_toolCallId, params, _signal, onUpdate) {
      const decoded = decodeInput(RunStrictInput, params, 'eisenhower_run_strict')
      if (!decoded.ok) {
        return {
          content: [{ type: 'text', text: decoded.message }],
          isError: true,
        }
      }

      try {
        const outcome = await executeStrictRun(decoded.value, onUpdate)

        if (outcome.strictFailures.length > 0 && !outcome.override) {
          return {
            content: [{
              type: 'text',
              text: [
                'Eisenhower strict run completed with strict-finalization block.',
                ...outcome.strictFailures.map((failure) => `- ${failure}`),
                'Use eisenhower_override_finalize for explicit override.',
              ].join('\n'),
            }],
            details: {
              snapshot: outcome.snapshot,
              strictFailures: outcome.strictFailures,
              overrideRequired: true,
              overrideTool: 'eisenhower_override_finalize',
            },
            isError: true,
          }
        }

        if (outcome.strictFailures.length > 0 && outcome.override) {
          return {
            content: [{
              type: 'text',
              text: [
                'Eisenhower strict run completed with explicit override.',
                outcome.summary,
              ].join('\n'),
            }],
            details: {
              snapshot: outcome.snapshot,
              strictFailures: outcome.strictFailures,
              override: outcome.override,
            },
          }
        }

        return {
          content: [{ type: 'text', text: outcome.summary }],
          details: {
            snapshot: outcome.snapshot,
            strictFailures: outcome.strictFailures,
          },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `eisenhower_run_strict failed: ${message}` }],
          details: { snapshot: snapshotState() },
          isError: true,
        }
      }
    },
  })

  pi.registerTool({
    name: 'eisenhower_override_finalize',
    label: 'Eisenhower Override Finalize',
    description: 'Explicitly record strict-finalization override for a run.',
    parameters: Type.Object({
      actor: Type.String(),
      rationale: Type.String(),
      runId: Type.Optional(Type.String()),
      confirmPhrase: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params) {
      const decoded = decodeInput(OverrideFinalizeInput, params, 'eisenhower_override_finalize')
      if (!decoded.ok) {
        return {
          content: [{ type: 'text', text: decoded.message }],
          isError: true,
        }
      }

      const current = snapshotState()
      const runId = decoded.value.runId ?? current.runId
      if (!runId) {
        return {
          content: [{ type: 'text', text: 'No active run for override. Provide runId explicitly.' }],
          details: { snapshot: current },
          isError: true,
        }
      }

      const confirmPhrase = decoded.value.confirmPhrase ?? ''
      if (confirmPhrase !== FINALIZE_OVERRIDE_PHRASE) {
        return {
          content: [{
            type: 'text',
            text: `Override rejected. confirmPhrase must equal ${FINALIZE_OVERRIDE_PHRASE}`,
          }],
          details: {
            snapshot: current,
            requiredConfirmPhrase: FINALIZE_OVERRIDE_PHRASE,
          },
          isError: true,
        }
      }

      const override: OverrideRecord = {
        overrideId: `ovr-${crypto.randomUUID()}`,
        runId,
        actor: decoded.value.actor,
        rationale: decoded.value.rationale,
        createdAt: Date.now(),
        confirmPhrase,
      }

      finalizeOverrides.set(runId, override)
      const snapshot = snapshotState()
      log('warn', `override_finalize:recorded runId=${runId} actor=${decoded.value.actor}`)

      return {
        content: [{
          type: 'text',
          text: `Override recorded for run ${runId} by ${decoded.value.actor}.`,
        }],
        details: {
          snapshot,
          override,
        },
      }
    },
  })
}

function registerEisenhowerCommands(pi: ExtensionAPI) {
  registerEisenhowerStatusCommand(pi, 'eisenhower-status')

  pi.registerCommand('eisenhower-run', {
    description: 'Run strict Eisenhower orchestration from JSON args',
    handler: async (args, ctx) => {
      const raw = args?.trim()
      if (!raw) {
        if (ctx.hasUI) {
          ctx.ui.notify('Usage: /eisenhower-run {"actor":"...","context":"...","hypothesisAStatement":"...","hypothesisBStatement":"..."}', 'warning')
        }
        return
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        if (ctx.hasUI) {
          ctx.ui.notify('Invalid JSON. Provide /eisenhower-run <json>', 'error')
        }
        return
      }

      const decoded = decodeInput(RunStrictInput, parsed, 'eisenhower-run command')
      if (!decoded.ok) {
        if (ctx.hasUI) {
          ctx.ui.notify(decoded.message, 'error')
        }
        return
      }

      try {
        const outcome = await executeStrictRun(decoded.value)
        const strictSummary = outcome.strictFailures.length > 0
          ? ` strictFailures=${outcome.strictFailures.length}`
          : ''
        if (ctx.hasUI) {
          ctx.ui.notify(`Eisenhower run complete.${strictSummary}`, 'success')
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (ctx.hasUI) {
          ctx.ui.notify(`Eisenhower run failed: ${message}`, 'error')
        }
      }
    },
  })

  pi.registerCommand('eisenhower-help', {
    description: 'Show Eisenhower extension commands and tools',
    handler: async (_args, ctx) => {
      const text = [
        'Eisenhower Decision OS',
        'Commands:',
        '- /eisenhower-status',
        '- /eisenhower-run <json>',
        '- /eisenhower-help',
        'Core tools:',
        '- eisenhower_create_run',
        '- eisenhower_compile_plan',
        '- eisenhower_run_validation',
        '- eisenhower_draft_verdict',
        '- eisenhower_ratify_phase1',
        '- eisenhower_ratify_phase2',
        '- eisenhower_replay',
        '- eisenhower_status',
        '- eisenhower_generate_artifacts',
        '- eisenhower_run_strict',
        '- eisenhower_override_finalize',
      ].join('\n')

      if (ctx.hasUI) {
        ctx.ui.notify(text, 'info')
      }
    },
  })
}

export function registerHypothesisCompatibility(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'hypothesis_lab_vertical_slice',
    label: 'Hypothesis Lab Vertical Slice (Compatibility)',
    description: 'Compatibility alias to Eisenhower strict orchestrator.',
    parameters: Type.Object({
      actor: Type.String(),
      context: Type.String(),
      hypothesisAStatement: Type.String(),
      hypothesisAAssumptions: Type.Optional(Type.Array(Type.String())),
      hypothesisBStatement: Type.String(),
      hypothesisBAssumptions: Type.Optional(Type.Array(Type.String())),
      phase1Actor: Type.Optional(Type.String()),
      phase1Rationale: Type.Optional(Type.String()),
      acknowledgeConflict: Type.Optional(Type.Boolean()),
      dualRunConsistent: Type.Optional(Type.Boolean()),
      phase2Actor: Type.Optional(Type.String()),
      phase2Rationale: Type.Optional(Type.String()),
      humanSignoff: Type.Optional(Type.Boolean()),
      requireReplayPass: Type.Optional(Type.Boolean()),
      requireZeroStrictDrift: Type.Optional(Type.Boolean()),
    }),
    async execute(_toolCallId, params, _signal, onUpdate) {
      const decoded = decodeInput(RunStrictInput, params, 'hypothesis_lab_vertical_slice')
      if (!decoded.ok) {
        return {
          content: [{ type: 'text', text: decoded.message }],
          isError: true,
        }
      }

      try {
        const outcome = await executeStrictRun(decoded.value, onUpdate)
        return {
          content: [{ type: 'text', text: outcome.summary }],
          details: {
            snapshot: outcome.snapshot,
            strictFailures: outcome.strictFailures,
            override: outcome.override,
          },
          isError: outcome.strictFailures.length > 0 && !outcome.override,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `hypothesis_lab_vertical_slice failed: ${message}` }],
          details: { snapshot: snapshotState() },
          isError: true,
        }
      }
    },
  })

  pi.registerCommand('hypothesis-status', {
    description: 'Compatibility alias for Eisenhower status',
    handler: async (_args, ctx) => {
      const statusText = formatStatus(snapshotState())
      if (ctx.hasUI) {
        ctx.ui.notify(statusText, 'info')
      }
    },
  })
}

export default function eisenhowerExtension(pi: ExtensionAPI) {
  log('info', 'extension:loaded')
  registerEisenhowerTools(pi)
  registerEisenhowerCommands(pi)
}
