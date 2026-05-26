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
  AreaDecommissionedObservationSpec,
  DeviceAvailabilityObservationSpecs,
  DeviceDecommissionedObservationSpec,
  EnterpriseDecommissionedObservationSpec,
  EquipmentStateChangedObservationSpec,
  ExternalAvailabilityObservationSpecs,
  ExternalRefLinkedAvailabilityObservationSpec,
  ExternalRefUnlinkedAvailabilityObservationSpec,
  FaultDetectedObservationSpec,
  LineDecommissionedObservationSpec,
  MachineDecommissionedObservationSpec,
  MaintenanceModeEnteredObservationSpec,
  PlantDecommissionedObservationSpec,
  ReactiveEquipmentStateObservationSpecs,
  SensorDecommissionedObservationSpec,
  SiteDecommissionedObservationSpec,
  StructuralDecommissionObservationSpecs,
  WorkOrderCancelledObservationSpec,
  WorkOrderCompletedObservationSpec,
  WorkOrderDependencyObservationSpecs,
  WorkCellDecommissionedObservationSpec,
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
  StructuralLifecycleEntityTypes,
  makeStructuralLifecycleInheritedContracts,
} from './contracts/structural'
export {
  WorkOrderDependencyRelease,
  WorkOrderDependencyReleaseLive,
  WorkOrderDependencyReleaseTransition,
  WorkOrderDependencyReleaseTransitionEntityLive,
  type WorkOrderDependencyReleaseShape,
  type WorkOrderDependencyReleaseTransitionShape,
} from './contracts/WorkOrderDependencyRelease'

export {
  ReactorAlarmSafetyLive,
  ReactorAlarmSafetyObservationSpecs,
  ReactorAlarmSafetyPropagationPolicies,
  ReactorAlarmSafetyRegistryLive,
  ReactorAllDeclaredLive,
  ReactorAllDeclaredObservationSpecs,
  ReactorAllDeclaredPropagationPolicies,
  ReactorAllDeclaredRegistryLive,
  ReactorBaselineLive,
  ReactorBaselineObservationSpecs,
  ReactorBaselinePropagationPolicies,
  ReactorBaselineRegistryLive,
  ReactorDependsOnLive,
  ReactorDependsOnObservationSpecs,
  ReactorDependsOnPropagationPolicies,
  ReactorDependsOnRegistryLive,
  ReactorEquipmentAvailabilityObservationSpecs,
  ReactorEquipmentAvailabilityPropagationPolicies,
  ReactorExternalDeviceAvailabilityLive,
  ReactorExternalDeviceAvailabilityObservationSpecs,
  ReactorExternalDeviceAvailabilityPropagationPolicies,
  ReactorExternalDeviceAvailabilityRegistryLive,
  ReactorGenericLive,
  ReactorGenericWorkOrderRegistryLive,
  ReactorStructuralDecommissionLive,
  ReactorStructuralDecommissionObservationSpecs,
  ReactorStructuralDecommissionPropagationPolicies,
  ReactorStructuralDecommissionRegistryLive,
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
