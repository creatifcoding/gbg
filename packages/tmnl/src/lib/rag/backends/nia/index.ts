/**
 * Nia Backend Module
 *
 * Effect AI-native tools for Nia MCP API.
 * Cloud-based RAG with no cold start penalty.
 */

// MCP Client (HTTP JSON-RPC)
export { NiaMcpClient, NiaMcpClientLive, type NiaMcpClientShape } from './NiaMcpClient';

// Effect AI Tools (Schema-based)
export { NiaSearch, NiaGrep, NiaRead, NiaToolkit } from './tools';

// Tool Handlers Layer
export { NiaToolHandlers, NiaLive } from './handlers';
