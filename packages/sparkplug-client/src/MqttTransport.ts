/**
 * MqttTransport — Effect Service for MQTT connectivity.
 *
 * Wraps mqtt.js v5 client in an Effect-native Service with:
 * - `Effect.acquireRelease` lifecycle (connect/disconnect)
 * - `Stream.asyncPush` bridge for incoming messages
 * - Typed publish/subscribe operations
 *
 * @module @selfcharters/sparkplug-client/MqttTransport
 */

import { Context, Effect, Layer, Ref, Scope, Stream } from 'effect'
import * as mqtt from 'mqtt'
import type { SparkplugConfig } from './config'
import { encodePayload, type UPayload } from './SparkplugCodec'
import { makeWillMessage } from './SparkplugProtocol'
import { SparkplugError } from './errors'

// =============================================================================
// Message shape
// =============================================================================

/** Raw MQTT message received from the broker */
export interface MqttMessage {
  readonly topic: string
  readonly payload: Buffer
}

// =============================================================================
// Service interface
// =============================================================================

export interface MqttTransportShape {
  /** Underlying mqtt.js client (for advanced use) */
  readonly client: mqtt.MqttClient

  /** Publish a binary payload to a topic */
  readonly publish: (
    topic: string,
    payload: Uint8Array | Buffer,
    opts?: { qos?: 0 | 1 | 2; retain?: boolean },
  ) => Effect.Effect<void, SparkplugError>

  /** Subscribe to a topic pattern */
  readonly subscribe: (
    topic: string,
    qos?: 0 | 1 | 2,
  ) => Effect.Effect<void, SparkplugError>

  /** Stream of incoming MQTT messages */
  readonly messages: Stream.Stream<MqttMessage, SparkplugError>

  /** Whether the client is currently connected */
  readonly isConnected: Effect.Effect<boolean>
}

export class MqttTransport extends Context.Tag('selfcharters/MqttTransport')<
  MqttTransport,
  MqttTransportShape
>() {}

// =============================================================================
// Layer factory
// =============================================================================

/**
 * Create a scoped MqttTransport Layer from SparkplugConfig.
 *
 * The Layer:
 * 1. Derives mqtt.js connect options from SparkplugConfig
 * 2. Constructs the NDEATH Will message with spec-compliant defaults
 * 3. Connects to the broker (acquireRelease lifecycle)
 * 4. Bridges `client.on('message', ...)` into an Effect Stream
 *
 * @param config - SparkplugConfig with all necessary settings
 * @param bdSeq - Birth/death sequence number for Will message
 */
export const MqttTransportLive = (
  config: SparkplugConfig,
  bdSeq: number = 0,
): Layer.Layer<MqttTransport, SparkplugError, Scope.Scope> => {
  const willMsg = makeWillMessage(
    'spBv1.0',
    config.groupId,
    config.edgeNodeId,
    bdSeq,
    config.will?.qos ?? 1,
    config.will?.retain ?? false,
  )

  const encodedWillPayload = encodePayload(willMsg.payload as unknown as UPayload)

  const mqttOptions: mqtt.IClientOptions = {
    clientId: config.clientId ?? `spB-${config.groupId}-${config.edgeNodeId}-${Date.now()}`,
    clean: config.mqtt?.cleanSession ?? true,
    keepalive: config.mqtt?.keepalive ?? 65,
    reconnectPeriod: config.mqtt?.reconnectPeriod ?? 1000,
    connectTimeout: config.mqtt?.connectTimeout ?? 30000,
    username: config.username,
    password: config.password,
    will: {
      topic: willMsg.topic,
      payload: Buffer.from(encodedWillPayload),
      qos: willMsg.qos,
      retain: willMsg.retain,
    },
  }

  return Layer.scoped(
    MqttTransport,
    Effect.gen(function* () {
      const connectedRef = yield* Ref.make(false)

      // Acquire: connect to MQTT broker
      const client = yield* Effect.acquireRelease(
        Effect.async<mqtt.MqttClient, SparkplugError>((resume) => {
          const c = mqtt.connect(config.serverUrl, mqttOptions)

          c.on('connect', () => {
            resume(Effect.succeed(c))
          })

          c.on('error', (err) => {
            resume(
              Effect.fail(
                new SparkplugError({
                  code: 'CONNECTION_FAILED',
                  message: `MQTT connect failed: ${err.message}`,
                  retryable: true,
                  cause: err,
                })
              )
            )
          })
        }),
        (c) =>
          Effect.sync(() => {
            c.end(true)
          }),
      )

      yield* Ref.set(connectedRef, true)

      // Track connection state
      client.on('close', () => {
        Effect.runSync(Ref.set(connectedRef, false))
      })
      client.on('connect', () => {
        Effect.runSync(Ref.set(connectedRef, true))
      })

      // Bridge messages into Stream
      const messageStream = Stream.asyncPush<MqttMessage, SparkplugError>(
        (emit) =>
          Effect.acquireRelease(
            Effect.sync(() => {
              const handler = (topic: string, payload: Buffer) => {
                emit.single({ topic, payload })
              }
              client.on('message', handler)
              return handler
            }),
            (handler) =>
              Effect.sync(() => {
                client.removeListener('message', handler)
              }),
          ),
        { bufferSize: 1024 },
      )

      // Publish helper
      const publish = (
        topic: string,
        payload: Uint8Array | Buffer,
        opts?: { qos?: 0 | 1 | 2; retain?: boolean },
      ): Effect.Effect<void, SparkplugError> =>
        Effect.async<void, SparkplugError>((resume) => {
          client.publish(
            topic,
            Buffer.from(payload),
            { qos: opts?.qos ?? 0, retain: opts?.retain ?? false },
            (err) => {
              if (err) {
                resume(
                  Effect.fail(
                    new SparkplugError({
                      code: 'TRANSPORT_ERROR',
                      message: `Publish failed: ${err.message}`,
                      retryable: true,
                      cause: err,
                    })
                  )
                )
              } else {
                resume(Effect.void)
              }
            },
          )
        })

      // Subscribe helper
      const subscribe = (
        topic: string,
        qos: 0 | 1 | 2 = 0,
      ): Effect.Effect<void, SparkplugError> =>
        Effect.async<void, SparkplugError>((resume) => {
          client.subscribe(topic, { qos }, (err) => {
            if (err) {
              resume(
                Effect.fail(
                  new SparkplugError({
                    code: 'TRANSPORT_ERROR',
                    message: `Subscribe failed: ${err.message}`,
                    retryable: true,
                    cause: err,
                  })
                )
              )
            } else {
              resume(Effect.void)
            }
          })
        })

      return MqttTransport.of({
        client,
        publish,
        subscribe,
        messages: messageStream,
        isConnected: Ref.get(connectedRef),
      })
    }),
  )
}
