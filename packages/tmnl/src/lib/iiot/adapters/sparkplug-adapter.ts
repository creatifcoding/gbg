/**
 * SparkplugAdapter — Sparkplug B protocol adapter for the IIoT ingestion pipeline.
 *
 * Implements IngestionAdapterShape using @selfcharters/sparkplug-client.
 * Subscribes to Sparkplug B topics, decodes protobuf payloads, manages
 * metric alias registries, and emits IngestedReading instances.
 *
 * Architecture:
 * - MqttTransport provides the raw MQTT stream
 * - AliasRegistry tracks metric name↔alias from BIRTH messages
 * - Message handler routes by Sparkplug message type
 * - Pipeline integration via IngestedReading emission
 *
 * @module @gbg/tmnl/iiot/adapters/sparkplug-adapter
 * @see Epic 27 (F27.1-F27.3)
 */

import {
  DateTime,
  Effect,
  HashMap,
  Layer,
  Ref,
  Schedule,
  Schema,
  Stream,
} from 'effect'
import { NatsKVService, type NatsKVServiceShape } from '../../holonet/nats/kv'
import {
  type SparkplugConfig,
  MqttTransport,
  MqttTransportLive,
  decodePayload,
  decodeMetricValue,
  extractQuality,
  parseTopic,
  SparkplugError,
  type UMetric,
} from '@selfcharters/sparkplug-client'
import {
  IngestionAdapter,
  IngestionError,
  IngestedReading,
  type IngestionHealth,
} from './ingestion'
import { type TopicRouterShape } from './device-routing'
// =============================================================================
// SparkplugAdapterConfig
// =============================================================================

/**
 * Configuration for the SparkplugAdapter.
 *
 * Adapter-specific settings wrapping a SparkplugConfig.
 */
export const SparkplugAdapterConfig = Schema.Struct({
  /** MQTT broker URL */
  serverUrl: Schema.String,
  /** Sparkplug group IDs to subscribe to */
  groupIds: Schema.Array(Schema.String),
  /** MQTT username */
  username: Schema.optional(Schema.String),
  /** MQTT password */
  password: Schema.optional(Schema.String),
  /** MQTT client ID */
  clientId: Schema.optional(Schema.String),
})
export type SparkplugAdapterConfig = Schema.Schema.Type<typeof SparkplugAdapterConfig>

// =============================================================================
// AliasRegistry — metric alias → name mapping per edge node
// =============================================================================

type NodeKey = string

export const makeNodeKey = (groupId: string, edgeNodeId: string): NodeKey =>
  `${groupId}:${edgeNodeId}`

export const makeAliasRegistry = Effect.gen(function* () {
  const registry = yield* Ref.make(
    HashMap.empty<NodeKey, HashMap.HashMap<number, string>>()
  )

  const registerBirth = (key: NodeKey, metrics: ReadonlyArray<UMetric>) =>
    Ref.update(registry, (outer) => {
      let inner = HashMap.empty<number, string>()
      for (const metric of metrics) {
        if (metric.alias != null && metric.name != null) {
          const alias = typeof metric.alias === 'number'
            ? metric.alias
            : (metric.alias as { toNumber(): number }).toNumber()
          inner = HashMap.set(inner, alias, metric.name)
        }
      }
      return HashMap.set(outer, key, inner)
    })

  const resolveAlias = (key: NodeKey, alias: number) =>
    Effect.gen(function* () {
      const outer = yield* Ref.get(registry)
      const inner = HashMap.get(outer, key)
      if (inner._tag === 'None') return null
      const name = HashMap.get(inner.value, alias)
      return name._tag === 'Some' ? name.value : null
    })

  const clearNode = (key: NodeKey) =>
    Ref.update(registry, (outer) => HashMap.remove(outer, key))

  return { registerBirth, resolveAlias, clearNode } as const
})

// =============================================================================
// STATE topic parsing (F27.3.3)
// =============================================================================

/**
 * Parse a Sparkplug B STATE topic.
 *
 * STATE topics follow the format: `spBv1.0/STATE/{host_app_id}`
 * These are NOT protobuf-encoded — they carry JSON or plain string payloads.
 *
 * Returns null if the topic is not a STATE topic.
 */
export const parseStateTopic = (topic: string): { hostAppId: string } | null => {
  const segments = topic.split('/')
  if (segments.length < 3) return null
  if (segments[0] !== 'spBv1.0' || segments[1] !== 'STATE') return null
  const hostAppId = segments[2]
  if (!hostAppId) return null
  return { hostAppId }
}

// =============================================================================
// StateRegistry — host application state tracking (F27.3.3)
// =============================================================================

/**
 * Create a StateRegistry that tracks host application ONLINE/OFFLINE state.
 *
 * Used for SCADA Primary/Standby awareness (HA). The adapter subscribes to
 * `spBv1.0/STATE/{host_app_id}` topics and registers state transitions.
 */
export const makeStateRegistry = Effect.gen(function* () {
  const registry = yield* Ref.make(
    HashMap.empty<string, 'ONLINE' | 'OFFLINE'>()
  )

  const registerState = (hostAppId: string, online: boolean) =>
    Ref.update(registry, (map) =>
      HashMap.set(map, hostAppId, online ? 'ONLINE' : 'OFFLINE')
    )

  const getState = (hostAppId: string) =>
    Effect.gen(function* () {
      const map = yield* Ref.get(registry)
      const state = HashMap.get(map, hostAppId)
      return state._tag === 'Some' ? state.value : null
    })

  return { registerState, getState } as const
})

// =============================================================================
// StateRegistryKV — KV-backed host application state tracking
// =============================================================================

/**
 * Schema for the persisted host application state entry.
 * Stored in NATS KV bucket `iiot-state` under key `host:{hostAppId}`.
 */
const HostStateEntry = Schema.Struct({
  online: Schema.Boolean,
  lastSeen: Schema.String,
})

/** The NATS KV bucket name for host application state. */
const STATE_BUCKET = 'iiot-state'

/**
 * Create a KV-backed StateRegistry that persists host application ONLINE/OFFLINE state.
 *
 * Uses NatsKVService to store state in NATS JetStream KV, surviving adapter restarts.
 * The bucket `iiot-state` is auto-created on first access by the underlying KV service.
 *
 * Returns the same `{ registerState, getState }` shape as `makeStateRegistry`,
 * so it can be used as a drop-in replacement in `processMessage`.
 *
 * @param kv - NatsKVService instance
 */
export const makeStateRegistryKV = (kv: NatsKVServiceShape) => {
  // NATS KV keys use '.' as separator (they become NATS subjects internally).
  // Colons are invalid in KV keys.
  const registerState = (hostAppId: string, online: boolean) =>
    kv.put(STATE_BUCKET, `host.${hostAppId}`, HostStateEntry, {
      online,
      lastSeen: new Date().toISOString(),
    }).pipe(Effect.ignoreLogged)

  const getState = (hostAppId: string) =>
    kv.getOrNull(STATE_BUCKET, `host.${hostAppId}`, HostStateEntry).pipe(
      Effect.map((entry) => entry ? (entry.online ? 'ONLINE' as const : 'OFFLINE' as const) : null),
      Effect.catchAll(() => Effect.succeed(null)),
    )

  return { registerState, getState } as const
}

// =============================================================================
// Message processing
// =============================================================================

/**
 * Process a single MQTT message into zero or more IngestedReading instances.
 *
 * Handles all Sparkplug B message types:
 * - STATE: Track host application ONLINE/OFFLINE (JSON payload, not protobuf)
 * - NBIRTH/DBIRTH: Register metric aliases (+ dynamic route on DBIRTH)
 * - NDEATH: Clear alias registry for the edge node
 * - DDATA/NDATA: Resolve aliases and produce IngestedReading instances
 *
 * @param aliasRegistry - Alias registry for metric name resolution
 * @param stateRegistry - State registry for host app state tracking
 * @param healthRef - Health state Ref for error/message tracking
 * @param msg - Raw MQTT message (topic + payload)
 * @param router - Optional TopicRouter for dynamic route registration on DBIRTH
 */
export const processMessage = (
  aliasRegistry: Effect.Effect.Success<typeof makeAliasRegistry>,
  stateRegistry: Effect.Effect.Success<typeof makeStateRegistry>,
  healthRef: Ref.Ref<IngestionHealth>,
  msg: { readonly topic: string; readonly payload: Buffer },
  router?: TopicRouterShape,
) =>
  Effect.gen(function* () {
    // Check for STATE topic first (different format, JSON payload)
    const stateParsed = parseStateTopic(msg.topic)
    if (stateParsed) {
      const payloadStr = msg.payload.toString('utf-8').trim()
      let online: boolean
      // STATE payload can be plain "ONLINE"/"OFFLINE" or JSON { online: boolean }
      if (payloadStr === 'ONLINE') {
        online = true
      } else if (payloadStr === 'OFFLINE') {
        online = false
      } else {
        try {
          const json = JSON.parse(payloadStr)
          online = Boolean(json.online)
        } catch {
          online = false
        }
      }
      yield* stateRegistry.registerState(stateParsed.hostAppId, online)
      return [] as IngestedReading[]
    }

    const parsed = parseTopic(msg.topic)
    if (!parsed) return [] as IngestedReading[]

    const { groupId, messageType, edgeNodeId, deviceId } = parsed
    const nodeKey = makeNodeKey(groupId, edgeNodeId)

    // Decode protobuf payload
    let payload
    try {
      payload = decodePayload(msg.payload)
    } catch {
      yield* Ref.update(healthRef, (h) => ({
        ...h,
        errorCount: h.errorCount + 1,
      }))
      return [] as IngestedReading[]
    }

    const metrics = payload.metrics ?? []

    switch (messageType) {
      case 'NBIRTH':
      case 'DBIRTH': {
        yield* aliasRegistry.registerBirth(nodeKey, metrics)

        // F27.3.4: Register dynamic route on DBIRTH (device-level only)
        if (messageType === 'DBIRTH' && deviceId && router) {
          yield* router.register({
            topicPattern: `spBv1.0/${groupId}/DDATA/${edgeNodeId}/${deviceId}/*`,
            deviceId: `${edgeNodeId}:${deviceId}`,
          })
        }

        return [] as IngestedReading[]
      }

      case 'NDEATH': {
        yield* aliasRegistry.clearNode(nodeKey)
        return [] as IngestedReading[]
      }

      case 'DDATA':
      case 'NDATA': {
        const readings: IngestedReading[] = []

        for (const metric of metrics) {
          let metricName = metric.name
          if (!metricName && metric.alias != null) {
            const alias = typeof metric.alias === 'number'
              ? metric.alias
              : (metric.alias as { toNumber(): number }).toNumber()
            const resolved = yield* aliasRegistry.resolveAlias(nodeKey, alias)
            if (resolved) metricName = resolved
          }
          if (!metricName) continue

          const value = decodeMetricValue(metric)
          if (value === null) continue

          const sourceQuality = extractQuality(metric)

          const readingTopic = deviceId
            ? `spBv1.0/${groupId}/DDATA/${edgeNodeId}/${deviceId}/${metricName}`
            : `spBv1.0/${groupId}/NDATA/${edgeNodeId}/${metricName}`

          readings.push(
            new IngestedReading({
              topic: readingTopic,
              value,
              sourceTimestamp: DateTime.unsafeNow(),
              sourceQuality,
            }),
          )
        }

        yield* Ref.update(healthRef, (h) => ({
          ...h,
          lastMessageAt: DateTime.unsafeNow(),
        }))

        return readings
      }

      default:
        return [] as IngestedReading[]
    }
  })

// =============================================================================
// makeGroupConfigs — derive one SparkplugConfig per groupId
// =============================================================================

/**
 * Derive one SparkplugConfig per groupId from adapter-level config.
 *
 * Each config gets:
 * - Unique edgeNodeId containing the groupId for traceability
 * - Unique clientId (suffixed with groupId) if clientId is provided
 * - Shared auth credentials and spec-compliant MQTT defaults
 */
export const makeGroupConfigs = (config: SparkplugAdapterConfig): SparkplugConfig[] =>
  config.groupIds.map((groupId) => ({
    _tag: 'SparkplugConfig' as const,
    serverUrl: config.serverUrl,
    groupId,
    edgeNodeId: `adapter-${groupId}-${Date.now()}`,
    clientId: config.clientId ? `${config.clientId}-${groupId}` : undefined,
    username: config.username,
    password: config.password,
    mqtt: { cleanSession: true, keepalive: 65, reconnectPeriod: 1000, connectTimeout: 30000 },
    will: { qos: 1 as const, retain: false },
    publish: { qos: 0 as const, retain: false },
    state: { enabled: false, qos: 1 as const, retain: true },
  }))

// =============================================================================
// Retry schedule — exponential backoff for reconnection (F27.1.3)
// =============================================================================

/**
 * Default retry schedule for subscribe reconnection.
 *
 * Exponential backoff starting at 1 second, capped at 10 retries.
 * Exposed on the adapter shape for introspection and testing.
 */
export const defaultRetrySchedule = Schedule.compose(
  Schedule.exponential('1 second'),
  Schedule.recurs(10),
)

// =============================================================================
// SparkplugAdapterLive — Layer factory
// =============================================================================

/**
 * Create a SparkplugAdapter Layer.
 *
 * The adapter:
 * 1. Creates one MqttTransport per groupId
 * 2. Subscribes each transport to `spBv1.0/{groupId}/#`
 * 3. Merges all per-group streams via Stream.mergeAll
 * 4. Manages a shared alias registry (scoped by groupId:edgeNodeId)
 * 5. Emits IngestedReading for DATA messages
 * 6. Retries on connection failure with exponential backoff (F27.1.3)
 * 7. Exposes live Ref-backed healthCheck (F27.1.4)
 *
 * @param config - SparkplugAdapterConfig
 */
export const SparkplugAdapterLive = (
  config: SparkplugAdapterConfig,
): Layer.Layer<IngestionAdapter> => {
  const groupConfigs = makeGroupConfigs(config)

  // Layer.effect allows creating a shared Ref at Layer construction time,
  // making it accessible to both subscribe and healthCheck (F27.1.4).
  return Layer.effect(
    IngestionAdapter,
    Effect.gen(function* () {
      const healthRef = yield* Ref.make<IngestionHealth>({
        protocol: 'sparkplug',
        connected: false,
        errorCount: 0,
      })

      return {
        protocol: 'sparkplug',
        retrySchedule: defaultRetrySchedule,

        subscribe: Effect.gen(function* () {
          const aliasReg = yield* makeAliasRegistry
          const stateReg = yield* makeStateRegistry

          // Empty groupIds → empty stream (no connections to make)
          if (groupConfigs.length === 0) {
            return Stream.empty as Stream.Stream<IngestedReading, IngestionError>
          }

          // Build one stream per group, each with its own MqttTransport.
          const perGroupStreams = groupConfigs.map((sparkplugConfig) =>
            Stream.unwrapScoped(
              Effect.gen(function* () {
                const transport = yield* MqttTransport

                yield* transport.subscribe(`spBv1.0/${sparkplugConfig.groupId}/#`, 0)
                yield* Ref.update(healthRef, (h) => ({ ...h, connected: true }))

                return transport.messages.pipe(
                  Stream.mapEffect((msg) => processMessage(aliasReg, stateReg, healthRef, msg)),
                  Stream.mapConcat((readings) => readings),
                )
              }).pipe(
                Effect.provide(MqttTransportLive(sparkplugConfig)),
                Effect.mapError((err): IngestionError =>
                  new IngestionError({
                    protocol: 'sparkplug',
                    message: err instanceof SparkplugError
                      ? err.message
                      : `Sparkplug connect error: ${String(err)}`,
                    code: 'CONNECTION_FAILED',
                    retryable: true,
                  }),
                ),
                // F27.1.3: Retry with exponential backoff on connection failure
                Effect.retry(defaultRetrySchedule),
              ),
            )
          )

          // Merge all per-group streams into a single output stream.
          const merged: Stream.Stream<IngestedReading, IngestionError> = Stream.mergeAll(
            perGroupStreams,
            { concurrency: 'unbounded' },
          ).pipe(
            Stream.catchAll((err) =>
              Stream.fail(
                err instanceof IngestionError
                  ? err
                  : new IngestionError({
                      protocol: 'sparkplug',
                      message: err instanceof SparkplugError
                        ? err.message
                        : `Sparkplug transport error: ${String(err)}`,
                      code: 'PROTOCOL_ERROR',
                      retryable: true,
                    }),
              ),
            ),
          )

          return merged
        }),

        // F27.1.4: Live healthCheck reads from shared Ref
        healthCheck: Ref.get(healthRef),
      }
    }),
  )
}

// =============================================================================
// SparkplugAdapterKVLive — Layer factory with KV-backed state registry
// =============================================================================

/**
 * Create a SparkplugAdapter Layer that uses NATS KV for host application state.
 *
 * Identical to SparkplugAdapterLive except that STATE topic transitions are
 * persisted in the `iiot-state` NATS KV bucket via NatsKVService, allowing
 * host application ONLINE/OFFLINE state to survive adapter restarts.
 *
 * Requires NatsKVService in the dependency chain.
 *
 * @param config - SparkplugAdapterConfig
 */
export const SparkplugAdapterKVLive = (
  config: SparkplugAdapterConfig,
): Layer.Layer<IngestionAdapter, never, NatsKVService> => {
  const groupConfigs = makeGroupConfigs(config)

  return Layer.effect(
    IngestionAdapter,
    Effect.gen(function* () {
      const kv = yield* NatsKVService
      const healthRef = yield* Ref.make<IngestionHealth>({
        protocol: 'sparkplug',
        connected: false,
        errorCount: 0,
      })

      return {
        protocol: 'sparkplug',
        retrySchedule: defaultRetrySchedule,

        subscribe: Effect.gen(function* () {
          const aliasReg = yield* makeAliasRegistry
          const stateReg = makeStateRegistryKV(kv)

          if (groupConfigs.length === 0) {
            return Stream.empty as Stream.Stream<IngestedReading, IngestionError>
          }

          const perGroupStreams = groupConfigs.map((sparkplugConfig) =>
            Stream.unwrapScoped(
              Effect.gen(function* () {
                const transport = yield* MqttTransport

                yield* transport.subscribe(`spBv1.0/${sparkplugConfig.groupId}/#`, 0)
                yield* Ref.update(healthRef, (h) => ({ ...h, connected: true }))

                return transport.messages.pipe(
                  Stream.mapEffect((msg) => processMessage(aliasReg, stateReg, healthRef, msg)),
                  Stream.mapConcat((readings) => readings),
                )
              }).pipe(
                Effect.provide(MqttTransportLive(sparkplugConfig)),
                Effect.mapError((err): IngestionError =>
                  new IngestionError({
                    protocol: 'sparkplug',
                    message: err instanceof SparkplugError
                      ? err.message
                      : `Sparkplug connect error: ${String(err)}`,
                    code: 'CONNECTION_FAILED',
                    retryable: true,
                  }),
                ),
                Effect.retry(defaultRetrySchedule),
              ),
            )
          )

          const merged: Stream.Stream<IngestedReading, IngestionError> = Stream.mergeAll(
            perGroupStreams,
            { concurrency: 'unbounded' },
          ).pipe(
            Stream.catchAll((err) =>
              Stream.fail(
                err instanceof IngestionError
                  ? err
                  : new IngestionError({
                      protocol: 'sparkplug',
                      message: err instanceof SparkplugError
                        ? err.message
                        : `Sparkplug transport error: ${String(err)}`,
                      code: 'PROTOCOL_ERROR',
                      retryable: true,
                    }),
              ),
            ),
          )

          return merged
        }),

        healthCheck: Ref.get(healthRef),
      }
    }),
  )
}
