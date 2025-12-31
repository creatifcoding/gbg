/**
 * MCP (Model Context Protocol) Module
 *
 * Effect-TS integration for MCP server management.
 * Ported from infinitty with Effect-atom state management.
 *
 * Features:
 * - MCPClientRegistry service for server connections
 * - Stdio and HTTP transports
 * - Effect-atom reactive state
 * - Tool aggregation across servers
 *
 * @example
 * ```tsx
 * import { useAtomValue } from '@effect-atom/atom-react'
 * import {
 *   allMCPToolsAtom,
 *   connectMCPServerOp,
 *   callMCPToolOp,
 * } from '@/lib/mcp'
 *
 * function MCPTools() {
 *   const tools = useAtomValue(allMCPToolsAtom)
 *
 *   const handleConnect = async () => {
 *     await connectMCPServerOp({
 *       config: {
 *         id: 'my-server',
 *         name: 'My MCP Server',
 *         command: 'npx',
 *         args: ['-y', '@modelcontextprotocol/server-filesystem', '/'],
 *         enabled: true,
 *       },
 *     })
 *   }
 *
 *   return (
 *     <div>
 *       <button onClick={handleConnect}>Connect</button>
 *       <ul>
 *         {tools.map(({ tool, serverId }) => (
 *           <li key={`${serverId}:${tool.name}`}>{tool.name}</li>
 *         ))}
 *       </ul>
 *     </div>
 *   )
 * }
 * ```
 */

// Services
export {
  MCPClientRegistry,
  type MCPClientRegistryShape,
  type MCPClientInstance,
} from './services'

// Transports
export { createStdioClient } from './transports'

// Atoms
export {
  // Runtime
  mcpRuntimeAtom,
  // State atoms
  mcpServersAtom,
  mcpServerStatusesAtom,
  selectedMCPServerIdAtom,
  isMCPDiscoveringAtom,
  // Derived atoms
  connectedMCPServersAtom,
  allMCPToolsAtom,
  mcpToolCountAtom,
  selectedMCPServerStatusAtom,
  selectedMCPConnectionStatusAtom,
  // Operations (synchronous)
  addMCPServer,
  removeMCPServer,
  updateMCPServer,
  selectMCPServer,
  updateMCPServerStatus,
  // Operations (Effect-based)
  connectMCPServerOp,
  disconnectMCPServerOp,
  callMCPToolOp,
  refreshMCPToolsOp,
  getAllMCPToolsOp,
} from './atoms'

// Schemas
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
} from './schemas'

// Hooks
export {
  useMCPClient,
  useMCPServers,
  useMCPTools,
  type UseMCPClientResult,
  type UseMCPServersResult,
  type UseMCPToolsResult,
} from './hooks'
