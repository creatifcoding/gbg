/** Reactor layer presets. */

import { Effect, Layer } from 'effect'
import {
  AlarmSafetyHoldPropagationPolicies,
  ExternalDeviceRequiresAvailabilityPropagationPolicies,
  RequiresEquipmentUnavailableBlocksSource,
  StructuralDecommissionPropagationPolicies,
  TargetsMachineUnavailableBlocksSource,
  WorkOrderDependsOnPropagationPolicies,
  type RelationshipPropagationPolicy,
} from '../../schemas/relationships'
import {
  makeReactorRegistry,
  ReactorRegistry,
} from './ReactorRegistry'
import { ReactorAdmissionControlLive } from './ReactorAdmissionControl'
import { ReactorDispatcherLive } from './ReactorDispatcher'
import { ReactorLive } from './Reactor'
import { ReactorPlannerLive } from './ReactorPlanner'
import {
  AlarmSafetyObservationSpecs,
  DeviceAvailabilityObservationSpecs,
  ExternalAvailabilityObservationSpecs,
  ReactiveEquipmentStateObservationSpecs,
  StructuralDecommissionObservationSpecs,
  WorkOrderDependencyObservationSpecs,
  type EventObservationSpec,
} from './observations'
import { makeWorkOrderReactionContract } from './contracts/work-order'
import { makeStructuralLifecycleInheritedContracts } from './contracts/structural'

export const ReactorEquipmentAvailabilityObservationSpecs = ReactiveEquipmentStateObservationSpecs
export const ReactorEquipmentAvailabilityPropagationPolicies = [
  TargetsMachineUnavailableBlocksSource,
  RequiresEquipmentUnavailableBlocksSource,
] as const

export const ReactorBaselineObservationSpecs = ReactorEquipmentAvailabilityObservationSpecs
export const ReactorBaselinePropagationPolicies = ReactorEquipmentAvailabilityPropagationPolicies

export const ReactorDependsOnObservationSpecs = WorkOrderDependencyObservationSpecs
export const ReactorDependsOnPropagationPolicies = WorkOrderDependsOnPropagationPolicies

export const ReactorAlarmSafetyObservationSpecs = AlarmSafetyObservationSpecs
export const ReactorAlarmSafetyPropagationPolicies = AlarmSafetyHoldPropagationPolicies

export const ReactorStructuralDecommissionObservationSpecs = StructuralDecommissionObservationSpecs
export const ReactorStructuralDecommissionPropagationPolicies = StructuralDecommissionPropagationPolicies

export const ReactorExternalDeviceAvailabilityObservationSpecs = [
  ...ExternalAvailabilityObservationSpecs,
  ...DeviceAvailabilityObservationSpecs,
] as const
export const ReactorExternalDeviceAvailabilityPropagationPolicies = ExternalDeviceRequiresAvailabilityPropagationPolicies

export const ReactorAllDeclaredObservationSpecs = [
  ...ReactorBaselineObservationSpecs,
  ...ReactorDependsOnObservationSpecs,
  ...ReactorAlarmSafetyObservationSpecs,
  ...ReactorStructuralDecommissionObservationSpecs,
  ...ReactorExternalDeviceAvailabilityObservationSpecs,
] as const

export const ReactorAllDeclaredPropagationPolicies = [
  ...ReactorBaselinePropagationPolicies,
  ...ReactorDependsOnPropagationPolicies,
  ...ReactorAlarmSafetyPropagationPolicies,
  ...ReactorStructuralDecommissionPropagationPolicies,
  ...ReactorExternalDeviceAvailabilityPropagationPolicies,
] as const

const makeWorkOrderRegistryLayer = (input: {
  readonly observations: readonly EventObservationSpec[]
  readonly propagationPolicies: readonly RelationshipPropagationPolicy[]
  readonly structuralLifecycleInherited?: boolean
}) => Layer.effect(
  ReactorRegistry,
  Effect.gen(function* () {
    const workOrderContract = yield* makeWorkOrderReactionContract
    const structuralContracts = input.structuralLifecycleInherited
      ? makeStructuralLifecycleInheritedContracts()
      : []

    return ReactorRegistry.of(makeReactorRegistry({
      observations: input.observations,
      propagationPolicies: input.propagationPolicies,
      entities: [workOrderContract, ...structuralContracts],
    }))
  }),
)

/**
 * Baseline production lane: equipment unavailable → WorkOrder dependency.blocked.
 * This remains the default live registry.
 */
export const ReactorGenericWorkOrderRegistryLive = makeWorkOrderRegistryLayer({
  observations: ReactorBaselineObservationSpecs,
  propagationPolicies: ReactorBaselinePropagationPolicies,
})

/** Alias for clarity in v2 activation discussions. */
export const ReactorBaselineRegistryLive = ReactorGenericWorkOrderRegistryLive

/** Opt-in lane bundle: baseline + WorkOrder depends_on declarations. */
export const ReactorDependsOnRegistryLive = makeWorkOrderRegistryLayer({
  observations: [
    ...ReactorBaselineObservationSpecs,
    ...ReactorDependsOnObservationSpecs,
  ],
  propagationPolicies: [
    ...ReactorBaselinePropagationPolicies,
    ...ReactorDependsOnPropagationPolicies,
  ],
})

/** Opt-in lane bundle: baseline + alarm safety-hold declarations. */
export const ReactorAlarmSafetyRegistryLive = makeWorkOrderRegistryLayer({
  observations: [
    ...ReactorBaselineObservationSpecs,
    ...ReactorAlarmSafetyObservationSpecs,
  ],
  propagationPolicies: [
    ...ReactorBaselinePropagationPolicies,
    ...ReactorAlarmSafetyPropagationPolicies,
  ],
})

/** Opt-in lane bundle: baseline + structural decommission declarations. */
export const ReactorStructuralDecommissionRegistryLive = makeWorkOrderRegistryLayer({
  observations: [
    ...ReactorBaselineObservationSpecs,
    ...ReactorStructuralDecommissionObservationSpecs,
  ],
  propagationPolicies: [
    ...ReactorBaselinePropagationPolicies,
    ...ReactorStructuralDecommissionPropagationPolicies,
  ],
  structuralLifecycleInherited: true,
})

/** Opt-in lane bundle: baseline + external/device availability declarations. */
export const ReactorExternalDeviceAvailabilityRegistryLive = makeWorkOrderRegistryLayer({
  observations: [
    ...ReactorBaselineObservationSpecs,
    ...ReactorExternalDeviceAvailabilityObservationSpecs,
  ],
  propagationPolicies: [
    ...ReactorBaselinePropagationPolicies,
    ...ReactorExternalDeviceAvailabilityPropagationPolicies,
  ],
})

/** All declared candidate bundles together. Use for diagnostics, not default runtime. */
export const ReactorAllDeclaredRegistryLive = makeWorkOrderRegistryLayer({
  observations: ReactorAllDeclaredObservationSpecs,
  propagationPolicies: ReactorAllDeclaredPropagationPolicies,
  structuralLifecycleInherited: true,
})

const makeReactorLiveWithRegistry = (registry: Layer.Layer<ReactorRegistry>) => ReactorLive.pipe(
  Layer.provide(ReactorDispatcherLive.pipe(Layer.provide(ReactorAdmissionControlLive))),
  Layer.provide(ReactorPlannerLive),
  Layer.provide(registry),
  Layer.provide(ReactorAdmissionControlLive),
)

export const ReactorGenericLive = makeReactorLiveWithRegistry(ReactorGenericWorkOrderRegistryLive)
export const ReactorBaselineLive = ReactorGenericLive
export const ReactorDependsOnLive = makeReactorLiveWithRegistry(ReactorDependsOnRegistryLive)
export const ReactorAlarmSafetyLive = makeReactorLiveWithRegistry(ReactorAlarmSafetyRegistryLive)
export const ReactorStructuralDecommissionLive = makeReactorLiveWithRegistry(ReactorStructuralDecommissionRegistryLive)
export const ReactorExternalDeviceAvailabilityLive = makeReactorLiveWithRegistry(ReactorExternalDeviceAvailabilityRegistryLive)
export const ReactorAllDeclaredLive = makeReactorLiveWithRegistry(ReactorAllDeclaredRegistryLive)
