/**
 * Nia MCP Client
 *
 * Effect.Service for calling Nia's MCP API via HTTP JSON-RPC 2.0.
 * Cloud-based RAG with no cold start penalty.
 */

import { Context, Effect, Layer, pipe } from 'effect';
import { RagError } from '../../schemas';

// ============================================================================
// Configuration
// ============================================================================

const NIA_MCP_ENDPOINT = 'https://apigcp.trynia.ai/mcp';
const DEFAULT_TIMEOUT = 30000; // 30s
const MAX_RETRIES = 3;

// ============================================================================
// Types
// ============================================================================

interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params: Record<string, unknown>;
  id: number;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: number;
}

// ============================================================================
// Service Interface
// ============================================================================

export interface NiaMcpClientShape {
  /**
   * Call a Nia MCP tool with typed parameters
   */
  readonly callTool: <T>(
    tool: string,
    params: Record<string, unknown>
  ) => Effect.Effect<T, RagError>;
}

// ============================================================================
// Service Tag
// ============================================================================

export class NiaMcpClient extends Context.Tag('tmnl/rag/NiaMcpClient')<
  NiaMcpClient,
  NiaMcpClientShape
>() {}

// ============================================================================
// Implementation
// ============================================================================

const makeNiaMcpClient = (): NiaMcpClientShape => {
  let requestId = 0;

  const getToken = (): string => {
    const token = process.env.NIA_API_TOKEN;
    if (!token) {
      throw new Error('NIA_API_TOKEN environment variable is required');
    }
    return token;
  };

  const callTool = <T>(
    tool: string,
    params: Record<string, unknown>
  ): Effect.Effect<T, RagError> =>
    pipe(
      Effect.tryPromise({
        try: async () => {
          const token = getToken();
          const id = ++requestId;

          const payload: JsonRpcRequest = {
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: tool,
              arguments: params,
            },
            id,
          };

          // Retry with exponential backoff
          let lastError: Error | null = null;
          for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
              const controller = new AbortController();
              const timeout = setTimeout(
                () => controller.abort(),
                DEFAULT_TIMEOUT
              );

              try {
                const response = await fetch(NIA_MCP_ENDPOINT, {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(payload),
                  signal: controller.signal,
                });

                clearTimeout(timeout);

                if (!response.ok) {
                  const text = await response.text();
                  throw new Error(`HTTP ${response.status}: ${text}`);
                }

                const data: JsonRpcResponse<T> = await response.json();

                if (data.error) {
                  throw new Error(
                    `MCP error: ${data.error.message} (code: ${data.error.code})`
                  );
                }

                return data.result as T;
              } finally {
                clearTimeout(timeout);
              }
            } catch (err) {
              lastError = err instanceof Error ? err : new Error(String(err));

              // Don't retry on auth errors
              if (lastError.message.includes('401')) {
                throw lastError;
              }

              // Exponential backoff
              if (attempt < MAX_RETRIES - 1) {
                await new Promise((resolve) =>
                  setTimeout(resolve, Math.pow(2, attempt) * 1000)
                );
              }
            }
          }

          throw lastError ?? new Error('Max retries exceeded');
        },
        catch: (err) =>
          new RagError({
            message: `Nia MCP error: ${err instanceof Error ? err.message : String(err)}`,
            code: 'SEARCH_ERROR',
          }),
      })
    );

  return { callTool };
};

// ============================================================================
// Layer
// ============================================================================

export const NiaMcpClientLive = Layer.succeed(NiaMcpClient, makeNiaMcpClient());
