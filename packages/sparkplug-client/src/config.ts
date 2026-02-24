/**
 * SparkplugConfig — Effect Schema configuration for Sparkplug B client.
 *
 * Four nested groups with spec-compliant defaults:
 * - mqtt: session settings (clean, keepalive)
 * - will: NDEATH Will message settings (QoS 1, no retain)
 * - publish: BIRTH/DATA publish settings (QoS 0, no retain)
 * - state: STATE message settings (QoS 1, retain)
 *
 * Zero config = industry standard. Override any knob individually.
 *
 * @module @selfcharters/sparkplug-client/config
 * @see Sparkplug 3.0.0 Spec §5 Operational Behavior
 */

import { Schema } from 'effect'

// =============================================================================
// Nested config groups
// =============================================================================

/** MQTT session-level settings */
export const MqttSessionConfig = Schema.Struct({
  /** Clean session flag. Sparkplug MUST be true. */
  cleanSession: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Keepalive interval in seconds */
  keepalive: Schema.optionalWith(Schema.Number, { default: () => 65 }),
  /** Reconnect period in ms (0 = disabled) */
  reconnectPeriod: Schema.optionalWith(Schema.Number, { default: () => 1000 }),
  /** Connect timeout in ms */
  connectTimeout: Schema.optionalWith(Schema.Number, { default: () => 30000 }),
})

/** Will message settings (NDEATH). Spec: QoS 1, retain false. */
export const WillConfig = Schema.Struct({
  /** QoS for Will/NDEATH message. Spec: MUST be 1. */
  qos: Schema.optionalWith(
    Schema.Literal(0, 1, 2),
    { default: () => 1 as const }
  ),
  /** Retain for Will/NDEATH. Spec: MUST be false. */
  retain: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})

/** Publish settings for BIRTH/DATA messages. Spec: QoS 0, retain false. */
export const PublishConfig = Schema.Struct({
  /** QoS for BIRTH/DATA publishes. Spec: MUST be 0. */
  qos: Schema.optionalWith(
    Schema.Literal(0, 1, 2),
    { default: () => 0 as const }
  ),
  /** Retain for BIRTH/DATA publishes. Spec: MUST be false. */
  retain: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})

/** STATE message settings (Host Application). */
export const StateConfig = Schema.Struct({
  /** Whether this client publishes STATE messages */
  enabled: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** QoS for STATE messages. Spec: MUST be 1. */
  qos: Schema.optionalWith(
    Schema.Literal(0, 1, 2),
    { default: () => 1 as const }
  ),
  /** Retain for STATE messages. Spec: MUST be true. */
  retain: Schema.optionalWith(Schema.Boolean, { default: () => true }),
})

// =============================================================================
// SparkplugConfig — Top-level
// =============================================================================

/**
 * Sparkplug B client configuration.
 *
 * All nested groups are optional with spec-compliant defaults.
 * Zero config produces a standards-compliant Sparkplug B client.
 */
export const SparkplugConfig = Schema.TaggedStruct('SparkplugConfig', {
  /** MQTT broker URL (e.g., mqtt://localhost:1883) */
  serverUrl: Schema.String,
  /** Sparkplug group ID */
  groupId: Schema.String,
  /** Edge node identifier */
  edgeNodeId: Schema.String,
  /** MQTT client ID (auto-generated if not provided) */
  clientId: Schema.optional(Schema.String),
  /** MQTT username */
  username: Schema.optional(Schema.String),
  /** MQTT password */
  password: Schema.optional(Schema.String),
  /** MQTT session config */
  mqtt: Schema.optionalWith(MqttSessionConfig, {
    default: () => ({ cleanSession: true, keepalive: 65, reconnectPeriod: 1000, connectTimeout: 30000 }),
  }),
  /** NDEATH Will message config */
  will: Schema.optionalWith(WillConfig, {
    default: () => ({ qos: 1 as const, retain: false }),
  }),
  /** BIRTH/DATA publish config */
  publish: Schema.optionalWith(PublishConfig, {
    default: () => ({ qos: 0 as const, retain: false }),
  }),
  /** STATE message config */
  state: Schema.optionalWith(StateConfig, {
    default: () => ({ enabled: false, qos: 1 as const, retain: true }),
  }),
})
export type SparkplugConfig = Schema.Schema.Type<typeof SparkplugConfig>
