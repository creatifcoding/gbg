/**
 * Session Entry Schema Tests
 *
 * Unit: each entry type validates correct/incorrect data
 * Behavior: union discriminates correctly via _tag
 * Integration: full round-trip encode/decode, JSON serialization
 */

import { describe, it, expect } from '@effect/vitest'
import { Schema } from 'effect'
import {
  MessageEntry,
  ThinkingLevelChangeEntry,
  ModelChangeEntry,
  CompactionEntry,
  BranchSummaryEntry,
  CustomEntry,
  CustomMessageEntry,
  LabelEntry,
  SessionInfoEntry,
  SessionEntry,
  SESSION_ENTRY_TAGS,
  ContentBlock,
  SessionMessage,
  MessageRole,
  ThinkingLevel,
} from '../entries'

// =============================================================================
// Test fixtures
// =============================================================================

const BASE = {
  id: 'entry-001' as any,
  parentId: null,
  timestamp: '2026-02-28T14:00:00.000Z',
}

const BASE_WITH_PARENT = {
  ...BASE,
  id: 'entry-002' as any,
  parentId: 'entry-001' as any,
}

// =============================================================================
// Unit: Individual entry types
// =============================================================================

describe('Entry Schemas — Unit', () => {
  describe('MessageEntry', () => {
    const valid = {
      _tag: 'MessageEntry' as const,
      ...BASE,
      message: { role: 'user', content: 'Hello world' },
    }

    it('accepts valid user message with string content', () => {
      const result = Schema.decodeUnknownSync(MessageEntry)(valid)
      expect(result._tag).toBe('MessageEntry')
      expect(result.message.role).toBe('user')
      expect(result.message.content).toBe('Hello world')
    })

    it('accepts assistant message with content blocks', () => {
      const withBlocks = {
        ...valid,
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Here is the answer' },
            { type: 'thinking', text: 'Let me reason...' },
          ],
        },
      }
      const result = Schema.decodeUnknownSync(MessageEntry)(withBlocks)
      expect(result.message.role).toBe('assistant')
      expect(Array.isArray(result.message.content)).toBe(true)
    })

    it('accepts tool_call content block', () => {
      const withToolCall = {
        ...valid,
        message: {
          role: 'assistant',
          content: [{
            type: 'tool_call',
            toolCallId: 'tc-1',
            toolName: 'read_file',
            args: { path: '/tmp/test.txt' },
          }],
        },
      }
      const result = Schema.decodeUnknownSync(MessageEntry)(withToolCall)
      const content = result.message.content as any[]
      expect(content[0].type).toBe('tool_call')
      expect(content[0].toolName).toBe('read_file')
    })

    it('accepts tool_result content block', () => {
      const withToolResult = {
        ...valid,
        message: {
          role: 'tool',
          content: [{
            type: 'tool_result',
            toolCallId: 'tc-1',
            result: 'file contents here',
            isError: false,
          }],
        },
      }
      const result = Schema.decodeUnknownSync(MessageEntry)(withToolResult)
      const content = result.message.content as any[]
      expect(content[0].type).toBe('tool_result')
    })

    it('rejects message without role', () => {
      expect(() =>
        Schema.decodeUnknownSync(MessageEntry)({
          ...valid,
          message: { content: 'no role' },
        }),
      ).toThrow()
    })

    it('rejects invalid role', () => {
      expect(() =>
        Schema.decodeUnknownSync(MessageEntry)({
          ...valid,
          message: { role: 'invalid_role', content: 'test' },
        }),
      ).toThrow()
    })
  })

  describe('ThinkingLevelChangeEntry', () => {
    it('accepts valid thinking levels', () => {
      for (const level of ['off', 'minimal', 'low', 'medium', 'high']) {
        const result = Schema.decodeUnknownSync(ThinkingLevelChangeEntry)({
          _tag: 'ThinkingLevelChangeEntry',
          ...BASE,
          thinkingLevel: level,
        })
        expect(result.thinkingLevel).toBe(level)
      }
    })

    it('rejects invalid thinking level', () => {
      expect(() =>
        Schema.decodeUnknownSync(ThinkingLevelChangeEntry)({
          _tag: 'ThinkingLevelChangeEntry',
          ...BASE,
          thinkingLevel: 'ultra',
        }),
      ).toThrow()
    })
  })

  describe('ModelChangeEntry', () => {
    it('accepts valid model change', () => {
      const result = Schema.decodeUnknownSync(ModelChangeEntry)({
        _tag: 'ModelChangeEntry',
        ...BASE,
        provider: 'anthropic',
        modelId: 'claude-sonnet-4-20250514',
      })
      expect(result.provider).toBe('anthropic')
      expect(result.modelId).toBe('claude-sonnet-4-20250514')
    })
  })

  describe('CompactionEntry', () => {
    it('accepts valid compaction', () => {
      const result = Schema.decodeUnknownSync(CompactionEntry)({
        _tag: 'CompactionEntry',
        ...BASE_WITH_PARENT,
        summary: 'User discussed project setup and configuration.',
        firstKeptEntryId: 'entry-005',
        tokensBefore: 48000,
      })
      expect(result.summary).toContain('project setup')
      expect(result.tokensBefore).toBe(48000)
    })

    it('rejects negative tokensBefore', () => {
      expect(() =>
        Schema.decodeUnknownSync(CompactionEntry)({
          _tag: 'CompactionEntry',
          ...BASE_WITH_PARENT,
          summary: 'test',
          firstKeptEntryId: 'entry-005',
          tokensBefore: -100,
        }),
      ).toThrow()
    })

    it('accepts optional details and fromHook', () => {
      const result = Schema.decodeUnknownSync(CompactionEntry)({
        _tag: 'CompactionEntry',
        ...BASE_WITH_PARENT,
        summary: 'summary',
        firstKeptEntryId: 'entry-005',
        tokensBefore: 1000,
        details: { artifactIndex: ['file.ts'] },
        fromHook: true,
      })
      expect(result.fromHook).toBe(true)
      expect(result.details).toEqual({ artifactIndex: ['file.ts'] })
    })
  })

  describe('BranchSummaryEntry', () => {
    it('accepts valid branch summary', () => {
      const result = Schema.decodeUnknownSync(BranchSummaryEntry)({
        _tag: 'BranchSummaryEntry',
        ...BASE_WITH_PARENT,
        fromId: 'entry-003',
        summary: 'Explored alternative approach using SQLite.',
      })
      expect(result.fromId).toBe('entry-003')
    })
  })

  describe('CustomEntry', () => {
    it('accepts extension state', () => {
      const result = Schema.decodeUnknownSync(CustomEntry)({
        _tag: 'CustomEntry',
        ...BASE,
        customType: 'pattern-registry',
        data: { patterns: ['singleton', 'factory'] },
      })
      expect(result.customType).toBe('pattern-registry')
    })
  })

  describe('CustomMessageEntry', () => {
    it('accepts extension message with string content', () => {
      const result = Schema.decodeUnknownSync(CustomMessageEntry)({
        _tag: 'CustomMessageEntry',
        ...BASE,
        customType: 'git-diff',
        content: 'diff --git a/file.ts b/file.ts...',
        display: true,
      })
      expect(result.display).toBe(true)
    })

    it('accepts extension message with content blocks', () => {
      const result = Schema.decodeUnknownSync(CustomMessageEntry)({
        _tag: 'CustomMessageEntry',
        ...BASE,
        customType: 'screenshot',
        content: [{ type: 'image', url: 'data:image/png;base64,...' }],
        display: true,
      })
      const content = result.content as any[]
      expect(content[0].type).toBe('image')
    })
  })

  describe('LabelEntry', () => {
    it('accepts label with text', () => {
      const result = Schema.decodeUnknownSync(LabelEntry)({
        _tag: 'LabelEntry',
        ...BASE,
        targetId: 'entry-003',
        label: 'good approach',
      })
      expect(result.label).toBe('good approach')
    })

    it('accepts label clear (undefined)', () => {
      const result = Schema.decodeUnknownSync(LabelEntry)({
        _tag: 'LabelEntry',
        ...BASE,
        targetId: 'entry-003',
        label: undefined,
      })
      expect(result.label).toBeUndefined()
    })
  })

  describe('SessionInfoEntry', () => {
    it('accepts session name', () => {
      const result = Schema.decodeUnknownSync(SessionInfoEntry)({
        _tag: 'SessionInfoEntry',
        ...BASE,
        name: 'Architecture Review Session',
      })
      expect(result.name).toBe('Architecture Review Session')
    })
  })
})

// =============================================================================
// Behavior: Union discrimination
// =============================================================================

describe('SessionEntry Union — Behavior', () => {
  it('discriminates all 9 entry types by _tag', () => {
    const entries = [
      { _tag: 'MessageEntry', ...BASE, message: { role: 'user', content: 'hi' } },
      { _tag: 'ThinkingLevelChangeEntry', ...BASE, thinkingLevel: 'high' },
      { _tag: 'ModelChangeEntry', ...BASE, provider: 'openai', modelId: 'gpt-4' },
      { _tag: 'CompactionEntry', ...BASE_WITH_PARENT, summary: 's', firstKeptEntryId: 'e-1', tokensBefore: 100 },
      { _tag: 'BranchSummaryEntry', ...BASE_WITH_PARENT, fromId: 'e-1', summary: 's' },
      { _tag: 'CustomEntry', ...BASE, customType: 'ext', data: null },
      { _tag: 'CustomMessageEntry', ...BASE, customType: 'ext', content: 'msg', display: false },
      { _tag: 'LabelEntry', ...BASE, targetId: 'e-1', label: 'mark' },
      { _tag: 'SessionInfoEntry', ...BASE, name: 'test' },
    ]

    for (const entry of entries) {
      const result = Schema.decodeUnknownSync(SessionEntry)(entry)
      expect(result._tag).toBe(entry._tag)
    }
  })

  it('rejects unknown _tag', () => {
    expect(() =>
      Schema.decodeUnknownSync(SessionEntry)({
        _tag: 'UnknownEntry',
        ...BASE,
      }),
    ).toThrow()
  })

  it('SESSION_ENTRY_TAGS matches all union members', () => {
    expect(SESSION_ENTRY_TAGS).toHaveLength(9)
    expect(SESSION_ENTRY_TAGS).toContain('MessageEntry')
    expect(SESSION_ENTRY_TAGS).toContain('CompactionEntry')
    expect(SESSION_ENTRY_TAGS).toContain('BranchSummaryEntry')
    expect(SESSION_ENTRY_TAGS).toContain('LabelEntry')
  })
})

// =============================================================================
// Integration: JSON round-trip
// =============================================================================

describe('SessionEntry — Integration (JSON round-trip)', () => {
  it('MessageEntry survives JSON.stringify → JSON.parse → decode', () => {
    const original = {
      _tag: 'MessageEntry' as const,
      ...BASE_WITH_PARENT,
      message: {
        role: 'assistant' as const,
        content: [
          { type: 'thinking' as const, text: 'Let me think...' },
          { type: 'text' as const, text: 'The answer is 42.' },
        ],
      },
    }

    const decoded = Schema.decodeUnknownSync(MessageEntry)(original)
    const json = JSON.stringify(decoded)
    const parsed = JSON.parse(json)
    const reDecoded = Schema.decodeUnknownSync(MessageEntry)(parsed)

    expect(reDecoded._tag).toBe('MessageEntry')
    expect(reDecoded.message.role).toBe('assistant')
    expect(reDecoded.id).toBe(decoded.id)
    expect(reDecoded.parentId).toBe(decoded.parentId)
  })

  it('CompactionEntry survives JSON round-trip with details', () => {
    const original = {
      _tag: 'CompactionEntry' as const,
      ...BASE_WITH_PARENT,
      summary: 'Discussion about session architecture.',
      firstKeptEntryId: 'entry-010' as any,
      tokensBefore: 95000,
      details: { version: 2, artifacts: ['AUDIT.md'] },
      fromHook: false,
    }

    const decoded = Schema.decodeUnknownSync(CompactionEntry)(original)
    const json = JSON.stringify(decoded)
    const reDecoded = Schema.decodeUnknownSync(CompactionEntry)(JSON.parse(json))

    expect(reDecoded.tokensBefore).toBe(95000)
    expect(reDecoded.details).toEqual({ version: 2, artifacts: ['AUDIT.md'] })
  })

  it('full SessionEntry union round-trips through JSON', () => {
    const entry = Schema.decodeUnknownSync(SessionEntry)({
      _tag: 'BranchSummaryEntry',
      ...BASE_WITH_PARENT,
      fromId: 'entry-005',
      summary: 'Explored React Server Components approach.',
    })

    const json = JSON.stringify(entry)
    const reDecoded = Schema.decodeUnknownSync(SessionEntry)(JSON.parse(json))

    expect(reDecoded._tag).toBe('BranchSummaryEntry')
    if (reDecoded._tag === 'BranchSummaryEntry') {
      expect(reDecoded.fromId).toBe('entry-005')
    }
  })
})
