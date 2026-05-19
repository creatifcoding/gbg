/** IIoT Reactor consistency services. */

export {
  ReactorRegistry,
  ReactorRegistryLayer,
  makeReactorRegistry,
  type EntityReactionCapability,
  type EntityReactionContract,
  type EventObservationSpec,
  type ReactorRegistryConfig,
  type ReactorRegistryShape,
} from './ReactorRegistry'

export {
  ReactorPlanner,
  ReactorPlannerLive,
  type ReactorPlannerShape,
} from './ReactorPlanner'

export {
  ReactorDispatcher,
  ReactorDispatcherLive,
  type ReactorDispatcherShape,
} from './ReactorDispatcher'

export {
  Reactor,
  ReactorLive,
  type ReactorShape,
} from './Reactor'

export {
  ProcessJournalEntryRpc,
  ReactorWorkerEntity,
  ReactorWorkerEntityHandlers,
  ReactorWorkerEntityType,
  ReactorWorkerError,
  ReactorWorkerProcessJournalEntryTag,
  ReactorWorkerProcessResult,
} from './ReactorWorkerEntity'

export {
  EquipmentStateChangedObservationSpec,
  FaultDetectedObservationSpec,
  MaintenanceModeEnteredObservationSpec,
  ReactiveEquipmentStateObservationSpecs,
} from './observations'

export {
  makeWorkOrderReactionContract,
} from './contracts/work-order'

export {
  ReactorGenericLive,
  ReactorGenericWorkOrderRegistryLive,
} from './layers'

export {
  MachineMaintenanceFact,
  RelationshipReactor,
  RelationshipReactorLive,
  WorkOrderEntityReactorDispatcherLive,
  WorkOrderReactorDecision,
  WorkOrderReactorDispatchOutcome,
  WorkOrderReactorDispatchResult,
  WorkOrderReactorDispatcher,
  WorkOrderReactorPlan,
  WorkOrderReactorRunResult,
  WorkOrderReactorSkipReason,
  type RelationshipReactorShape,
  type WorkOrderReactorDispatcherShape,
} from './RelationshipReactor'
