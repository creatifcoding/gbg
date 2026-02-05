/**
 * Conductor — Agent orchestration for TMNL
 *
 * Spawn, drive, and orchestrate multiple pi agents from within the app.
 * Effect services for lifecycle, effect-atom for reactive state, Schema for specs.
 *
 * ```
 * ┌─────────────────────────────────────────────────────────┐
 * │  ConductorPanel (React)                                  │
 * │  ┌──────────┐ ┌──────────────────────────────────────┐  │
 * │  │ Agent    │ │ Terminal (xterm.js via session handle)│  │
 * │  │ Sidebar  │ │                                       │  │
 * │  │ ┌──────┐ │ │ AgentTabBar                           │  │
 * │  │ │Card  │ │ ├──────────────────────────────────────┤  │
 * │  │ │Card  │ │ │ WorkflowProgress                     │  │
 * │  │ │Card  │ │ │ ■ ■ ■ ● □ □                          │  │
 * │  │ └──────┘ │ └──────────────────────────────────────┘  │
 * │  └──────────┘                                            │
 * ├──────────────────────────────────────────────────────────┤
 * │  effect-atom (conductorStateAtom, derived atoms)         │
 * ├──────────────────────────────────────────────────────────┤
 * │  ConductorService (spawn, prompt, poll, workflow)        │
 * │  ↕ Effect.gen + Match for step execution                 │
 * ├──────────────────────────────────────────────────────────┤
 * │  TerminalSessionManager (PTY process lifecycle)          │
 * └──────────────────────────────────────────────────────────┘
 * ```
 *
 * @module
 */

// Schemas
export {
  AgentRole,
  AwarenessLevel,
  AgentStatus,
  AgentSpec,
  AgentInstance,
  StepType,
  StepRef,
  AgentStep,
  QuestionnaireStep,
  GateStep,
  ParallelStep,
  SequenceStep,
  WorkflowStep,
  Workflow,
  StepResult,
  ConductorError,
} from './schemas'

// Services
export {
  ConductorService,
  type ConductorServiceShape,
  type ConductorState,
  ConductorServiceLive,
} from './services'

// Atoms
export {
  conductorStateAtom,
  agentsAtom,
  agentListAtom,
  agentsByRoleAtom,
  activeAgentCountAtom,
  isAnyAgentWorkingAtom,
  workflowStatusAtom,
  workflowProgressAtom,
  currentStepAtom,
  stepResultsAtom,
  agentAtom,
  stepResultAtom,
} from './atoms'

// Registry
export { conductorRegistry, ConductorRegistryProvider } from './atoms/registry'

// Components
export {
  AgentStatusDot,
  AgentCard,
  AgentTabBar,
  AgentTerminal,
  WorkflowProgress,
  ConductorPanel,
  type AgentCardProps,
  type AgentTabBarProps,
  type AgentTerminalProps,
  type ConductorPanelProps,
  ConductorView,
  type ConductorViewProps,
} from './components'
