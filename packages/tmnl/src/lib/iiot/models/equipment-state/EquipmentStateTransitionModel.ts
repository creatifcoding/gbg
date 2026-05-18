/**
 * EquipmentStateTransitionModel - Effect SQL Model for Equipment State Transitions
 *
 * Append-only transition audit for equipment state changes. Complements
 * iiot.equipment_states current/history rows with causal metadata for Reactor
 * propagation DAGs.
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import {
  EquipmentStateId,
  StateReason,
  StateType,
} from '../../schemas/equipment-state/schema'
import { MachineId } from '../../schemas/assets/machine/schema'
import { PropagationId } from '../../schemas/identifiers'

// =============================================================================
// Model Definition
// =============================================================================

export class EquipmentStateTransitionModel extends Model.Class<EquipmentStateTransitionModel>(
  'EquipmentStateTransitionModel'
)({
  /** Auto-generated UUID */
  id: Model.Generated(Schema.String),

  /** Machine whose equipment state changed */
  machineId: MachineId,

  /** New equipment state row created by this transition */
  equipmentStateId: EquipmentStateId,

  /** State before transition */
  fromState: StateType,

  /** State after transition */
  toState: StateType,

  /** Server-generated transition timestamp */
  transitionedAt: Model.Generated(Schema.DateFromSelf),

  /** Operator/system actor who performed the transition */
  transitionedBy: Model.FieldOption(Schema.String),

  /** Detailed transition reason */
  reason: Model.FieldOption(StateReason),

  /** Free-form notes for audit context */
  notes: Model.FieldOption(Schema.String),

  /** Local propagation id created by this source transition */
  propagationId: Model.FieldOption(PropagationId),

  /** Inbound propagation id that caused this transition, if any */
  causedByPropagationId: Model.FieldOption(PropagationId),
}) {}
