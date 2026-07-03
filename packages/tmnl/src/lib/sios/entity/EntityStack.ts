/**
 * SIOS Entity Stack — Layer Composition (all 9 entities)
 * @module sios/entity/EntityStack
 */

import { Layer } from 'effect'
import { ProjectEntityHandlers } from './ProjectEntity'
import { ZoneEntityHandlers } from './ZoneEntity'
import { WorkPackageEntityHandlers } from './WorkPackageEntity'
import { TaskEntityHandlers } from './TaskEntity'
import { CrewEntityHandlers } from './CrewEntity'
import { WorkerEntityHandlers } from './WorkerEntity'
import { IssueEntityHandlers } from './IssueEntity'
import { CheckpointEntityHandlers } from './CheckpointEntity'
import { AllStateServicesInMemory, AllTriadStateInMemory } from '../state'
import { SiosFlagsDisabledLayer, SiosFlagsEnabledLayer } from '../infrastructure'

// =============================================================================
// All Entity Handlers
// =============================================================================

/** All 9 entity handlers merged */
export const AllEntityHandlers = Layer.mergeAll(
  ProjectEntityHandlers,
  ZoneEntityHandlers,
  WorkPackageEntityHandlers,
  TaskEntityHandlers,
  CrewEntityHandlers,
  WorkerEntityHandlers,
  IssueEntityHandlers,
  CheckpointEntityHandlers,
)

/** EVM triad only */
export const TriadEntityHandlers = Layer.mergeAll(
  WorkPackageEntityHandlers,
  TaskEntityHandlers,
)

// =============================================================================
// Testing Stacks
// =============================================================================

/** EVM triad with in-memory state (backwards compat) */
export const TriadTestingStack = TriadEntityHandlers.pipe(
  Layer.provide(AllTriadStateInMemory),
  Layer.provide(SiosFlagsDisabledLayer),
)

/** Full 9-entity testing stack with in-memory state */
export const FullTestingStack = AllEntityHandlers.pipe(
  Layer.provide(AllStateServicesInMemory),
  Layer.provide(SiosFlagsDisabledLayer),
)

// =============================================================================
// Production (partial — needs SQL state layers)
// =============================================================================

export const AllProductionHandlers = AllEntityHandlers.pipe(
  Layer.provide(SiosFlagsEnabledLayer),
)

export const TriadProductionHandlers = TriadEntityHandlers.pipe(
  Layer.provide(SiosFlagsEnabledLayer),
)
