/**
 * SIOS — State Service Exports
 *
 * All 9 state services + combined in-memory layers for testing.
 *
 * @module sios/state
 */

import { Layer } from 'effect'

// ─── EVM Triad ───
export {
  WorkPackageState, WorkPackageStateInMemory, WorkPackageStateNotFoundError,
  type WorkPackageStateShape, type WorkPackageFilter,
} from './WorkPackageState'

export {
  TaskState, TaskStateInMemory, TaskStateNotFoundError,
  type TaskStateShape, type TaskFilter,
} from './TaskState'

export {
  TimeEntryState, TimeEntryStateInMemory, TimeEntryStateNotFoundError,
  type TimeEntryStateShape, type TimeEntryFilter, type TimeEntryAggregate,
} from './TimeEntryState'

// ─── Remaining 6 ───
export {
  ProjectState, ProjectStateInMemory, ProjectStateNotFoundError,
  type ProjectStateShape, type ProjectFilter,
} from './ProjectState'

export {
  ZoneState, ZoneStateInMemory, ZoneStateNotFoundError,
  type ZoneStateShape, type ZoneFilter,
} from './ZoneState'

export {
  CrewState, CrewStateInMemory, CrewStateNotFoundError,
  type CrewStateShape, type CrewFilter,
} from './CrewState'

export {
  WorkerState, WorkerStateInMemory, WorkerStateNotFoundError,
  type WorkerStateShape, type WorkerFilter,
} from './WorkerState'

export {
  IssueState, IssueStateInMemory, IssueStateNotFoundError,
  type IssueStateShape, type IssueFilter,
} from './IssueState'

export {
  CheckpointState, CheckpointStateInMemory, CheckpointStateNotFoundError,
  type CheckpointStateShape, type CheckpointFilter,
} from './CheckpointState'

// =============================================================================
// Combined Layers
// =============================================================================

import { WorkPackageStateInMemory } from './WorkPackageState'
import { TaskStateInMemory } from './TaskState'
import { TimeEntryStateInMemory } from './TimeEntryState'
import { ProjectStateInMemory } from './ProjectState'
import { ZoneStateInMemory } from './ZoneState'
import { CrewStateInMemory } from './CrewState'
import { WorkerStateInMemory } from './WorkerState'
import { IssueStateInMemory } from './IssueState'
import { CheckpointStateInMemory } from './CheckpointState'

/** EVM triad only (WorkPackage + Task + TimeEntry) */
export const AllTriadStateInMemory = Layer.mergeAll(
  WorkPackageStateInMemory,
  TaskStateInMemory,
  TimeEntryStateInMemory,
)

/** All 9 entity state services — in-memory */
export const AllStateServicesInMemory = Layer.mergeAll(
  WorkPackageStateInMemory,
  TaskStateInMemory,
  TimeEntryStateInMemory,
  ProjectStateInMemory,
  ZoneStateInMemory,
  CrewStateInMemory,
  WorkerStateInMemory,
  IssueStateInMemory,
  CheckpointStateInMemory,
)
