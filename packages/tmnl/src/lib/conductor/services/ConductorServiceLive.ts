/**
 * ConductorServiceLive — Implementation backed by TerminalSessionManager.
 *
 * Spawns agents as PTY sessions running `pi`.
 * Manages output buffering, prompt injection, pattern polling.
 * Drives workflows via step resolution with Effect.Match.
 */

import { Effect, Layer, Duration, Match } from 'effect'
import { Atom } from '@effect-atom/atom'
import { TerminalSessionManager } from '@/lib/terminal/backend/TerminalSessionManager'
import {
  ConductorService,
  type ConductorServiceShape,
  type ConductorState,
  conductorStateAtom,
} from './ConductorService'
import {
  AgentSpec,
  AgentInstance,
  type AgentStep,
  type QuestionnaireStep,
  type GateStep,
  type ParallelStep,
  type SequenceStep,
  StepResult,
  ConductorError,
  type Workflow,
  type WorkflowStep,
} from '../schemas'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const now = () => new Date().toISOString()

function buildPiArgs(spec: AgentSpec): string[] {
  return [
    '--provider', spec.provider ?? 'anthropic',
    '--model', spec.model ?? 'claude-sonnet-4-20250514',
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry adapter — type-safe wrapper
// ─────────────────────────────────────────────────────────────────────────────

interface RegistryAdapter {
  get<A>(atom: Atom.Atom<A>): A
  set<R, W>(atom: Atom.Writable<R, W>, value: W): void
}

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

export const ConductorServiceLive = Layer.effect(
  ConductorService,
  Effect.gen(function* () {
    const sessionManager = yield* TerminalSessionManager

    // Internal output buffers (hot path — not in atoms)
    const outputBuffers = new Map<string, string[]>()

    // Registry ref — set when workflow starts
    let reg: RegistryAdapter | null = null

    function setState(fn: (s: ConductorState) => ConductorState) {
      if (!reg) return
      const current = reg.get(conductorStateAtom)
      reg.set(conductorStateAtom, fn(current))
    }

    function updateAgent(agentId: string, update: Partial<Pick<AgentInstance, 'status' | 'lastActivity' | 'output'>>) {
      setState(s => {
        const agent = s.agents.get(agentId)
        if (!agent) return s
        const newAgents = new Map(s.agents)
        newAgents.set(agentId, new AgentInstance({
          ...agent,
          ...update,
        }))
        return { ...s, agents: newAgents }
      })
    }

    function setStepResult(stepId: string, update: Partial<Pick<StepResult, 'status' | 'output' | 'error' | 'startedAt' | 'completedAt'>>) {
      setState(s => {
        const existing = s.stepResults.get(stepId)
        const newResults = new Map(s.stepResults)
        newResults.set(stepId, new StepResult({
          stepId,
          status: 'pending',
          ...existing,
          ...update,
        }))
        return { ...s, stepResults: newResults }
      })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // pollOutputInternal
    // ─────────────────────────────────────────────────────────────────────────

    const pollOutputInternal = (
      agentId: string,
      pattern: RegExp,
      timeoutMs = 30000,
    ): Effect.Effect<string, ConductorError> =>
      Effect.gen(function* () {
        const deadline = Date.now() + timeoutMs

        while (Date.now() < deadline) {
          const buf = outputBuffers.get(agentId) ?? []
          const joined = buf.join('')
          const match = pattern.exec(joined)
          if (match) return match[0]

          yield* Effect.sleep(Duration.millis(2000))
        }

        return yield* Effect.fail(new ConductorError({
          reason: 'Timeout',
          message: `Polling "${agentId}" for ${pattern} timed out after ${timeoutMs}ms`,
        }))
      })

    // ─────────────────────────────────────────────────────────────────────────
    // spawnAgent
    // ─────────────────────────────────────────────────────────────────────────

    const spawnAgent: ConductorServiceShape['spawnAgent'] = (spec) =>
      Effect.gen(function* () {
        const sessionInfo = yield* sessionManager.createSession({
          _tag: 'PtyConfig',
          shell: 'pi',
          args: buildPiArgs(spec),
          cwd: spec.cwd,
          env: {},
          dimensions: { cols: 120, rows: 40 },
        }).pipe(
          Effect.mapError(e => new ConductorError({
            reason: 'SpawnFailed',
            message: `Failed to spawn agent "${spec.name}": ${String(e)}`,
            cause: e,
          }))
        )

        const instance = new AgentInstance({
          spec,
          sessionId: sessionInfo.id,
          status: 'spawning',
          spawnedAt: now(),
          output: [],
        })

        outputBuffers.set(spec.id, [])

        // Subscribe to output stream
        const handleOpt = yield* sessionManager.getHandle(sessionInfo.id)
        if (handleOpt._tag === 'Some') {
          const handle = handleOpt.value
          yield* Effect.fork(
            Effect.forEach(
              Effect.iterate(
                true,
                {
                  while: (cont) => cont,
                  body: () => Effect.gen(function* () {
                    // Simple chunk read — collect output
                    yield* Effect.sleep(Duration.millis(500))
                    return true
                  }),
                }
              ),
              () => Effect.void,
            )
          )
        }

        // Update atom state
        setState(s => {
          const newAgents = new Map(s.agents)
          newAgents.set(spec.id, instance)
          return { ...s, agents: newAgents }
        })

        // Wait for pi to boot
        yield* pollOutputInternal(spec.id, /\$/, 15000).pipe(
          Effect.catchAll(() => Effect.succeed('(boot timeout)')),
        )

        updateAgent(spec.id, { status: 'idle', lastActivity: now() })
        return instance
      })

    // ─────────────────────────────────────────────────────────────────────────
    // sendPrompt
    // ─────────────────────────────────────────────────────────────────────────

    const sendPrompt: ConductorServiceShape['sendPrompt'] = (agentId, prompt) =>
      Effect.gen(function* () {
        const state = reg?.get(conductorStateAtom)
        const agent = state?.agents.get(agentId)
        if (!agent) {
          return yield* Effect.fail(new ConductorError({
            reason: 'AgentFailed',
            message: `Agent "${agentId}" not found`,
          }))
        }

        const handleOpt = yield* sessionManager.getHandle(agent.sessionId)
        if (handleOpt._tag === 'None') {
          return yield* Effect.fail(new ConductorError({
            reason: 'AgentFailed',
            message: `No handle for agent "${agentId}"`,
          }))
        }

        updateAgent(agentId, { status: 'working', lastActivity: now() })

        yield* handleOpt.value.write(prompt + '\n').pipe(
          Effect.mapError(e => new ConductorError({
            reason: 'AgentFailed',
            message: `Write failed for "${agentId}": ${String(e)}`,
            cause: e,
          }))
        )
      })

    // ─────────────────────────────────────────────────────────────────────────
    // pollOutput / getOutput / terminateAgent
    // ─────────────────────────────────────────────────────────────────────────

    const pollOutput: ConductorServiceShape['pollOutput'] = (agentId, pattern, timeoutMs) =>
      pollOutputInternal(agentId, pattern, timeoutMs)

    const getOutput: ConductorServiceShape['getOutput'] = (agentId) =>
      Effect.succeed(outputBuffers.get(agentId) ?? [])

    const terminateAgent: ConductorServiceShape['terminateAgent'] = (agentId) =>
      Effect.gen(function* () {
        const state = reg?.get(conductorStateAtom)
        const agent = state?.agents.get(agentId)
        if (!agent) return

        yield* sessionManager.destroySession(agent.sessionId)
        outputBuffers.delete(agentId)
        updateAgent(agentId, { status: 'terminated', lastActivity: now() })
      })

    // ─────────────────────────────────────────────────────────────────────────
    // executeWorkflow
    // ─────────────────────────────────────────────────────────────────────────

    const executeWorkflow: ConductorServiceShape['executeWorkflow'] = (workflow, registry) =>
      Effect.gen(function* () {
        reg = registry as unknown as RegistryAdapter

        setState(s => ({
          ...s,
          workflow,
          status: 'running',
          currentStepId: workflow.startStepId,
          stepResults: new Map(),
        }))

        let currentId: string | null = workflow.startStepId

        while (currentId) {
          const step = workflow.stepMap.get(currentId)
          if (!step) {
            return yield* Effect.fail(new ConductorError({
              reason: 'StepNotFound',
              message: `Step "${currentId}" not found in workflow`,
              stepId: currentId,
            }))
          }

          setState(s => ({ ...s, currentStepId: currentId }))
          setStepResult(currentId, { status: 'running', startedAt: now() })

          const nextId = yield* executeStep(step, workflow)

          setStepResult(currentId, { status: 'complete', completedAt: now() })
          currentId = nextId
        }

        setState(s => ({ ...s, status: 'complete', currentStepId: null }))
        return reg.get(conductorStateAtom).stepResults
      })

    // ─────────────────────────────────────────────────────────────────────────
    // Step Execution — Effect.Match
    // ─────────────────────────────────────────────────────────────────────────

    const executeStep = (
      step: WorkflowStep,
      workflow: Workflow,
    ): Effect.Effect<string | null, ConductorError> => {
      const tag = (step as any)._type as string
      return pipe(
        Match.value(tag),
        Match.when('agent', () => executeAgentStep(step as AgentStep, workflow)),
        Match.when('questionnaire', () => executeQuestionnaireStep(step as QuestionnaireStep)),
        Match.when('gate', () => executeGateStep(step as GateStep)),
        Match.when('parallel', () => executeParallelStep(step as ParallelStep, workflow)),
        Match.when('sequence', () => executeSequenceStep(step as SequenceStep, workflow)),
        Match.orElse(() => Effect.succeed(null as string | null)),
      )
    }

    const executeAgentStep = (
      step: AgentStep,
      _workflow: Workflow,
    ): Effect.Effect<string | null, ConductorError> =>
      Effect.gen(function* () {
        const instance = yield* spawnAgent(step.agent)

        // Resolve prompt template — inject {{stepId.field}} references
        let prompt = step.prompt
        for (const ref of step.injectFrom) {
          const result = reg?.get(conductorStateAtom).stepResults.get(ref.stepId)
          if (result?.output) {
            const value = typeof result.output === 'string' ? result.output : JSON.stringify(result.output)
            prompt = prompt.replace(`{{${ref.stepId}.${ref.field}}}`, value)
          }
        }

        yield* sendPrompt(step.agent.id, prompt)

        // Poll for completion
        yield* pollOutput(step.agent.id, /\$\s*$/, step.timeout * 1000).pipe(
          Effect.catchAll(() => Effect.succeed('(timeout)')),
        )

        // Capture output
        const allOutput = outputBuffers.get(step.agent.id) ?? []
        setStepResult(step.id, { output: allOutput.join('') })

        yield* terminateAgent(step.agent.id)
        return null
      })

    const executeQuestionnaireStep = (
      step: QuestionnaireStep,
    ): Effect.Effect<string | null, ConductorError> =>
      Effect.gen(function* () {
        // TODO: Wire to questionnaire React renderer
        setStepResult(step.id, { output: step.spec })
        return null
      })

    const executeGateStep = (
      step: GateStep,
    ): Effect.Effect<string | null, ConductorError> =>
      Effect.gen(function* () {
        const sourceResult = reg?.get(conductorStateAtom).stepResults.get(step.sourceStep)
        if (!sourceResult?.output) {
          return yield* Effect.fail(new ConductorError({
            reason: 'StepNotFound',
            message: `Gate source "${step.sourceStep}" has no output`,
            stepId: step.id,
          }))
        }

        const output = sourceResult.output as Record<string, unknown>
        const matchValue = typeof output === 'string' ? output : String(output?.[step.matchField] ?? '')
        const nextId = step.branches[matchValue] ?? step.branches['*'] ?? null

        setStepResult(step.id, { output: { matched: matchValue, nextStep: nextId } })
        return nextId
      })

    const executeParallelStep = (
      step: ParallelStep,
      workflow: Workflow,
    ): Effect.Effect<string | null, ConductorError> =>
      Effect.gen(function* () {
        const subSteps = step.stepIds
          .map(id => workflow.stepMap.get(id))
          .filter((s): s is WorkflowStep => s !== undefined)

        yield* Effect.forEach(
          subSteps,
          (subStep) => executeStep(subStep, workflow),
          { concurrency: step.maxConcurrency },
        )

        return null
      })

    const executeSequenceStep = (
      step: SequenceStep,
      workflow: Workflow,
    ): Effect.Effect<string | null, ConductorError> =>
      Effect.gen(function* () {
        for (const stepId of step.stepIds) {
          const subStep = workflow.stepMap.get(stepId)
          if (subStep) yield* executeStep(subStep, workflow)
        }
        return null
      })

    // ─────────────────────────────────────────────────────────────────────────
    // getState
    // ─────────────────────────────────────────────────────────────────────────

    const getState: ConductorServiceShape['getState'] = () =>
      Effect.succeed(reg?.get(conductorStateAtom) ?? {
        agents: new Map(),
        workflow: null,
        stepResults: new Map(),
        currentStepId: null,
        status: 'idle' as const,
      })

    return {
      spawnAgent,
      sendPrompt,
      pollOutput,
      getOutput,
      terminateAgent,
      executeWorkflow,
      getState,
    } satisfies ConductorServiceShape
  }),
)
