/**
 * Layer Composition — Pre-built layer stacks for common scenarios.
 *
 * Layer tree:
 *
 *   AgentTaskServiceLive
 *     └── LogServiceLive
 *           ├── CodecServiceLive
 *           └── TransportService (swappable)
 *                 ├── MockTransportServiceLive (dev/test)
 *                 ├── MockTransportServiceFast (unit tests)
 *                 ├── MockTransportServiceError (error scenarios)
 *                 └── NatsTransportServiceLive (production — requires NatsPubSubService)
 *
 * @module agent-task/services/layers
 */

import { Layer } from 'effect'
import { CodecServiceLive } from './CodecService'
import { LogServiceLive } from './LogService'
import { AgentTaskServiceLive } from './AgentTaskService'
import {
  MockTransportServiceLive,
  MockTransportServiceFast,
  MockTransportServiceError,
} from './MockTransportService'
import { NatsTransportServiceLive } from './NatsTransportService'
import { AgentTaskCommandRouterServiceLive } from './AgentTaskCommandRouterService'
import { AgentTaskMicroHostServiceLive } from './AgentTaskMicroHostService'
import { NatsMicroServiceLive } from '../../holonet/nats/micro'

// ---------------------------------------------------------------------------
// Common base: CodecService + LogService + AgentTaskService
// (TransportService must be provided separately)
// ---------------------------------------------------------------------------

/**
 * Service stack without transport — plug your own TransportService Layer.
 *
 * Usage:
 * ```typescript
 * const MyLayer = AgentTaskServiceBase.pipe(
 *   Layer.provide(MyCustomTransportLayer),
 * )
 * ```
 */
export const AgentTaskServiceBase = AgentTaskServiceLive.pipe(
  Layer.provide(LogServiceLive),
  Layer.provide(CodecServiceLive),
)

// ---------------------------------------------------------------------------
// Mock layer — for dev and testbed
// ---------------------------------------------------------------------------

/**
 * Full stack with mock transport (200ms interval, success scenario).
 * Use in testbed routes and dev mode.
 */
export const AgentTaskServiceMock = AgentTaskServiceBase.pipe(
  Layer.provide(MockTransportServiceLive),
)

/**
 * Full stack with fast mock transport (10ms, no jitter).
 * Use in unit/integration tests for speed.
 */
export const AgentTaskServiceTestFast = AgentTaskServiceBase.pipe(
  Layer.provide(MockTransportServiceFast),
)

/**
 * Full stack with error-scenario mock transport.
 * Use for testing error handling paths.
 */
export const AgentTaskServiceTestError = AgentTaskServiceBase.pipe(
  Layer.provide(MockTransportServiceError),
)

// ---------------------------------------------------------------------------
// NATS layer — for production
// ---------------------------------------------------------------------------

/**
 * Full stack with NATS transport.
 * Requires NatsPubSubService to be provided upstream.
 *
 * Usage:
 * ```typescript
 * const ProductionLayer = AgentTaskServiceNats.pipe(
 *   Layer.provide(NatsPubSubServiceLive),
 *   Layer.provide(NatsConnectionServiceLive),
 * )
 * ```
 */
export const AgentTaskServiceNats = AgentTaskServiceBase.pipe(
  Layer.provide(NatsTransportServiceLive),
)

// ---------------------------------------------------------------------------
// NATS + Micro control-plane layer
// ---------------------------------------------------------------------------

/**
 * Full stack with NATS log transport + command microservice host.
 *
 * Includes:
 * - AgentTaskServiceNats (log ingest/publish)
 * - NatsMicroService (nc.services wrapper)
 * - AgentTaskCommandRouterService (schema validation + routing)
 * - AgentTaskMicroHostService (request/reply endpoint host)
 *
 * Still requires upstream NATS infra layers:
 * - NatsPubSubService (for transport + command events)
 * - NatsConnectionService (for micro host)
 */
export const AgentTaskServiceNatsMicro = Layer.mergeAll(
  AgentTaskServiceNats,
  NatsMicroServiceLive,
  AgentTaskCommandRouterServiceLive,
  AgentTaskMicroHostServiceLive,
)
