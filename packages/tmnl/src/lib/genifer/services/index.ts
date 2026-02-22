/**
 * Genifer Dynamic Services — Runtime RPC + Event management via @effect/rpc.
 *
 * @module genifer/services
 */

// =============================================================================
// Dynamic RPC Service
// =============================================================================

export {
  // Schemas
  RpcDefinition,
  RpcHandler,
  HttpHandler,
  ServiceHandler,
  LlmHandler,
  ScriptHandler,
  CustomHandler,
  DynamicRpcNotFound,
  DynamicRpcHandlerError,
  // RPC definitions (management API)
  RegisterDynamicRpc,
  UnregisterDynamicRpc,
  CallDynamicRpc,
  ListDynamicRpcs,
  GetDynamicRpc,
  DynamicRpcGroup,
} from './DynamicRpcSchemas'

export {
  // Atoms
  rpcRegistryAtom,
  // Handler registration
  registerCustomRpcHandler,
  unregisterCustomRpcHandler,
  // Registry bridge
  setDynamicRpcRegistry,
  // Handlers layer
  DynamicRpcHandlersLive,
  // Convenience
  callDynamicRpc,
} from './DynamicRpcService'

// =============================================================================
// Dynamic Event Service
// =============================================================================

export {
  // Schemas
  EventDefinition,
  DynamicEventPayload,
  EventSubscription,
  EventNotDefinedError,
  EventValidationError,
  // RPC definitions (management API)
  DefineEvent,
  EmitEvent,
  ListEvents,
  GetEvent,
  UndefineEvent,
  DynamicEventGroup,
} from './DynamicEventSchemas'

export {
  // Atoms
  eventDefinitionsAtom,
  dynamicEventLogAtom,
  // Pub/sub
  subscribeDynamicEvent,
  subscribeAllDynamicEvents,
  // Registry bridge
  setDynamicEventRegistry,
  // Handlers layer
  DynamicEventHandlersLive,
  // Convenience
  emitDynamicEvent,
  getDynamicEventLog,
  getDynamicEventDefinitions,
} from './DynamicEventService'
