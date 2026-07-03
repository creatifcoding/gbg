/**
 * SIOS repository composition
 * @module sios/repos
 */

import { Layer } from 'effect'

import { ProjectRepoLive } from './ProjectRepo'
import { ZoneRepoLive } from './ZoneRepo'
import { WorkPackageRepoLive } from './WorkPackageRepo'
import { TaskRepoLive } from './TaskRepo'
import { TimeEntryRepoLive } from './TimeEntryRepo'
import { CrewRepoLive } from './CrewRepo'
import { WorkerRepoLive } from './WorkerRepo'
import { IssueRepoLive } from './IssueRepo'
import { CheckpointRepoLive } from './CheckpointRepo'

export const AllReposLive = Layer.mergeAll(
  ProjectRepoLive,
  ZoneRepoLive,
  WorkPackageRepoLive,
  TaskRepoLive,
  TimeEntryRepoLive,
  CrewRepoLive,
  WorkerRepoLive,
  IssueRepoLive,
  CheckpointRepoLive
)

export {
  ProjectRepo,
  ProjectRepoLive,
  type ProjectRepository,
  type ProjectRepoError,
} from './ProjectRepo'

export {
  ZoneRepo,
  ZoneRepoLive,
  type ZoneRepository,
  type ZoneRepoError,
} from './ZoneRepo'

export {
  WorkPackageRepo,
  WorkPackageRepoLive,
  type WorkPackageRepository,
  type WorkPackageRepoError,
  type WorkPackageActualsSummary,
} from './WorkPackageRepo'

export {
  TaskRepo,
  TaskRepoLive,
  type TaskRepository,
  type TaskRepoError,
} from './TaskRepo'

export {
  TimeEntryRepo,
  TimeEntryRepoLive,
  type TimeEntryRepository,
  type TimeEntryRepoError,
  type TimeEntryAggregate,
} from './TimeEntryRepo'

export {
  CrewRepo,
  CrewRepoLive,
  type CrewRepository,
  type CrewRepoError,
} from './CrewRepo'

export {
  WorkerRepo,
  WorkerRepoLive,
  type WorkerRepository,
  type WorkerRepoError,
} from './WorkerRepo'

export {
  IssueRepo,
  IssueRepoLive,
  type IssueRepository,
  type IssueRepoError,
} from './IssueRepo'

export {
  CheckpointRepo,
  CheckpointRepoLive,
  type CheckpointRepository,
  type CheckpointRepoError,
} from './CheckpointRepo'

export {
  prepareUpdate,
  decodeRow,
  decodeRows,
  decodeOptional,
  decodeFirst,
  type DecodeError,
} from './_decode'
