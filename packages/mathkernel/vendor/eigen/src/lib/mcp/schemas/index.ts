/**
 * MCP Schemas
 */

export {
  // Status & Transport
  MCPConnectionStatus,
  MCPTransportType,
  // Tool, Resource, Prompt
  MCPTool,
  MCPResource,
  MCPPromptArgument,
  MCPPrompt,
  // Server Config & Status
  MCPServerSource,
  MCPServerConfig,
  MCPServerStatus,
  // JSON-RPC
  JSONRPCRequest,
  JSONRPCError,
  JSONRPCResponse,
  // Server Info
  MCPCapabilities,
  MCPServerInfo,
  // Registry Events
  MCPServerConnectedEvent,
  MCPServerDisconnectedEvent,
  MCPServerErrorEvent,
  MCPToolsChangedEvent,
  MCPRegistryEvent,
  // Tool Call
  MCPToolCallRequest,
  MCPToolCallResult,
} from './protocol'

export type {
  MCPConnectionStatus,
  MCPTransportType,
  MCPTool,
  MCPResource,
  MCPPromptArgument,
  MCPPrompt,
  MCPServerSource,
  MCPServerConfig,
  MCPServerStatus,
  JSONRPCRequest,
  JSONRPCError,
  JSONRPCResponse,
  MCPCapabilities,
  MCPServerInfo,
  MCPServerConnectedEvent,
  MCPServerDisconnectedEvent,
  MCPServerErrorEvent,
  MCPToolsChangedEvent,
  MCPRegistryEvent,
  MCPToolCallRequest,
  MCPToolCallResult,
} from './protocol'
