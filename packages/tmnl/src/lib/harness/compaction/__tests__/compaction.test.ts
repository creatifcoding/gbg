import { describe, it, expect } from 'vitest'
import { findCutPoint, estimateMessageTokens } from '../cut-point'
import { executeCompaction } from '../compact'
import type { Message, UserMessage, AssistantMessage, ToolResultMessage } from '@mariozechner/pi-ai'

// ── Helpers ──
const userMsg = (text: string): UserMessage => ({
  role: 'user' as const,
  content: text,
  timestamp: Date.now(),
})

const assistantMsg = (text: string): AssistantMessage => ({
  role: 'assistant' as const,
  content: [{ type: 'text' as const, text }],
  api: 'anthropic-messages' as any,
  provider: 'anthropic' as any,
  model: 'test',
  usage: {
    input: 100,
    output: 50,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 150,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
  stopReason: 'stop' as const,
  timestamp: Date.now(),
})

const assistantWithToolCall = (toolName: string): AssistantMessage => ({
  role: 'assistant' as const,
  content: [{ type: 'toolCall' as const, id: 'tc-1', name: toolName, arguments: { path: '/test' } }],
  api: 'anthropic-messages' as any,
  provider: 'anthropic' as any,
  model: 'test',
  usage: {
    input: 100,
    output: 50,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 150,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
  stopReason: 'toolUse' as const,
  timestamp: Date.now(),
})

const toolResult = (toolName: string, text: string): ToolResultMessage => ({
  role: 'toolResult' as const,
  toolCallId: 'tc-1',
  toolName,
  content: [{ type: 'text' as const, text }],
  isError: false,
  timestamp: Date.now(),
})

describe('compaction module', () => {
  it('exports executeCompaction', () => {
    expect(executeCompaction).toBeTypeOf('function')
  })
})

describe('estimateMessageTokens', () => {
  it('estimates user message tokens from string content', () => {
    const msg = userMsg('hello world') // 11 chars -> ~3 tokens
    expect(estimateMessageTokens(msg)).toBeGreaterThan(0)
    expect(estimateMessageTokens(msg)).toBeLessThan(10)
  })

  it('estimates assistant message tokens from text content', () => {
    const msg = assistantMsg('This is a longer response with more text content')
    expect(estimateMessageTokens(msg)).toBeGreaterThan(5)
  })

  it('estimates tool result tokens', () => {
    const msg = toolResult('read', 'file contents here')
    expect(estimateMessageTokens(msg)).toBeGreaterThan(0)
  })

  it('includes tool call arguments in estimate', () => {
    const msg = assistantWithToolCall('read')
    expect(estimateMessageTokens(msg)).toBeGreaterThan(0)
  })
})

describe('findCutPoint', () => {
  it('returns null for very short conversations', () => {
    const messages = [userMsg('hi'), assistantMsg('hello')]
    expect(findCutPoint(messages, 100)).toBeNull()
  })

  it('returns null when all messages fit within keepRecentTokens', () => {
    const messages = [userMsg('short'), assistantMsg('also short'), userMsg('tiny'), assistantMsg('small')]
    expect(findCutPoint(messages, 100000)).toBeNull()
  })

  it('finds cut point when messages exceed keepRecentTokens', () => {
    const longText = 'x'.repeat(4000) // ~1000 tokens
    const messages: Message[] = [
      userMsg(longText),
      assistantMsg(longText),
      userMsg(longText),
      assistantMsg(longText),
      userMsg('recent'),
      assistantMsg('recent'),
    ]
    const result = findCutPoint(messages, 500)
    expect(result).not.toBeNull()
    expect(result!.messagesToSummarize.length).toBeGreaterThan(0)
    expect(result!.messagesToKeep.length).toBeGreaterThan(0)
    expect(result!.messagesToSummarize.length + result!.messagesToKeep.length).toBe(messages.length)
  })

  it('never splits tool call from tool result', () => {
    const longText = 'x'.repeat(4000)
    const messages: Message[] = [
      userMsg(longText),
      assistantMsg(longText),
      userMsg(longText),
      assistantWithToolCall('read'),
      toolResult('read', longText),
      userMsg('recent'),
      assistantMsg('recent'),
    ]
    const result = findCutPoint(messages, 500)
    if (result) {
      const firstKept = result.messagesToKeep[0]
      expect(firstKept.role).not.toBe('toolResult')
    }
  })

  it('preserves total message count across cut', () => {
    const longText = 'x'.repeat(8000)
    const messages: Message[] = [
      userMsg(longText),
      assistantMsg(longText),
      userMsg(longText),
      assistantMsg(longText),
      userMsg(longText),
      assistantMsg(longText),
    ]
    const result = findCutPoint(messages, 2000)
    if (result) {
      expect(result.messagesToSummarize.length + result.messagesToKeep.length).toBe(messages.length)
      expect(result.cutIndex).toBe(result.messagesToSummarize.length)
    }
  })

  it('provides keptTokenEstimate', () => {
    const longText = 'x'.repeat(4000)
    const messages: Message[] = [
      userMsg(longText),
      assistantMsg(longText),
      userMsg('short recent'),
      assistantMsg('short recent'),
    ]
    const result = findCutPoint(messages, 100)
    if (result) {
      expect(result.keptTokenEstimate).toBeGreaterThan(0)
    }
  })
})
