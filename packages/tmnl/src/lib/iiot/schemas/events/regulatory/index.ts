/**
 * Regulatory Events - Compliance and Audit Trail Events
 *
 * Exports all regulatory event schemas for IIoT event sourcing.
 *
 * @module @gbg/tmnl/iiot/schemas/events/regulatory
 * @see FDA 21 CFR Part 11 for electronic records compliance
 */

// Operator Events (EL-5.10-13)
export {
  // Branded Types
  SessionId,
  OverrideId,
  AcknowledgmentId,
  HandoffId,
  // Enums
  AuthMethod,
  LogoutReason,
  AcknowledgmentTargetType,
  // Events
  OperatorLogin,
  OperatorLogout,
  ParameterOverride,
  ManualAcknowledgment,
  ShiftHandoff,
  // Tags and Union
  OPERATOR_EVENT_TAGS,
  type OperatorLoginType,
  type OperatorLogoutType,
  type ParameterOverrideType,
  type ManualAcknowledgmentType,
  type ShiftHandoffType,
  type OperatorEvent,
  type OperatorEventTag,
} from './operator-events'
