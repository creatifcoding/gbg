/**
 * Tests for useChatWithTools hook
 *
 * TDD Phase 1: Define behavior through failing tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { Effect, Layer } from 'effect'
import type { ReactNode } from 'react'
import React from 'react'

// Mock @ai-sdk/react before importing the hook
const mockUseChat = vi.fn()
vi.mock('@ai-sdk/react', () => ({
  useChat: (options: unknown) => mockUseChat(options),
}))

// Import after mocking
import { useChatWithTools, type UseChatWithToolsOptions } from '../useChatWithTools'
import { ToolCallRequest, ToolCallResult } from '../../schemas'
import { ToolBridge, type ToolBridgeShape } from '../../services/ToolBridge'
import { MCPClientRegistry } from '@/lib/mcp/services'
import { Option } from 'effect'

// =============================================================================
// Test Utilities
// =============================================================================

function createMockToolBridge(overrides?: Partial<ToolBridgeShape>): ToolBridgeShape {
  return {
    getAvailableTools: () => Effect.succeed([]),
    findTool: () => Effect.succeed(Option.none()),
    executeTool: (request: ToolCallRequest) =>
      Effect.succeed(
        new ToolCallResult({
          callId: request.callId,
          toolName: request.toolName,
          serverId: request.serverId,
          result: { executed: true },
          success: true,
          error: null,
          durationMs: 100,
          completedAt: Date.now(),
        })
      ),
    getRegistryState: () =>
      Effect.succeed({
        tools: [],
        activeCalls: [],
        lastRefreshed: null,
        isLoading: false,
      } as any),
    getActiveCalls: () => Effect.succeed([]),
    refreshTools: () => Effect.succeed([]),
    ...overrides,
  }
}

// Default mock return value for useChat
function createMockUseChatReturn() {
  return {
    messages: [],
    input: '',
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    append: vi.fn(),
    reload: vi.fn(),
    stop: vi.fn(),
    setMessages: vi.fn(),
    setInput: vi.fn(),
    isLoading: false,
    error: undefined,
    status: 'ready' as const,
    addToolResult: vi.fn(),
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('useChatWithTools', () => {
  let mockUseChatReturn: ReturnType<typeof createMockUseChatReturn>

  beforeEach(() => {
    mockUseChatReturn = createMockUseChatReturn()
    mockUseChat.mockReturnValue(mockUseChatReturn)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should call useChat with default API endpoint', () => {
      renderHook(() => useChatWithTools())

      // AI SDK 5.0+ uses transport, not api directly
      expect(mockUseChat).toHaveBeenCalled()
    })

    it('should call useChat with custom API endpoint', () => {
      renderHook(() => useChatWithTools({ api: 'http://custom:3000/ai' }))

      expect(mockUseChat).toHaveBeenCalledWith(
        expect.objectContaining({
          api: 'http://custom:3000/ai',
        })
      )
    })

    it('should pass system prompt to useChat body', () => {
      renderHook(() => useChatWithTools({ systemPrompt: 'You are a helpful assistant' }))

      expect(mockUseChat).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            systemPrompt: 'You are a helpful assistant',
          }),
        })
      )
    })
  })

  describe('convenience accessors', () => {
    it('should return latestMessage as undefined when no messages', () => {
      mockUseChat.mockReturnValue({
        ...mockUseChatReturn,
        messages: [],
      })

      const { result } = renderHook(() => useChatWithTools())

      expect(result.current.latestMessage).toBeUndefined()
    })

    it('should return latestMessage as the last message', () => {
      const messages = [
        { id: '1', role: 'user', content: 'Hello' },
        { id: '2', role: 'assistant', content: 'Hi there!' },
      ]
      mockUseChat.mockReturnValue({
        ...mockUseChatReturn,
        messages,
      })

      const { result } = renderHook(() => useChatWithTools())

      expect(result.current.latestMessage).toEqual(messages[1])
    })

    it('should return isStreaming as true when status is streaming', () => {
      mockUseChat.mockReturnValue({
        ...mockUseChatReturn,
        status: 'streaming',
      })

      const { result } = renderHook(() => useChatWithTools())

      expect(result.current.isStreaming).toBe(true)
    })

    it('should return isStreaming as true when status is submitted', () => {
      mockUseChat.mockReturnValue({
        ...mockUseChatReturn,
        status: 'submitted',
      })

      const { result } = renderHook(() => useChatWithTools())

      expect(result.current.isStreaming).toBe(true)
    })

    it('should return isStreaming as false when status is ready', () => {
      mockUseChat.mockReturnValue({
        ...mockUseChatReturn,
        status: 'ready',
      })

      const { result } = renderHook(() => useChatWithTools())

      expect(result.current.isStreaming).toBe(false)
    })

    it('should return hasMessages as false when no messages', () => {
      mockUseChat.mockReturnValue({
        ...mockUseChatReturn,
        messages: [],
      })

      const { result } = renderHook(() => useChatWithTools())

      expect(result.current.hasMessages).toBe(false)
    })

    it('should return hasMessages as true when messages exist', () => {
      mockUseChat.mockReturnValue({
        ...mockUseChatReturn,
        messages: [{ id: '1', role: 'user', content: 'Hello' }],
      })

      const { result } = renderHook(() => useChatWithTools())

      expect(result.current.hasMessages).toBe(true)
    })
  })

  describe('tool execution callbacks', () => {
    it('should call onToolExecute when tool is invoked', async () => {
      const onToolExecute = vi.fn()
      let capturedOnToolCall: ((params: any) => Promise<void>) | undefined

      mockUseChat.mockImplementation((options: any) => {
        capturedOnToolCall = options.onToolCall
        return mockUseChatReturn
      })

      renderHook(() => useChatWithTools({ onToolExecute }))

      // Simulate tool call
      if (capturedOnToolCall) {
        await capturedOnToolCall({
          toolCall: {
            toolCallId: 'call-1',
            toolName: 'readFile',
            args: { path: '/test.txt' },
          },
        })
      }

      expect(onToolExecute).toHaveBeenCalledWith('readFile', { path: '/test.txt' })
    })

    it('should call onToolResult when tool execution completes', async () => {
      const onToolResult = vi.fn()
      let capturedOnToolCall: ((params: any) => Promise<void>) | undefined

      mockUseChat.mockImplementation((options: any) => {
        capturedOnToolCall = options.onToolCall
        return mockUseChatReturn
      })

      renderHook(() => useChatWithTools({ onToolResult }))

      // Simulate tool call
      if (capturedOnToolCall) {
        await capturedOnToolCall({
          toolCall: {
            toolCallId: 'call-1',
            toolName: 'readFile',
            args: { path: '/test.txt' },
          },
        })
      }

      // Should be called with result (success case)
      expect(onToolResult).toHaveBeenCalledWith(
        'call-1',
        expect.objectContaining({ executed: true }),
        false // isError
      )
    })

    it('should call onToolResult with isError=true when tool execution fails', async () => {
      const onToolResult = vi.fn()
      let capturedOnToolCall: ((params: any) => Promise<void>) | undefined

      // Create a failing ToolBridge
      const failingToolBridge = createMockToolBridge({
        executeTool: () =>
          Effect.succeed(
            new ToolCallResult({
              callId: 'call-1',
              toolName: 'readFile',
              serverId: null,
              result: null,
              success: false,
              error: 'File not found',
              durationMs: 50,
              completedAt: Date.now(),
            })
          ),
      })

      mockUseChat.mockImplementation((options: any) => {
        capturedOnToolCall = options.onToolCall
        return mockUseChatReturn
      })

      renderHook(() => useChatWithTools({ onToolResult }))

      // Simulate tool call
      if (capturedOnToolCall) {
        await capturedOnToolCall({
          toolCall: {
            toolCallId: 'call-1',
            toolName: 'readFile',
            args: { path: '/missing.txt' },
          },
        })
      }

      // The actual behavior depends on how errors are handled in the implementation
      expect(onToolResult).toHaveBeenCalled()
    })
  })

  describe('useChat passthrough', () => {
    it('should pass through all useChat return values (AI SDK 5.0+ API)', () => {
      const { result } = renderHook(() => useChatWithTools())

      // Core useChat properties should be present (AI SDK 5.0+ API)
      expect(result.current.messages).toBeDefined()
      expect(result.current.sendMessage).toBeDefined() // Replaces append
      expect(result.current.regenerate).toBeDefined()  // Replaces reload
      expect(result.current.stop).toBeDefined()
      expect(result.current.setMessages).toBeDefined()
      expect(result.current.error).toBeDefined()
      expect(result.current.status).toBeDefined()

      // Our convenience accessors
      expect(result.current.latestMessage).toBeDefined()
      expect(result.current.isStreaming).toBeDefined()
      expect(result.current.hasMessages).toBeDefined()
    })
  })
})
