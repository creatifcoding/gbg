/**
 * Agent Task Services — barrel export.
 *
 * @module agent-task/services
 */

// Codec assembly
export {
  CodecService,
  CodecServiceLive,
  type CodecServiceShape,
  type AssembledLogEntry,
} from './CodecService'

// Transport interface + errors
export {
  TransportService,
  type TransportServiceShape,
  TransportSubscribeError,
  TransportPublishError,
} from './TransportService'

// Transport implementations
export {
  MockTransportServiceLive,
  MockTransportServiceFast,
  MockTransportServiceError,
  MockTransportServiceCustom,
  type MockTransportConfig,
} from './MockTransportService'

export {
  NatsTransportServiceLive,
  AGENT_TASK_LOGS_WILDCARD,
} from './NatsTransportService'

// Log service
export {
  LogService,
  LogServiceLive,
  type LogServiceShape,
  type LogStreamOptions,
} from './LogService'

// Top-level service
export {
  AgentTaskService,
  AgentTaskServiceLive,
  type AgentTaskServiceShape,
} from './AgentTaskService'

// Durability service
export {
  AGENT_TASK_LOG_DURABILITY_WILDCARD,
  resolveAgentTaskLogDurabilitySubject,
  AgentTaskLogDurabilityConfig,
  AgentTaskLogDurabilityConfigDefault,
  AgentTaskLogDurabilityConfigCustom,
  AgentTaskLogDurabilityEnsureStreamError,
  AgentTaskLogDurabilityPublishError,
  AgentTaskLogDurabilityService,
  AgentTaskLogDurabilityServiceLive,
  AgentTaskLogDurabilityServiceDefault,
  type AgentTaskLogDurabilityConfigShape,
  type AgentTaskLogDurabilityError,
  type AgentTaskLogDurabilityServiceShape,
} from './AgentTaskLogDurabilityService'

// Local archive store service
export {
  archiveManifestKey,
  archiveChunkKey,
  archiveOldestChunkIndex,
  LogArchiveStoreConfig,
  LogArchiveStoreConfigDefault,
  LogArchiveStoreConfigCustom,
  LogArchiveStoreReadError,
  LogArchiveStoreWriteError,
  LogArchiveStoreArchiveDegradedError,
  LogArchiveStoreService,
  LogArchiveStoreServiceLive,
  LogArchiveStoreServiceDefault,
  LogArchiveStoreBackingBrowser,
  LogArchiveStoreServiceBrowser,
  type LogArchiveStoreConfigShape,
  type LogArchiveStoreError,
  type LogArchiveStoreServiceShape,
} from './LogArchiveStoreService'

// Outbox queue store + orchestration
export {
  AgentTaskLogOutboxQueueStoreConfig,
  AgentTaskLogOutboxQueueStoreConfigDefault,
  AgentTaskLogOutboxQueueStoreConfigCustom,
  AgentTaskLogOutboxQueueStoreLive,
  AgentTaskLogOutboxQueueStoreDefault,
  AgentTaskLogOutboxQueueStoreBackingBrowser,
  AgentTaskLogOutboxQueueStoreBrowser,
  type AgentTaskLogOutboxQueueStoreConfigShape,
} from './AgentTaskLogOutboxQueueStore'

export {
  AgentTaskLogOutboxConfig,
  AgentTaskLogOutboxConfigDefault,
  AgentTaskLogOutboxConfigCustom,
  AgentTaskLogOutboxEnqueueError,
  AgentTaskLogOutboxDrainError,
  AgentTaskLogOutboxService,
  AgentTaskLogOutboxServiceLive,
  AgentTaskLogOutboxServiceDefault,
  type AgentTaskLogOutboxConfigShape,
  type AgentTaskLogOutboxError,
  type AgentTaskLogOutboxDrainAttempt,
  type AgentTaskLogOutboxDrainFailure,
  type AgentTaskLogOutboxDrainHooks,
  type AgentTaskLogOutboxServiceShape,
} from './AgentTaskLogOutboxService'

// Command control-plane services
export {
  AgentTaskCommandRouterService,
  AgentTaskCommandRouterServiceLive,
  resolveTaskCommandEventsSubject,
  CommandDecodeError,
  CommandRouteError,
  CommandEventPublishError,
  type AgentTaskCommandRouterError,
  type AgentTaskCommandRouterServiceShape,
} from './AgentTaskCommandRouterService'

export {
  AgentTaskMicroHostService,
  AgentTaskMicroHostServiceLive,
  AGENT_TASK_MICRO_SERVICE_NAME,
  AGENT_TASK_MICRO_SERVICE_VERSION,
  AGENT_TASK_COMMAND_SUBJECT,
  extractTaskIdFromCommandSubject,
  type AgentTaskMicroHostServiceShape,
} from './AgentTaskMicroHostService'

// Pre-composed layers
export {
  AgentTaskServiceBase,
  AgentTaskServiceMock,
  AgentTaskServiceTestFast,
  AgentTaskServiceTestError,
  AgentTaskServiceNats,
  AgentTaskServiceNatsDurable,
  AgentTaskLogOutboxQueueLayer,
  AgentTaskServiceNatsOutbox,
  AgentTaskServiceNatsMicro,
  AgentTaskServiceNatsDurableMicro,
  AgentTaskServiceNatsOutboxMicro,
} from './layers'
