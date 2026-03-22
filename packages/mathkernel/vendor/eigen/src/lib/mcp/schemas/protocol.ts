/**
 * MCP Protocol Schemas
 *
 * Effect Schema definitions for Model Context Protocol types.
 * Based on infinitty's mcp.ts, adapted for Effect-TS.
 */

import { Schema } from 'effect'

// =============================================================================
// Connection Status
// =============================================================================

export const MCPConnectionStatus = Schema.Literal(
  'disconnected',
  'connecting',
  'connected',
  'error'
)
export type MCPConnectionStatus = typeof MCPConnectionStatus.Type

// =============================================================================
// Transport Type
// =============================================================================

export const MCPTransportType = Schema.Literal('stdio', 'http')
export type MCPTransportType = typeof MCPTransportType.Type

// =============================================================================
// Tool Definition
// =============================================================================

export const MCPTool = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  inputSchema: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export type MCPTool = typeof MCPTool.Type

// =============================================================================
// Resource Definition
// =============================================================================

export const MCPResource = Schema.Struct({
  uri: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  mimeType: Schema.optional(Schema.String),
})
export type MCPResource = typeof MCPResource.Type

// =============================================================================
// Prompt Definition
// =============================================================================

export const MCPPromptArgument = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  required: Schema.optional(Schema.Boolean),
})
export type MCPPromptArgument = typeof MCPPromptArgument.Type

export const MCPPrompt = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  arguments: Schema.optional(Schema.Array(MCPPromptArgument)),
})
export type MCPPrompt = typeof MCPPrompt.Type

// =============================================================================
// Server Configuration
// =============================================================================

export const MCPServerSource = Schema.Literal('user', 'discovered', 'widget')
export type MCPServerSource = typeof MCPServerSource.Type

export const MCPServerConfig = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  transport: Schema.optional(MCPTransportType),
  // For stdio transport
  command: Schema.String,
  args: Schema.optional(Schema.Array(Schema.String)),
  env: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
  // For http transport
  url: Schema.optional(Schema.String),
  port: Schema.optional(Schema.Number),
  // Common fields
  enabled: Schema.Boolean,
  autoStart: Schema.optional(Schema.Boolean),
  source: Schema.optional(MCPServerSource),
})
export type MCPServerConfig = typeof MCPServerConfig.Type

// =============================================================================
// Server Status
// =============================================================================

export const MCPServerStatus = Schema.Struct({
  id: Schema.String,
  status: MCPConnectionStatus,
  error: Schema.optional(Schema.String),
  tools: Schema.Array(MCPTool),
  resources: Schema.Array(MCPResource),
  prompts: Schema.Array(MCPPrompt),
  lastConnected: Schema.optional(Schema.Number),
})
export type MCPServerStatus = typeof MCPServerStatus.Type

// =============================================================================
// JSON-RPC Types
// =============================================================================

export const JSONRPCRequest = Schema.Struct({
  jsonrpc: Schema.Literal('2.0'),
  id: Schema.Number,
  method: Schema.String,
  params: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export type JSONRPCRequest = typeof JSONRPCRequest.Type

export const JSONRPCError = Schema.Struct({
  code: Schema.Number,
  message: Schema.String,
  data: Schema.optional(Schema.Unknown),
})
export type JSONRPCError = typeof JSONRPCError.Type

export const JSONRPCResponse = Schema.Struct({
  jsonrpc: Schema.Literal('2.0'),
  id: Schema.Number,
  result: Schema.optional(Schema.Unknown),
  error: Schema.optional(JSONRPCError),
})
export type JSONRPCResponse = typeof JSONRPCResponse.Type

// =============================================================================
// Server Info (from initialize)
// =============================================================================

export const MCPCapabilities = Schema.Struct({
  tools: Schema.optional(Schema.Boolean),
  resources: Schema.optional(Schema.Boolean),
  prompts: Schema.optional(Schema.Boolean),
  sampling: Schema.optional(Schema.Boolean),
})
export type MCPCapabilities = typeof MCPCapabilities.Type

export const MCPServerInfo = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
  capabilities: Schema.optional(MCPCapabilities),
})
export type MCPServerInfo = typeof MCPServerInfo.Type

// =============================================================================
// Registry Events
// =============================================================================

export const MCPServerConnectedEvent = Schema.TaggedStruct('MCPServerConnected', {
  serverId: Schema.String,
  serverInfo: MCPServerInfo,
})
export type MCPServerConnectedEvent = typeof MCPServerConnectedEvent.Type

export const MCPServerDisconnectedEvent = Schema.TaggedStruct('MCPServerDisconnected', {
  serverId: Schema.String,
})
export type MCPServerDisconnectedEvent = typeof MCPServerDisconnectedEvent.Type

export const MCPServerErrorEvent = Schema.TaggedStruct('MCPServerError', {
  serverId: Schema.String,
  error: Schema.String,
})
export type MCPServerErrorEvent = typeof MCPServerErrorEvent.Type

export const MCPToolsChangedEvent = Schema.TaggedStruct('MCPToolsChanged', {
  serverId: Schema.String,
  tools: Schema.Array(MCPTool),
})
export type MCPToolsChangedEvent = typeof MCPToolsChangedEvent.Type

export const MCPRegistryEvent = Schema.Union(
  MCPServerConnectedEvent,
  MCPServerDisconnectedEvent,
  MCPServerErrorEvent,
  MCPToolsChangedEvent
)
export type MCPRegistryEvent = typeof MCPRegistryEvent.Type

// =============================================================================
// Tool Call Types
// =============================================================================

export const MCPToolCallRequest = Schema.Struct({
  serverId: Schema.String,
  toolName: Schema.String,
  arguments: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})
export type MCPToolCallRequest = typeof MCPToolCallRequest.Type

export const MCPToolCallResult = Schema.Struct({
  serverId: Schema.String,
  toolName: Schema.String,
  content: Schema.Unknown,
})
export type MCPToolCallResult = typeof MCPToolCallResult.Type
