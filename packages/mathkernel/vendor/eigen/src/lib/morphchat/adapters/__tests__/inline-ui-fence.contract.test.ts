/**
 * Inline UI Fence Contract Tests
 *
 * Validates the ```ui NDJSON fence → progressive UITree pipeline:
 *   1. Complete NDJSON inside ```ui fence → UITreePart on close
 *   2. Invalid lines → falls back to CodePart
 *   3. Text interleave ordering preserved around rendered UI
 *   4. While streaming: CodePart with language='ui' (renderer handles progressive parse)
 *   5. Other code fences (```json, ```ts) unaffected
 *   6. Token-by-token streaming across delta boundaries
 *   7. Multiple ```ui fences in one message
 */

import { describe, expect, it } from 'vitest'
import { HashMap } from 'effect'
import { appendTextDelta } from '../harness-event-processor'
import type { ChatMessagePart } from '../../schemas/message-types'

// =============================================================================
// Fixtures — NDJSON format (one JSON object per line)
// =============================================================================

/** Valid NDJSON: root declaration + 3 elements */
const VALID_NDJSON = [
  '{"root":"login-form"}',
  '{"key":"login-form","type":"form","props":{"title":"Sign In"},"children":["email-field","submit-btn"]}',
  '{"key":"email-field","type":"input","props":{"label":"Email","placeholder":"you@example.com"}}',
  '{"key":"submit-btn","type":"button","props":{"label":"Sign In","variant":"primary"}}',
].join('\n')

const INVALID_NDJSON = 'not json at all\nstill not json'

const NO_ROOT_NDJSON = [
  '{"key":"btn","type":"button","props":{"label":"Click"}}',
].join('\n')

const SECOND_TREE_NDJSON = [
  '{"root":"alert"}',
  '{"key":"alert","type":"alert","props":{"message":"Done!"}}',
].join('\n')

// =============================================================================
// Tests
// =============================================================================

describe('inline ```ui NDJSON fence', () => {
  it('converts valid NDJSON to UITreePart on fence close', () => {
    let parts: ReadonlyArray<ChatMessagePart> = []

    // Open fence
    parts = appendTextDelta(parts, '```ui\n')
    expect(parts).toHaveLength(1)
    expect(parts[0]._tag).toBe('code')
    expect((parts[0] as any).language).toBe('ui')
    expect((parts[0] as any).isStreaming).toBe(true)

    // Stream the NDJSON content
    parts = appendTextDelta(parts, VALID_NDJSON)
    expect(parts).toHaveLength(1)
    expect(parts[0]._tag).toBe('code') // still streaming
    expect((parts[0] as any).isStreaming).toBe(true)

    // Close fence → snap to UITreePart
    parts = appendTextDelta(parts, '\n```\n')
    expect(parts).toHaveLength(1)
    expect(parts[0]._tag).toBe('ui-tree')

    const uiPart = parts[0] as any
    expect(uiPart.tree.root).toBe('login-form')
    expect(HashMap.size(uiPart.tree.elements)).toBe(3)
  })

  it('during streaming, CodePart has language=ui for progressive rendering', () => {
    let parts: ReadonlyArray<ChatMessagePart> = []

    parts = appendTextDelta(parts, '```ui\n')
    parts = appendTextDelta(parts, '{"root":"form"}\n')
    parts = appendTextDelta(parts, '{"key":"form","type":"container","props":{}}\n')

    // Still streaming — should be CodePart with language='ui'
    expect(parts).toHaveLength(1)
    expect(parts[0]._tag).toBe('code')
    const codePart = parts[0] as any
    expect(codePart.language).toBe('ui')
    expect(codePart.isStreaming).toBe(true)
    // The accumulated NDJSON is in codePart.code — renderer parses this
    expect(codePart.code).toContain('{"root":"form"}')
    expect(codePart.code).toContain('{"key":"form"')
  })

  it('falls back to CodePart when NDJSON is invalid', () => {
    let parts: ReadonlyArray<ChatMessagePart> = []

    parts = appendTextDelta(parts, '```ui\n')
    parts = appendTextDelta(parts, INVALID_NDJSON)
    parts = appendTextDelta(parts, '\n```\n')

    expect(parts).toHaveLength(1)
    expect(parts[0]._tag).toBe('code')
    expect((parts[0] as any).language).toBe('ui')
    expect((parts[0] as any).isStreaming).toBe(false)
  })

  it('falls back to CodePart when no root declaration', () => {
    let parts: ReadonlyArray<ChatMessagePart> = []

    parts = appendTextDelta(parts, '```ui\n')
    parts = appendTextDelta(parts, NO_ROOT_NDJSON)
    parts = appendTextDelta(parts, '\n```\n')

    expect(parts).toHaveLength(1)
    expect(parts[0]._tag).toBe('code')
  })

  it('preserves text before and after ```ui fence', () => {
    let parts: ReadonlyArray<ChatMessagePart> = []

    // Text before
    parts = appendTextDelta(parts, 'Here is the form:\n\n')
    expect(parts[0]._tag).toBe('text')

    // Fence
    parts = appendTextDelta(parts, '```ui\n')
    parts = appendTextDelta(parts, VALID_NDJSON)
    parts = appendTextDelta(parts, '\n```\n')

    // Text after
    parts = appendTextDelta(parts, 'Let me know if you want changes.')

    // text, ui-tree, text
    expect(parts).toHaveLength(3)
    expect(parts[0]._tag).toBe('text')
    expect((parts[0] as any).content).toContain('Here is the form')
    expect(parts[1]._tag).toBe('ui-tree')
    expect(parts[2]._tag).toBe('text')
    expect((parts[2] as any).content).toContain('Let me know')
  })

  it('does not affect other code fence languages', () => {
    let parts: ReadonlyArray<ChatMessagePart> = []

    parts = appendTextDelta(parts, '```json\n')
    parts = appendTextDelta(parts, '{"hello": "world"}')
    parts = appendTextDelta(parts, '\n```\n')

    expect(parts).toHaveLength(1)
    expect(parts[0]._tag).toBe('code')
    expect((parts[0] as any).language).toBe('json')
  })

  it('handles token-by-token streaming across delta boundaries', () => {
    let parts: ReadonlyArray<ChatMessagePart> = []

    const fullContent = '```ui\n' + VALID_NDJSON + '\n```\n'
    const chunkSize = 12

    for (let i = 0; i < fullContent.length; i += chunkSize) {
      parts = appendTextDelta(parts, fullContent.slice(i, i + chunkSize))
    }

    const uiParts = parts.filter(p => p._tag === 'ui-tree')
    expect(uiParts).toHaveLength(1)

    const uiPart = uiParts[0] as any
    expect(uiPart.tree.root).toBe('login-form')
    expect(HashMap.size(uiPart.tree.elements)).toBe(3)
  })

  it('handles multiple ```ui fences in one message', () => {
    let parts: ReadonlyArray<ChatMessagePart> = []

    // First fence
    parts = appendTextDelta(parts, 'First:\n```ui\n')
    parts = appendTextDelta(parts, VALID_NDJSON)
    parts = appendTextDelta(parts, '\n```\n')

    // Between
    parts = appendTextDelta(parts, 'Second:\n```ui\n')
    parts = appendTextDelta(parts, SECOND_TREE_NDJSON)
    parts = appendTextDelta(parts, '\n```\n')

    const uiParts = parts.filter(p => p._tag === 'ui-tree')
    expect(uiParts).toHaveLength(2)
    expect((uiParts[0] as any).tree.root).toBe('login-form')
    expect((uiParts[1] as any).tree.root).toBe('alert')
  })
})
