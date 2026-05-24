/** Reactor layer presets. */

import { Effect, Layer } from 'effect'
import {
  RequiresEquipmentUnavailableBlocksSource,
  TargetsMachineUnavailableBlocksSource,
} from '../../schemas/relationships'
import {
  makeReactorRegistry,
  ReactorRegistry,
} from './ReactorRegistry'
import { ReactorAdmissionControlLive } from './ReactorAdmissionControl'
import { ReactorDispatcherLive } from './ReactorDispatcher'
import { ReactorLive } from './Reactor'
import { ReactorPlannerLive } from './ReactorPlanner'
import { ReactiveEquipmentStateObservationSpecs } from './observations'
import { makeWorkOrderReactionContract } from './contracts/work-order'

/**
 * Generic equivalent of the v1 Machine unavailable → WorkOrder consistency
 * slice, expressed as declarations instead of core branches.
 */
export const ReactorGenericWorkOrderRegistryLive = Layer.effect(
  ReactorRegistry,
  Effect.gen(function* () {
    const workOrderContract = yield* makeWorkOrderReactionContract

    return ReactorRegistry.of(makeReactorRegistry({
      observations: ReactiveEquipmentStateObservationSpecs,
      propagationPolicies: [
        TargetsMachineUnavailableBlocksSource,
        RequiresEquipmentUnavailableBlocksSource,
      ],
      entities: [workOrderContract],
    }))
  }),
)

export const ReactorGenericLive = ReactorLive.pipe(
  Layer.provide(ReactorDispatcherLive.pipe(Layer.provide(ReactorAdmissionControlLive))),
  Layer.provide(ReactorPlannerLive),
  Layer.provide(ReactorGenericWorkOrderRegistryLive),
  Layer.provide(ReactorAdmissionControlLive),
)
