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

// Pre-composed layers
export {
  AgentTaskServiceBase,
  AgentTaskServiceMock,
  AgentTaskServiceTestFast,
  AgentTaskServiceTestError,
  AgentTaskServiceNats,
} from './layers'
