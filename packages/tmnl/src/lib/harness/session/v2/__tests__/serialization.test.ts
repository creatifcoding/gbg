/**
 * Serialization Tests — JSONL + JSON round-trips
 */
import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import {
  treeToJsonl,
  jsonlToTree,
  treeToJson,
  jsonToTree,
  extractMetadata,
} from '../serialization'
import { makeSessionTree } from '../tree'
import { appendEntry, makeMessageEntry, makeCompactionEntry, resetEntryCounter } from '../tree-ops'
import type { HarnessSessionId, EntryId } from '../identity'

const testId = 'test-session-001' as HarnessSessionId

function makeTestTree() {
  resetEntryCounter()
  const tree = makeSessionTree({ id: testId, cwd: '/tmp/test' })

  // Add some entries
  const msg1 = makeMessageEntry(tree, {
    role: 'user',
    content: 'Hello, world!',
  })
  const t1 = appendEntry(tree, msg1)

  const msg2 = makeMessageEntry(t1, {
    role: 'assistant',
    content: 'Hello! How can I help you today?',
  })
  const t2 = appendEntry(t1, msg2)

  return t2
}

describe('JSONL serialization', () => {
  it('treeToJsonl produces header + entry lines', async () => {
    const tree = makeTestTree()
    const jsonl = await Effect.runPromise(treeToJsonl(tree))

    const lines = jsonl.split('\n')
    expect(lines.length).toBe(3) // header + 2 entries

    // Header line has _tag
    const header = JSON.parse(lines[0])
    expect(header._tag).toBe('SessionHeader')
    expect(header.id).toBe(testId)

    // Entry lines have _tag
    const entry1 = JSON.parse(lines[1])
    expect(entry1._tag).toBe('MessageEntry')
    expect(entry1.message.role).toBe('user')

    const entry2 = JSON.parse(lines[2])
    expect(entry2._tag).toBe('MessageEntry')
    expect(entry2.message.role).toBe('assistant')
  })

  it('jsonlToTree round-trips cleanly', async () => {
    const original = makeTestTree()
    const jsonl = await Effect.runPromise(treeToJsonl(original))
    const restored = await Effect.runPromise(jsonlToTree(jsonl))

    expect(restored.header.id).toBe(original.header.id)
    expect(restored.header.cwd).toBe(original.header.cwd)
    expect(restored.entries.length).toBe(original.entries.length)
    expect(restored.leafId).toBe(original.leafId)

    // Verify entries match
    for (let i = 0; i < original.entries.length; i++) {
      expect(restored.entries[i]._tag).toBe(original.entries[i]._tag)
      expect(restored.entries[i].id).toBe(original.entries[i].id)
    }
  })

  it('jsonlToTree recomputes leafId correctly', async () => {
    const tree = makeTestTree()
    const jsonl = await Effect.runPromise(treeToJsonl(tree))
    const restored = await Effect.runPromise(jsonlToTree(jsonl))

    // Leaf should be the last entry (assistant message)
    const lastEntry = restored.entries[restored.entries.length - 1]
    expect(restored.leafId).toBe(lastEntry.id)
  })

  it('jsonlToTree skips blank lines', async () => {
    const tree = makeTestTree()
    const jsonl = await Effect.runPromise(treeToJsonl(tree))
    const withBlanks = jsonl + '\n\n\n'
    const restored = await Effect.runPromise(jsonlToTree(withBlanks))

    expect(restored.entries.length).toBe(2)
  })

  it('jsonlToTree fails on empty input', async () => {
    const result = await Effect.runPromise(
      jsonlToTree('').pipe(Effect.either),
    )
    expect(result._tag).toBe('Left')
  })
})

describe('JSON blob serialization', () => {
  it('treeToJson/jsonToTree round-trips', async () => {
    const original = makeTestTree()
    const json = await Effect.runPromise(treeToJson(original))
    const restored = await Effect.runPromise(jsonToTree(json))

    expect(restored.header.id).toBe(original.header.id)
    expect(restored.entries.length).toBe(original.entries.length)
    expect(restored.leafId).toBe(original.leafId)
  })

  it('jsonToTree fails on invalid JSON', async () => {
    const result = await Effect.runPromise(
      jsonToTree('not-json').pipe(Effect.either),
    )
    expect(result._tag).toBe('Left')
  })
})

describe('extractMetadata', () => {
  it('extracts metadata from a tree', () => {
    const tree = makeTestTree()
    const meta = extractMetadata(tree)

    expect(meta._tag).toBe('SessionMetadata')
    expect(meta.id).toBe(testId)
    expect(meta.messageCount).toBe(2)
    expect(meta.preview).toContain('Hello, world!')
    expect(meta.title).toContain('Hello, world!')
    expect(meta.status).toBe('active')
    expect(meta.createdAt).toBe(tree.header.timestamp)
  })

  it('handles empty tree', () => {
    resetEntryCounter()
    const tree = makeSessionTree({ id: testId, cwd: '/tmp/test' })
    const meta = extractMetadata(tree)

    expect(meta.messageCount).toBe(0)
    expect(meta.preview).toBe('')
    expect(meta.title).toBe('Untitled Session')
  })

  it('picks up model from ModelChangeEntry', () => {
    resetEntryCounter()
    const tree = makeSessionTree({ id: testId, cwd: '/tmp/test' })

    const withModel = appendEntry(tree, {
      _tag: 'ModelChangeEntry',
      id: 'e-model' as EntryId,
      parentId: null,
      timestamp: new Date().toISOString(),
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-20250514',
    })

    const meta = extractMetadata(withModel)
    expect(meta.provider).toBe('anthropic')
    expect(meta.model).toBe('claude-sonnet-4-20250514')
  })
})
