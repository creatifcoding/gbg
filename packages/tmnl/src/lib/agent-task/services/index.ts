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
  AgentTaskServiceNatsMicro,
} from './layers'
