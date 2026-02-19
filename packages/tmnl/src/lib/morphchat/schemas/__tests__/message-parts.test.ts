/**
 * ChatMessagePart Schema Tests
 *
 * Validates round-trip encode/decode for all part types,
 * backwards compatibility with flat content, and the
 * getMessageParts/flattenPartsToText utilities.
 *
 * @module morphchat/schemas/__tests__/message-parts
 */

import { describe, it, expect } from 'vitest'
import { Schema } from 'effect'
import {
  TextPart,
  ThinkingPart,
  ToolInvocationPart,
  ToolInvocationState,
  FilePart,
  ChatMessagePart,
  ChatMessage,
  flattenPartsToText,
  getMessageParts,
} from '../message-types'

// =============================================================================
// TextPart
// =============================================================================

describe('TextPart', () => {
  it('decodes a valid text part', () => {
    const input = { _tag: 'text' as const, content: 'Hello world' }
    const result = Schema.decodeUnknownSync(TextPart)(input)
    expect(result._tag).toBe('text')
    expect(result.content).toBe('Hello world')
  })

  it('round-trips through encode/decode', () => {
    const part: TextPart = { _tag: 'text', content: 'markdown **bold**' }
    const encoded = Schema.encodeSync(TextPart)(part)
    const decoded = Schema.decodeUnknownSync(TextPart)(encoded)
    expect(decoded).toEqual(part)
  })

  it('rejects missing content', () => {
    expect(() =>
      Schema.decodeUnknownSync(TextPart)({ _tag: 'text' }),
    ).toThrow()
  })
})

// =============================================================================
// ThinkingPart
// =============================================================================

describe('ThinkingPart', () => {
  it('decodes a streaming thinking part', () => {
    const input = {
      _tag: 'thinking' as const,
      content: 'Let me analyze...',
      isStreaming: true,
    }
    const result = Schema.decodeUnknownSync(ThinkingPart)(input)
    expect(result._tag).toBe('thinking')
    expect(result.content).toBe('Let me analyze...')
    expect(result.isStreaming).toBe(true)
    expect(result.durationMs).toBeUndefined()
  })

  it('decodes a completed thinking part with duration', () => {
    const input = {
      _tag: 'thinking' as const,
      content: 'Full reasoning chain here',
      isStreaming: false,
      durationMs: 4200,
    }
    const result = Schema.decodeUnknownSync(ThinkingPart)(input)
    expect(result.isStreaming).toBe(false)
    expect(result.durationMs).toBe(4200)
  })

  it('round-trips through encode/decode', () => {
    const part: ThinkingPart = {
      _tag: 'thinking',
      content: 'Reasoning...',
      isStreaming: false,
      durationMs: 3000,
    }
    const encoded = Schema.encodeSync(ThinkingPart)(part)
    const decoded = Schema.decodeUnknownSync(ThinkingPart)(encoded)
    expect(decoded).toEqual(part)
  })
})

// =============================================================================
// ToolInvocationPart
// =============================================================================

describe('ToolInvocationPart', () => {
  it('decodes a pending tool invocation', () => {
    const input = {
      _tag: 'tool-invocation' as const,
      toolCallId: 'call_123',
      toolName: 'read_file',
      state: 'pending' as const,
    }
    const result = Schema.decodeUnknownSync(ToolInvocationPart)(input)
    expect(result._tag).toBe('tool-invocation')
    expect(result.toolCallId).toBe('call_123')
    expect(result.toolName).toBe('read_file')
    expect(result.state).toBe('pending')
    expect(result.input).toBeUndefined()
    expect(result.output).toBeUndefined()
  })

  it('decodes a completed tool with input/output', () => {
    const input = {
      _tag: 'tool-invocation' as const,
      toolCallId: 'call_456',
      toolName: 'execute_command',
      state: 'completed' as const,
      input: { command: 'ls -la' },
      output: { stdout: 'file1.txt\nfile2.txt' },
    }
    const result = Schema.decodeUnknownSync(ToolInvocationPart)(input)
    expect(result.state).toBe('completed')
    expect(result.input).toEqual({ command: 'ls -la' })
    expect(result.output).toEqual({ stdout: 'file1.txt\nfile2.txt' })
  })

  it('decodes an error tool with errorText', () => {
    const input = {
      _tag: 'tool-invocation' as const,
      toolCallId: 'call_789',
      toolName: 'write_file',
      state: 'error' as const,
      errorText: 'Permission denied',
    }
    const result = Schema.decodeUnknownSync(ToolInvocationPart)(input)
    expect(result.state).toBe('error')
    expect(result.errorText).toBe('Permission denied')
  })

  it('validates all ToolInvocationState values', () => {
    const states = [
      'pending', 'running', 'approval-required', 'approved',
      'completed', 'error', 'denied',
    ]
    for (const state of states) {
      expect(() =>
        Schema.decodeUnknownSync(ToolInvocationState)(state),
      ).not.toThrow()
    }
    expect(() =>
      Schema.decodeUnknownSync(ToolInvocationState)('unknown'),
    ).toThrow()
  })

  it('round-trips through encode/decode', () => {
    const part: ToolInvocationPart = {
      _tag: 'tool-invocation',
      toolCallId: 'call_rt',
      toolName: 'search',
      state: 'completed',
      input: { query: 'test' },
      output: { results: [1, 2, 3] },
    }
    const encoded = Schema.encodeSync(ToolInvocationPart)(part)
    const decoded = Schema.decodeUnknownSync(ToolInvocationPart)(encoded)
    expect(decoded).toEqual(part)
  })
})

// =============================================================================
// FilePart
// =============================================================================

describe('FilePart', () => {
  it('decodes a minimal file part', () => {
    const input = {
      _tag: 'file' as const,
      url: 'data:image/png;base64,abc',
      mediaType: 'image/png',
    }
    const result = Schema.decodeUnknownSync(FilePart)(input)
    expect(result._tag).toBe('file')
    expect(result.url).toBe('data:image/png;base64,abc')
    expect(result.mediaType).toBe('image/png')
  })

  it('decodes a file part with all fields', () => {
    const input = {
      _tag: 'file' as const,
      url: 'https://example.com/doc.pdf',
      mediaType: 'application/pdf',
      filename: 'report.pdf',
      size: 1024000,
    }
    const result = Schema.decodeUnknownSync(FilePart)(input)
    expect(result.filename).toBe('report.pdf')
    expect(result.size).toBe(1024000)
  })

  it('round-trips through encode/decode', () => {
    const part: FilePart = {
      _tag: 'file',
      url: 'https://cdn.example.com/img.jpg',
      mediaType: 'image/jpeg',
      filename: 'photo.jpg',
      size: 512000,
    }
    const encoded = Schema.encodeSync(FilePart)(part)
    const decoded = Schema.decodeUnknownSync(FilePart)(encoded)
    expect(decoded).toEqual(part)
  })
})

// =============================================================================
// ChatMessagePart (Union)
// =============================================================================

describe('ChatMessagePart', () => {
  it('discriminates text parts by _tag', () => {
    const result = Schema.decodeUnknownSync(ChatMessagePart)({
      _tag: 'text',
      content: 'hello',
    })
    expect(result._tag).toBe('text')
  })

  it('discriminates thinking parts by _tag', () => {
    const result = Schema.decodeUnknownSync(ChatMessagePart)({
      _tag: 'thinking',
      content: 'hmm',
      isStreaming: false,
    })
    expect(result._tag).toBe('thinking')
  })

  it('discriminates tool-invocation parts by _tag', () => {
    const result = Schema.decodeUnknownSync(ChatMessagePart)({
      _tag: 'tool-invocation',
      toolCallId: 'c1',
      toolName: 'test',
      state: 'running',
    })
    expect(result._tag).toBe('tool-invocation')
  })

  it('discriminates file parts by _tag', () => {
    const result = Schema.decodeUnknownSync(ChatMessagePart)({
      _tag: 'file',
      url: 'https://x.com/f.png',
      mediaType: 'image/png',
    })
    expect(result._tag).toBe('file')
  })

  it('rejects unknown _tag values', () => {
    expect(() =>
      Schema.decodeUnknownSync(ChatMessagePart)({
        _tag: 'video',
        content: 'nope',
      }),
    ).toThrow()
  })
})

// =============================================================================
// ChatMessage with parts
// =============================================================================

describe('ChatMessage with parts', () => {
  const baseMsg = {
    id: 'msg-1',
    role: 'agent' as const,
    content: 'Hello there',
    timestamp: new Date().toISOString(),
    status: 'complete' as const,
  }

  it('decodes a message without parts (backwards compat)', () => {
    const result = Schema.decodeUnknownSync(ChatMessage)(baseMsg)
    expect(result.parts).toBeUndefined()
    expect(result.content).toBe('Hello there')
  })

  it('decodes a message with mixed parts', () => {
    const input = {
      ...baseMsg,
      parts: [
        { _tag: 'thinking' as const, content: 'Let me think...', isStreaming: false, durationMs: 2000 },
        { _tag: 'text' as const, content: 'Here is my answer.' },
        {
          _tag: 'tool-invocation' as const,
          toolCallId: 'tc-1',
          toolName: 'search',
          state: 'completed' as const,
          input: { q: 'test' },
          output: { results: [] },
        },
        { _tag: 'text' as const, content: '\n\nBased on the search results...' },
      ],
    }
    const result = Schema.decodeUnknownSync(ChatMessage)(input)
    expect(result.parts).toHaveLength(4)
    expect(result.parts![0]._tag).toBe('thinking')
    expect(result.parts![1]._tag).toBe('text')
    expect(result.parts![2]._tag).toBe('tool-invocation')
    expect(result.parts![3]._tag).toBe('text')
  })

  it('round-trips a message with parts', () => {
    const msg: ChatMessage = {
      ...baseMsg,
      parts: [
        { _tag: 'text', content: 'First paragraph' },
        { _tag: 'thinking', content: 'Reasoning', isStreaming: false },
        { _tag: 'text', content: 'Second paragraph' },
      ],
    }
    const encoded = Schema.encodeSync(ChatMessage)(msg)
    const decoded = Schema.decodeUnknownSync(ChatMessage)(encoded)
    expect(decoded.parts).toEqual(msg.parts)
  })
})

// =============================================================================
// Utility: flattenPartsToText
// =============================================================================

describe('flattenPartsToText', () => {
  it('extracts text from text parts only', () => {
    const parts: ChatMessagePart[] = [
      { _tag: 'thinking', content: 'ignored', isStreaming: false },
      { _tag: 'text', content: 'Hello ' },
      { _tag: 'tool-invocation', toolCallId: 'c1', toolName: 't', state: 'running' },
      { _tag: 'text', content: 'world' },
    ]
    expect(flattenPartsToText(parts)).toBe('Hello world')
  })

  it('returns empty string for no text parts', () => {
    const parts: ChatMessagePart[] = [
      { _tag: 'thinking', content: 'thought', isStreaming: true },
    ]
    expect(flattenPartsToText(parts)).toBe('')
  })

  it('handles empty array', () => {
    expect(flattenPartsToText([])).toBe('')
  })
})

// =============================================================================
// Utility: getMessageParts
// =============================================================================

describe('getMessageParts', () => {
  const baseMsg: ChatMessage = {
    id: 'msg-2',
    role: 'agent',
    content: 'Legacy content',
    timestamp: new Date().toISOString(),
    status: 'complete',
  }

  it('returns parts when populated', () => {
    const msg: ChatMessage = {
      ...baseMsg,
      parts: [
        { _tag: 'text', content: 'Rich content' },
        { _tag: 'thinking', content: 'thought', isStreaming: false },
      ],
    }
    const result = getMessageParts(msg)
    expect(result).toHaveLength(2)
    expect(result[0]._tag).toBe('text')
  })

  it('wraps flat content as TextPart when parts is undefined', () => {
    const result = getMessageParts(baseMsg)
    expect(result).toHaveLength(1)
    expect(result[0]._tag).toBe('text')
    expect((result[0] as TextPart).content).toBe('Legacy content')
  })

  it('wraps flat content as TextPart when parts is empty array', () => {
    const msg: ChatMessage = { ...baseMsg, parts: [] }
    const result = getMessageParts(msg)
    expect(result).toHaveLength(1)
    expect(result[0]._tag).toBe('text')
  })
})
