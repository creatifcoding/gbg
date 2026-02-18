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

import { PersistedQueue } from '@effect/experimental'
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
import { NatsPubSubServiceLive } from '../../../holonet/nats/pubsub'
import {
  AgentTaskLogDurabilityServiceDefault,
} from './AgentTaskLogDurabilityService'
import {
  AgentTaskLogOutboxQueueStoreBrowser,
} from './AgentTaskLogOutboxQueueStore'
import {
  AgentTaskLogOutboxServiceDefault,
} from './AgentTaskLogOutboxService'
import { NatsMicroServiceLive } from '../../../holonet/nats/micro'
import { NatsStreamServiceLive } from '../../../holonet/nats/stream'

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
 *
 * Includes NatsPubSubServiceLive internally so the atom surface can resolve
 * cleanly in browser/testbed contexts without extra layer plumbing.
 *
 * For custom NATS config/connection tuning, provide custom holonet layers
 * above this composition.
 */
export const AgentTaskServiceNats = AgentTaskServiceBase.pipe(
  Layer.provide(
    NatsTransportServiceLive.pipe(
      Layer.provide(NatsPubSubServiceLive),
    ),
  ),
)

/**
 * NATS stack plus JetStream durability receipts for task log publish acks.
 *
 * Requires upstream NATS infra (connection + pubsub), same as AgentTaskServiceNats,
 * plus NatsStreamService dependencies.
 */
export const AgentTaskServiceNatsDurable = Layer.mergeAll(
  AgentTaskServiceNats,
  AgentTaskLogDurabilityServiceDefault.pipe(
    Layer.provide(NatsStreamServiceLive),
  ),
)

/**
 * PersistedQueue factory backed by custom outbox store (browser localStorage WAL).
 */
export const AgentTaskLogOutboxQueueLayer = PersistedQueue.layer.pipe(
  Layer.provide(AgentTaskLogOutboxQueueStoreBrowser),
)

/**
 * NATS durability + transactional outbox orchestration.
 */
export const AgentTaskServiceNatsOutbox = Layer.mergeAll(
  AgentTaskServiceNatsDurable,
  AgentTaskLogOutboxServiceDefault.pipe(
    Layer.provide(AgentTaskLogOutboxQueueLayer),
  ),
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

/**
 * NATS + durability + micro control-plane composition.
 */
export const AgentTaskServiceNatsDurableMicro = Layer.mergeAll(
  AgentTaskServiceNatsDurable,
  NatsMicroServiceLive,
  AgentTaskCommandRouterServiceLive,
  AgentTaskMicroHostServiceLive,
)

/**
 * NATS + durability + outbox + micro control-plane composition.
 */
export const AgentTaskServiceNatsOutboxMicro = Layer.mergeAll(
  AgentTaskServiceNatsOutbox,
  NatsMicroServiceLive,
  AgentTaskCommandRouterServiceLive,
  AgentTaskMicroHostServiceLive,
)
