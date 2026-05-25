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
  ReactorAdmissionControl,
  ReactorAdmissionControlConfigDefaults,
  ReactorAdmissionControlLive,
  ReactorAdmissionControlPassthroughLive,
  makeReactorAdmissionControlLive,
  reactorAdmissionControlPassthrough,
  type ReactorAdmissionControlConfig,
  type ReactorAdmissionControlShape,
  type ReactorSourceEntryClaimKey,
} from './ReactorAdmissionControl'

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
  AlarmClearedObservationSpec,
  AlarmEscalatedObservationSpec,
  AlarmSafetyObservationSpecs,
  AlarmTriggeredObservationSpec,
  EquipmentStateChangedObservationSpec,
  FaultDetectedObservationSpec,
  MaintenanceModeEnteredObservationSpec,
  ReactiveEquipmentStateObservationSpecs,
  WorkOrderCancelledObservationSpec,
  WorkOrderCompletedObservationSpec,
  WorkOrderDependencyObservationSpecs,
  WorkOrderFailedObservationSpec,
  WorkOrderResumedObservationSpec,
  WorkOrderSuspendedObservationSpec,
} from './observations'

export {
  EXPLICIT_EVENT_ROUTING_CONTRACT_TAGS,
  EventRoutingContract,
  EventRoutingKind,
  EventRoutingProofRequirement,
  EventRoutingRelationshipPath,
  EventRoutingSubject,
  ReactorEventCoverageEntry,
  ReactorEventCoverageStatus,
  ReactorEventGroupName,
  ReactorRelationshipCoverageEntry,
  ReactorRelationshipCoverageStatus,
  ReactorTopologyAtlas,
  ReactorTopologyStats,
  getEventRoutingContracts,
  getIiotEventGroupTags,
  getReactorEventCoverageEntries,
  getReactorRelationshipCoverageEntries,
  getReactorTopologyAtlas,
} from './topology-atlas'

export {
  ReactorConstraintAddressRequired,
  ReactorConstraintAuthority,
  ReactorConstraintAuthoritySqlLive,
  type ReactorConstraintAuthorityError,
  type ReactorConstraintAuthorityShape,
} from './ReactorConstraintAuthority'
export {
  TargetConstraintLedger,
  TargetConstraintLedgerInMemory,
  type TargetConstraintLedgerShape,
} from './constraints'

export {
  makeWorkOrderReactionContract,
} from './contracts/work-order'
export {
  WorkOrderDependencyRelease,
  WorkOrderDependencyReleaseLive,
  WorkOrderDependencyReleaseTransition,
  WorkOrderDependencyReleaseTransitionEntityLive,
  type WorkOrderDependencyReleaseShape,
  type WorkOrderDependencyReleaseTransitionShape,
} from './contracts/WorkOrderDependencyRelease'

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
