/**
 * AVA Testbed UI State with stx
 *
 * Separate stx instance for testbed UI concerns (REPL, inspector, etc.)
 * Keeps domain state (ava-stx) separate from UI state.
 *
 * @pattern stx tri-library composition
 * @pattern Effect Schema for all types
 * @module
 */

import { Effect, Schema, Cause } from 'effect'
import { setup, assign } from 'xstate'

import { stx, type StxInstance, Result } from '@/lib/stx'
import { getAvaStx, type AvaStx } from '@/lib/ava/atoms/ava-stx'

// =============================================================================
// Effect Helpers
// =============================================================================

/**
 * Wrap a stx-wrapped effect (returns Promise<Result>) into a proper Effect.
 * Uses Effect.tryPromise with object form to handle both Promise rejection
 * and Result failures (which carry Cause<E>).
 *
 * effect-atom Result is a tagged union:
 * - { _tag: "Success", value: A }
 * - { _tag: "Failure", cause: Cause<E> }
 * - { _tag: "Initial" }
 *
 * @pattern Effect.tryPromise object form for Promise<Result>
 */
const fromStxEffect = <A>(
  fn: () => Promise<Result.Result<A, unknown>>
): Effect.Effect<A, Error> =>
  Effect.tryPromise({
    try: async () => {
      const result = await fn()
      if (Result.isFailure(result)) {
        // Extract the actual error from Cause using squash
        throw Cause.squash(result.cause)
      }
      if (Result.isInitial(result)) {
        throw new Error('Effect returned Initial result')
      }
      return result.value
    },
    catch: (err) =>
      err instanceof Error ? err : new Error(String(err)),
  })

// =============================================================================
// Schemas
// =============================================================================

/**
 * REPL history entry — represents a single command execution
 */
export const ReplHistoryEntry = Schema.Struct({
  id: Schema.String,
  input: Schema.String,
  output: Schema.String,
  timestamp: Schema.Number,
  isError: Schema.Boolean,
})
export type ReplHistoryEntry = typeof ReplHistoryEntry.Type

/**
 * Active panel in the testbed
 */
export const TestbedPanel = Schema.Literal(
  'views',
  'artifact',
  'messages',
  'repl',
  'inspector',
  'sequence',
  'scenarios',
  'graph'
)
export type TestbedPanel = typeof TestbedPanel.Type

/**
 * Inspector node for state machine visualization
 */
export const InspectorNode = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  isActive: Schema.Boolean,
  isCurrent: Schema.Boolean,
})
export type InspectorNode = typeof InspectorNode.Type

/**
 * Sequence diagram event
 */
export const SequenceEvent = Schema.Struct({
  id: Schema.String,
  timestamp: Schema.Number,
  source: Schema.Literal('client', 'server'),
  target: Schema.Literal('client', 'server'),
  type: Schema.String,
  label: Schema.String,
  duration: Schema.optional(Schema.Number),
})
export type SequenceEvent = typeof SequenceEvent.Type

/**
 * Scenario step status
 */
export const ScenarioStepStatus = Schema.Literal(
  'pending',
  'running',
  'passed',
  'failed',
  'skipped'
)
export type ScenarioStepStatus = typeof ScenarioStepStatus.Type

/**
 * Scenario step definition
 */
export const ScenarioStep = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  description: Schema.String,
  effect: Schema.String, // Name of the effect to run
  args: Schema.optional(Schema.Array(Schema.Unknown)),
  status: ScenarioStepStatus,
  error: Schema.optional(Schema.String),
  durationMs: Schema.optional(Schema.Number),
})
export type ScenarioStep = typeof ScenarioStep.Type

/**
 * Scenario status
 */
export const ScenarioStatus = Schema.Literal(
  'idle',
  'running',
  'paused',
  'passed',
  'failed'
)
export type ScenarioStatus = typeof ScenarioStatus.Type

/**
 * Scenario definition
 */
export const Scenario = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  steps: Schema.Array(ScenarioStep),
  status: ScenarioStatus,
  currentStepIndex: Schema.Number,
  startedAt: Schema.optional(Schema.Number),
  completedAt: Schema.optional(Schema.Number),
})
export type Scenario = typeof Scenario.Type

// =============================================================================
// Machine Definition
// =============================================================================

type TestbedContext = {
  activePanel: TestbedPanel
}

type TestbedEvents =
  | { type: 'SWITCH_PANEL'; panel: TestbedPanel }
  | { type: 'TOGGLE_INSPECTOR' }
  | { type: 'CLEAR_REPL' }

const testbedMachine = setup({
  types: {
    context: {} as TestbedContext,
    events: {} as TestbedEvents,
  },
  actions: {
    setPanel: assign({
      activePanel: (_, params: { panel: TestbedPanel }) => params.panel,
    }),
  },
}).createMachine({
  id: 'avaTestbedUI',
  initial: 'idle',
  context: {
    activePanel: 'views' as TestbedPanel,
  },
  states: {
    idle: {
      on: {
        SWITCH_PANEL: {
          actions: {
            type: 'setPanel',
            params: ({ event }) => ({ panel: event.panel }),
          },
        },
      },
    },
  },
})

// =============================================================================
// Data Shape
// =============================================================================

interface TestbedData {
  // REPL state
  replHistory: readonly ReplHistoryEntry[]
  replCommandHistory: readonly string[]
  replHistoryIndex: number

  // Inspector state
  inspectorExpanded: boolean
  inspectorNodes: readonly InspectorNode[]

  // Sequence diagram
  sequenceEvents: readonly SequenceEvent[]
  sequenceAutoScroll: boolean

  // Layout
  expandedPanels: readonly TestbedPanel[]

  // Scenario runner
  scenarios: readonly Scenario[]
  activeScenarioId: string | null
}

// =============================================================================
// Predefined Scenarios
// =============================================================================

const createStep = (
  id: string,
  label: string,
  description: string,
  effect: string,
  args?: unknown[]
): ScenarioStep => ({
  id,
  label,
  description,
  effect,
  args,
  status: 'pending',
})

const predefinedScenarios: Scenario[] = [
  {
    id: 'scenario-connect-flow',
    name: 'Connection Flow',
    description: 'Basic connect → list → disconnect cycle',
    steps: [
      createStep('s1', 'Connect', 'Establish WebSocket connection', 'connectSession'),
      createStep('s2', 'List Views', 'Fetch all registered views', 'fetchViews'),
      createStep('s3', 'Ping', 'Send ping to verify connection', 'sendPing'),
      createStep('s4', 'Disconnect', 'Close WebSocket connection', 'disconnectSession'),
    ],
    status: 'idle',
    currentStepIndex: -1,
  },
  {
    id: 'scenario-subscribe-flow',
    name: 'Subscribe Flow',
    description: 'Connect → Register → Subscribe → Receive Artifact',
    steps: [
      createStep('s1', 'Connect', 'Establish WebSocket connection', 'connectSession'),
      createStep('s2', 'Register', 'Register a test view', 'registerTestView'),
      createStep('s3', 'List', 'Fetch views to get ID', 'fetchViews'),
      createStep('s4', 'Subscribe', 'Subscribe to first view', 'subscribeToFirstView'),
      createStep('s5', 'Wait', 'Wait for artifact event', 'waitForArtifact'),
      createStep('s6', 'Disconnect', 'Close connection', 'disconnectSession'),
    ],
    status: 'idle',
    currentStepIndex: -1,
  },
  {
    id: 'scenario-error-recovery',
    name: 'Error Recovery',
    description: 'Test connection error handling and recovery',
    steps: [
      createStep('s1', 'Bad Connect', 'Connect to invalid endpoint', 'connectToBadEndpoint'),
      createStep('s2', 'Verify Error', 'Check error state', 'verifyErrorState'),
      createStep('s3', 'Reset', 'Reset connection state', 'resetConnection'),
      createStep('s4', 'Good Connect', 'Connect to valid endpoint', 'connectSession'),
      createStep('s5', 'Verify Connected', 'Check connected state', 'verifyConnectedState'),
    ],
    status: 'idle',
    currentStepIndex: -1,
  },
  {
    id: 'scenario-stress-test',
    name: 'Stress Test',
    description: 'Rapid operations: ping burst, list spam',
    steps: [
      createStep('s1', 'Connect', 'Establish connection', 'connectSession'),
      createStep('s2', 'Ping Burst', 'Send 10 pings rapidly', 'pingBurst'),
      createStep('s3', 'List Spam', 'Fetch views 5 times', 'listSpam'),
      createStep('s4', 'Disconnect', 'Close connection', 'disconnectSession'),
    ],
    status: 'idle',
    currentStepIndex: -1,
  },
]

const initialData: TestbedData = {
  replHistory: [],
  replCommandHistory: [],
  replHistoryIndex: -1,
  inspectorExpanded: true,
  inspectorNodes: [],
  sequenceEvents: [],
  sequenceAutoScroll: true,
  expandedPanels: ['views', 'messages'],
  scenarios: predefinedScenarios,
  activeScenarioId: null,
}

// =============================================================================
// Effects
// =============================================================================

let replIdCounter = 0
let sequenceIdCounter = 0

const testbedEffects = {
  /**
   * Execute a REPL command
   */
  executeCommand: (input: string) =>
    Effect.gen(function* () {
      const state = getTestbedStx()
      const ava = getAvaStx()
      const trimmed = input.trim()

      if (!trimmed) return

      const entry: ReplHistoryEntry = {
        id: `repl-${++replIdCounter}`,
        input: trimmed,
        output: '',
        timestamp: Date.now(),
        isError: false,
      }

      // Add to command history for up/down navigation
      if (trimmed.startsWith('!')) {
        state.data.replCommandHistory.set([
          trimmed,
          ...state.data.replCommandHistory.get(),
        ].slice(0, 100))
      }

      // Execute command
      const result = yield* executeReplCommand(trimmed, ava)
      entry.output = result.output
      entry.isError = result.isError

      // Add to history
      state.data.replHistory.set([
        ...state.data.replHistory.get(),
        entry,
      ])

      // Reset history index
      state.data.replHistoryIndex.set(-1)

      return entry
    }),

  /**
   * Navigate REPL history (up/down arrow)
   */
  navigateHistory: (direction: 'up' | 'down') =>
    Effect.sync(() => {
      const state = getTestbedStx()
      const cmdHistory = state.data.replCommandHistory.get()
      const currentIndex = state.data.replHistoryIndex.get()

      if (direction === 'up') {
        const newIndex = Math.min(currentIndex + 1, cmdHistory.length - 1)
        state.data.replHistoryIndex.set(newIndex)
        return cmdHistory[newIndex] ?? ''
      } else {
        const newIndex = Math.max(currentIndex - 1, -1)
        state.data.replHistoryIndex.set(newIndex)
        return newIndex >= 0 ? cmdHistory[newIndex] : ''
      }
    }),

  /**
   * Clear REPL history
   */
  clearRepl: Effect.sync(() => {
    const state = getTestbedStx()
    state.data.replHistory.set([])
  }),

  /**
   * Add sequence diagram event
   */
  addSequenceEvent: (event: Omit<SequenceEvent, 'id' | 'timestamp'>) =>
    Effect.sync(() => {
      const state = getTestbedStx()
      const fullEvent: SequenceEvent = {
        ...event,
        id: `seq-${++sequenceIdCounter}`,
        timestamp: Date.now(),
      }
      state.data.sequenceEvents.set([
        ...state.data.sequenceEvents.get(),
        fullEvent,
      ])
    }),

  /**
   * Clear sequence diagram
   */
  clearSequence: Effect.sync(() => {
    const state = getTestbedStx()
    state.data.sequenceEvents.set([])
  }),

  /**
   * Update inspector nodes from machine state
   */
  syncInspector: Effect.sync(() => {
    const state = getTestbedStx()
    const ava = getAvaStx()
    const snapshot = ava.actor?.getSnapshot()

    if (!snapshot) return

    const currentState = snapshot.value as string
    const nodes: InspectorNode[] = [
      { id: 'disconnected', label: 'Disconnected', isActive: true, isCurrent: currentState === 'disconnected' },
      { id: 'connecting', label: 'Connecting', isActive: true, isCurrent: currentState === 'connecting' },
      { id: 'connected', label: 'Connected', isActive: true, isCurrent: currentState === 'connected' },
      { id: 'error', label: 'Error', isActive: true, isCurrent: currentState === 'error' },
    ]
    state.data.inspectorNodes.set(nodes)
  }),

  /**
   * Toggle panel expansion
   */
  togglePanel: (panel: TestbedPanel) =>
    Effect.sync(() => {
      const state = getTestbedStx()
      const expanded = state.data.expandedPanels.get()
      if (expanded.includes(panel)) {
        state.data.expandedPanels.set(expanded.filter(p => p !== panel))
      } else {
        state.data.expandedPanels.set([...expanded, panel])
      }
    }),

  // =========================================================================
  // Scenario Runner Effects
  // =========================================================================

  /**
   * Start running a scenario
   */
  runScenario: (scenarioId: string) =>
    Effect.gen(function* () {
      const state = getTestbedStx()
      const scenarios = [...state.data.scenarios.get()]
      const idx = scenarios.findIndex(s => s.id === scenarioId)

      if (idx === -1) return

      // Reset scenario state
      const scenario = {
        ...scenarios[idx],
        status: 'running' as const,
        currentStepIndex: 0,
        startedAt: Date.now(),
        completedAt: undefined,
        steps: scenarios[idx].steps.map(s => ({ ...s, status: 'pending' as const, error: undefined, durationMs: undefined })),
      }
      scenarios[idx] = scenario
      state.data.scenarios.set(scenarios)
      state.data.activeScenarioId.set(scenarioId)

      // Run steps sequentially
      yield* runScenarioSteps(scenarioId)
    }),

  /**
   * Pause a running scenario
   */
  pauseScenario: (scenarioId: string) =>
    Effect.sync(() => {
      const state = getTestbedStx()
      const scenarios = [...state.data.scenarios.get()]
      const idx = scenarios.findIndex(s => s.id === scenarioId)

      if (idx === -1) return

      scenarios[idx] = { ...scenarios[idx], status: 'paused' }
      state.data.scenarios.set(scenarios)
    }),

  /**
   * Resume a paused scenario
   */
  resumeScenario: (scenarioId: string) =>
    Effect.gen(function* () {
      const state = getTestbedStx()
      const scenarios = [...state.data.scenarios.get()]
      const idx = scenarios.findIndex(s => s.id === scenarioId)

      if (idx === -1 || scenarios[idx].status !== 'paused') return

      scenarios[idx] = { ...scenarios[idx], status: 'running' }
      state.data.scenarios.set(scenarios)

      yield* runScenarioSteps(scenarioId)
    }),

  /**
   * Reset a scenario to initial state
   */
  resetScenario: (scenarioId: string) =>
    Effect.sync(() => {
      const state = getTestbedStx()
      const scenarios = [...state.data.scenarios.get()]
      const idx = scenarios.findIndex(s => s.id === scenarioId)

      if (idx === -1) return

      const original = predefinedScenarios.find(s => s.id === scenarioId)
      if (original) {
        scenarios[idx] = { ...original }
        state.data.scenarios.set(scenarios)
      }

      if (state.data.activeScenarioId.get() === scenarioId) {
        state.data.activeScenarioId.set(null)
      }
    }),

  /**
   * Reset all scenarios
   */
  resetAllScenarios: Effect.sync(() => {
    const state = getTestbedStx()
    state.data.scenarios.set(predefinedScenarios)
    state.data.activeScenarioId.set(null)
  }),
}

// =============================================================================
// Scenario Step Execution
// =============================================================================

/**
 * Execute scenario steps sequentially
 */
const runScenarioSteps = (scenarioId: string): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    const state = getTestbedStx()
    const ava = getAvaStx()

    while (true) {
      const scenarios = state.data.scenarios.get()
      const scenario = scenarios.find(s => s.id === scenarioId)

      if (!scenario || scenario.status !== 'running') break
      if (scenario.currentStepIndex >= scenario.steps.length) {
        // All steps complete
        updateScenarioStatus(scenarioId, 'passed')
        break
      }

      const stepIdx = scenario.currentStepIndex
      const step = scenario.steps[stepIdx]

      // Mark step as running
      updateStepStatus(scenarioId, stepIdx, 'running')

      const startTime = Date.now()

      try {
        // Execute the step's effect
        yield* executeScenarioStep(step.effect, step.args ?? [], ava)

        // Mark step as passed
        const duration = Date.now() - startTime
        updateStepStatus(scenarioId, stepIdx, 'passed', undefined, duration)

        // Move to next step
        incrementStepIndex(scenarioId)

        // Small delay between steps for visual feedback
        yield* Effect.sleep(200)
      } catch (err) {
        // Mark step as failed
        const duration = Date.now() - startTime
        updateStepStatus(scenarioId, stepIdx, 'failed', String(err), duration)
        updateScenarioStatus(scenarioId, 'failed')
        break
      }
    }
  })

/**
 * Execute a single scenario step effect
 */
const executeScenarioStep = (
  effectName: string,
  args: unknown[],
  ava: AvaStx
): Effect.Effect<void, Error, never> =>
  Effect.gen(function* () {
    switch (effectName) {
      case 'connectSession':
        yield* fromStxEffect(() => ava.effects.connectSession())
        break
      case 'disconnectSession':
        yield* fromStxEffect(() => ava.effects.disconnectSession())
        break
      case 'fetchViews':
        yield* fromStxEffect(() => ava.effects.fetchViews())
        break
      case 'sendPing':
        yield* fromStxEffect(() => ava.effects.sendPing())
        break
      case 'registerTestView':
        yield* fromStxEffect(() => ava.effects.registerTestView())
        break
      case 'subscribeToFirstView': {
        const views = ava.data.views.get()
        if (views.length > 0) {
          yield* fromStxEffect(() => ava.effects.subscribeToView(views[0].id))
        } else {
          yield* Effect.fail(new Error('No views available to subscribe'))
        }
        break
      }
      case 'waitForArtifact':
        // Wait up to 5 seconds for artifact
        yield* Effect.sleep(2000)
        const artifact = ava.data.artifact.get()
        if (!artifact) {
          yield* Effect.fail(new Error('No artifact received'))
        }
        break
      case 'connectToBadEndpoint': {
        const oldConfig = ava.data.config.get()
        ava.data.config.set({ ...oldConfig, baseUrl: 'http://invalid-host:9999' })
        try {
          yield* fromStxEffect(() => ava.effects.connectSession())
        } catch {
          // Expected to fail
        }
        ava.data.config.set(oldConfig)
        break
      }
      case 'verifyErrorState': {
        const snapshot = ava.actor?.getSnapshot()
        if (!snapshot?.matches('error') && !snapshot?.matches('disconnected')) {
          yield* Effect.fail(new Error('Expected error or disconnected state'))
        }
        break
      }
      case 'resetConnection':
        ava.actor?.send({ type: 'RESET' })
        yield* Effect.sleep(100)
        break
      case 'verifyConnectedState': {
        const snapshot = ava.actor?.getSnapshot()
        if (!snapshot?.matches('connected')) {
          yield* Effect.fail(new Error('Expected connected state'))
        }
        break
      }
      case 'pingBurst':
        for (let i = 0; i < 10; i++) {
          yield* fromStxEffect(() => ava.effects.sendPing())
          yield* Effect.sleep(50)
        }
        break
      case 'listSpam':
        for (let i = 0; i < 5; i++) {
          yield* fromStxEffect(() => ava.effects.fetchViews())
          yield* Effect.sleep(100)
        }
        break
      default:
        yield* Effect.fail(new Error(`Unknown effect: ${effectName}`))
    }
  })

/**
 * Update scenario status
 */
const updateScenarioStatus = (scenarioId: string, status: ScenarioStatus): void => {
  const state = getTestbedStx()
  const scenarios = [...state.data.scenarios.get()]
  const idx = scenarios.findIndex(s => s.id === scenarioId)

  if (idx !== -1) {
    scenarios[idx] = {
      ...scenarios[idx],
      status,
      completedAt: status === 'passed' || status === 'failed' ? Date.now() : undefined,
    }
    state.data.scenarios.set(scenarios)
  }
}

/**
 * Update step status
 */
const updateStepStatus = (
  scenarioId: string,
  stepIdx: number,
  status: ScenarioStepStatus,
  error?: string,
  durationMs?: number
): void => {
  const state = getTestbedStx()
  const scenarios = [...state.data.scenarios.get()]
  const scenarioIdx = scenarios.findIndex(s => s.id === scenarioId)

  if (scenarioIdx !== -1) {
    const steps = [...scenarios[scenarioIdx].steps]
    steps[stepIdx] = { ...steps[stepIdx], status, error, durationMs }
    scenarios[scenarioIdx] = { ...scenarios[scenarioIdx], steps }
    state.data.scenarios.set(scenarios)
  }
}

/**
 * Increment current step index
 */
const incrementStepIndex = (scenarioId: string): void => {
  const state = getTestbedStx()
  const scenarios = [...state.data.scenarios.get()]
  const idx = scenarios.findIndex(s => s.id === scenarioId)

  if (idx !== -1) {
    scenarios[idx] = {
      ...scenarios[idx],
      currentStepIndex: scenarios[idx].currentStepIndex + 1,
    }
    state.data.scenarios.set(scenarios)
  }
}

// =============================================================================
// REPL Command Execution
// =============================================================================

interface CommandResult {
  output: string
  isError: boolean
}

const executeReplCommand = (
  input: string,
  ava: AvaStx
): Effect.Effect<CommandResult, never, never> =>
  Effect.gen(function* () {
    if (!input.startsWith('!')) {
      // Treat as expression evaluation
      try {
        const result = eval(input)
        return {
          output: typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result),
          isError: false,
        }
      } catch (err) {
        return { output: `Error: ${err}`, isError: true }
      }
    }

    const parts = input.slice(1).split(/\s+/)
    const cmd = parts[0].toLowerCase()
    const args = parts.slice(1)

    switch (cmd) {
      case 'help':
        return {
          output: [
            'Available commands:',
            '  !help          Show this help',
            '  !list          List all views',
            '  !connect       Connect to WebSocket',
            '  !disconnect    Disconnect from WebSocket',
            '  !ping          Send ping',
            '  !subscribe <id> Subscribe to view',
            '  !select <id>   Select and fetch view',
            '  !register      Register test view',
            '  !status        Show connection status',
            '  !clear         Clear message log',
            '  !json          Show artifact JSON',
          ].join('\n'),
          isError: false,
        }

      case 'list': {
        yield* fromStxEffect(() => ava.effects.fetchViews())
        const views = ava.data.views.get()
        if (views.length === 0) return { output: 'No views registered', isError: false }
        const lines = views.map(v => `  ${v.id.padEnd(20)} ${v.name} (v${v.version})`)
        return { output: `Views (${views.length}):\n${lines.join('\n')}`, isError: false }
      }

      case 'connect': {
        const snapshot = ava.actor?.getSnapshot()
        if (snapshot?.matches('connected')) {
          return { output: 'Already connected', isError: false }
        }
        yield* fromStxEffect(() => ava.effects.connectSession())
        return { output: 'Connecting...', isError: false }
      }

      case 'disconnect': {
        const snapshot = ava.actor?.getSnapshot()
        if (!snapshot?.matches('connected')) {
          return { output: 'Not connected', isError: false }
        }
        yield* fromStxEffect(() => ava.effects.disconnectSession())
        return { output: 'Disconnected', isError: false }
      }

      case 'ping': {
        const snapshot = ava.actor?.getSnapshot()
        if (!snapshot?.matches('connected')) {
          return { output: 'Error: Not connected', isError: true }
        }
        yield* fromStxEffect(() => ava.effects.sendPing())
        return { output: 'Ping sent', isError: false }
      }

      case 'subscribe': {
        if (!args[0]) return { output: 'Usage: !subscribe <view-id>', isError: true }
        const snapshot = ava.actor?.getSnapshot()
        if (!snapshot?.matches('connected')) {
          return { output: 'Error: Not connected', isError: true }
        }
        yield* fromStxEffect(() => ava.effects.subscribeToView(args[0]))
        return { output: `Subscribed to ${args[0]}`, isError: false }
      }

      case 'select': {
        if (!args[0]) return { output: 'Usage: !select <view-id>', isError: true }
        yield* fromStxEffect(() => ava.effects.selectView(args[0]))
        const spec = ava.data.selectedView.get()
        if (spec) {
          return { output: `Selected: ${spec.name} (${spec.channels.length} channels)`, isError: false }
        }
        return { output: 'View not found', isError: true }
      }

      case 'register':
        yield* fromStxEffect(() => ava.effects.registerTestView())
        return { output: 'Test view registered', isError: false }

      case 'status': {
        const snapshot = ava.actor?.getSnapshot()
        const state = snapshot?.value ?? 'unknown'
        const config = ava.data.config.get()
        const views = ava.data.views.get()
        const messages = ava.data.messageLog.get()
        return {
          output: [
            `Connection: ${state}`,
            `Endpoint:   ${config.baseUrl}`,
            `Views:      ${views.length}`,
            `Messages:   ${messages.length}`,
          ].join('\n'),
          isError: false,
        }
      }

      case 'clear':
        ava.data.messageLog.set([])
        return { output: 'Message log cleared', isError: false }

      case 'json': {
        const artifact = ava.data.artifact.get()
        if (!artifact) return { output: 'No artifact selected', isError: true }
        return { output: JSON.stringify(artifact, null, 2), isError: false }
      }

      default:
        return { output: `Unknown command: ${cmd}. Type !help for available commands.`, isError: true }
    }
  })

// =============================================================================
// Computed Values
// =============================================================================

const testbedComputed = {
  replEntryCount: (get: TestbedStx) => get.data.replHistory.get().length,
  sequenceEventCount: (get: TestbedStx) => get.data.sequenceEvents.get().length,
  currentHistoryCommand: (get: TestbedStx) => {
    const idx = get.data.replHistoryIndex.get()
    const history = get.data.replCommandHistory.get()
    return idx >= 0 ? history[idx] : ''
  },
  isPanelExpanded: (panel: TestbedPanel) => (get: TestbedStx) =>
    get.data.expandedPanels.get().includes(panel),
}

// =============================================================================
// stx Instance Type
// =============================================================================

export type TestbedStx = StxInstance<
  TestbedData,
  typeof testbedMachine,
  typeof testbedEffects,
  typeof testbedComputed
>

// =============================================================================
// Singleton Instance
// =============================================================================

let testbedStxInstance: TestbedStx | null = null

/**
 * Get or create the Testbed UI stx instance
 */
export const getTestbedStx = (): TestbedStx => {
  if (!testbedStxInstance) {
    testbedStxInstance = stx({
      machine: testbedMachine,
      data: initialData,
      effects: testbedEffects,
      computed: testbedComputed,
    }) as TestbedStx
  }
  return testbedStxInstance
}

/**
 * Reset the Testbed stx instance (for testing)
 */
export const resetTestbedStx = (): void => {
  if (testbedStxInstance) {
    testbedStxInstance.dispose()
    testbedStxInstance = null
  }
}
