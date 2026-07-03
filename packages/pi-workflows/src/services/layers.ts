import { Layer, ManagedRuntime } from 'effect'
import { AtomRegistry } from 'effect/unstable/reactivity'

import { SubagentAdapterFake } from './SubagentAdapter'
import { WorkflowCompilerLive } from './WorkflowCompiler'
import { WorkflowJournalMemory } from './WorkflowJournal'
import { WorkflowRegistryLive } from './WorkflowRegistry'
import { WorkflowRuntimeLive } from './WorkflowRuntime'
import { WorkflowScriptRunnerVm } from './WorkflowScriptRunner'
import { WorkflowStoreAtom } from './WorkflowStore'

export const WorkflowStateLayer = WorkflowStoreAtom.pipe(Layer.provideMerge(AtomRegistry.layer))

export const WorkflowBaseLayer = Layer.mergeAll(
  WorkflowRegistryLive,
  WorkflowCompilerLive,
  WorkflowJournalMemory,
  WorkflowStateLayer,
  WorkflowScriptRunnerVm,
  SubagentAdapterFake,
)

export const WorkflowAppLayer = WorkflowRuntimeLive.pipe(Layer.provideMerge(WorkflowBaseLayer))

export const makeWorkflowManagedRuntime = () => ManagedRuntime.make(WorkflowAppLayer)

export type WorkflowManagedRuntime = ReturnType<typeof makeWorkflowManagedRuntime>
