/**
 * Base Editor Tools Tests
 *
 * Unit tests for createBaseEditorTools factory.
 * Tests tool creation, execution with mock context, and error handling.
 *
 * Uses mock EditorAIContextValue to validate tool behavior without
 * requiring full Effect service layer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Effect } from 'effect'
import { createBaseEditorTools, type BaseEditorTools } from '../base-tools'
import type { EditorAIContextValue } from '../../components/EditorAIProvider'
import type { EditorOperationsShape } from '../../services/EditorOperations'
import type { EditorId, Selection, EditorMetadata } from '../../schemas/editor'

// -----------------------------------------------------------------------------
// Mock Factories
// -----------------------------------------------------------------------------

const createMockEditor = (
  id: EditorId,
  overrides?: Partial<EditorOperationsShape>
): EditorOperationsShape => ({
  id,
  focus: Effect.void,
  blur: Effect.void,
  isFocused: Effect.succeed(true),
  getSelection: Effect.succeed({ from: 0, to: 10, empty: false } as Selection),
  setSelection: () => Effect.void,
  clearSelection: Effect.void,
  getContent: Effect.succeed({ type: 'doc', content: [] }),
  getContentRange: () => Effect.succeed('sample content'),
  getSelectedText: Effect.succeed('selected text'),
  getMetadata: Effect.succeed({
    id,
    title: 'Test Document',
    documentId: 'doc-123',
    wordCount: 100,
    lastModified: new Date(),
  } as EditorMetadata),
  insertAtCursor: (content: string) => Effect.succeed(content.length),
  replaceSelection: () => Effect.void,
  deleteSelection: Effect.void,
  ...overrides,
})

const createMockContext = (
  editors: Map<EditorId, EditorOperationsShape> = new Map(),
  focusedId: EditorId | null = null
): EditorAIContextValue => ({
  getFocusedEditor: () =>
    focusedId ? editors.get(focusedId) ?? null : null,
  getEditor: (id: EditorId) => editors.get(id) ?? null,
  getAllEditorIds: () => Array.from(editors.keys()),
  getFocusedEditorId: () => focusedId,
  setFocusedEditor: vi.fn(),
  registerEditor: vi.fn(),
  unregisterEditor: vi.fn(),
})

// -----------------------------------------------------------------------------
// Tool Structure Tests
// -----------------------------------------------------------------------------

describe('createBaseEditorTools', () => {
  let tools: BaseEditorTools
  let mockEditor: EditorOperationsShape
  let mockContext: EditorAIContextValue

  beforeEach(() => {
    mockEditor = createMockEditor('editor-1' as EditorId)
    const editors = new Map<EditorId, EditorOperationsShape>([
      ['editor-1' as EditorId, mockEditor],
    ])
    mockContext = createMockContext(editors, 'editor-1' as EditorId)
    tools = createBaseEditorTools(mockContext)
  })

  describe('Tool Structure', () => {
    it('creates all expected tools', () => {
      expect(tools.read_selection).toBeDefined()
      expect(tools.get_context).toBeDefined()
      expect(tools.get_content_range).toBeDefined()
      expect(tools.insert_text).toBeDefined()
      expect(tools.replace_selection).toBeDefined()
      expect(tools.delete_selection).toBeDefined()
      expect(tools.set_selection).toBeDefined()
      expect(tools.clear_selection).toBeDefined()
      expect(tools.list_editors).toBeDefined()
      expect(tools.focus_editor).toBeDefined()
    })

    it('each tool has description and parameters', () => {
      const toolNames = Object.keys(tools) as Array<keyof BaseEditorTools>

      for (const name of toolNames) {
        const tool = tools[name]
        expect(tool).toHaveProperty('description')
        expect(tool).toHaveProperty('parameters')
        expect(tool).toHaveProperty('execute')
        expect(typeof tool.execute).toBe('function')
      }
    })
  })

  // ---------------------------------------------------------------------------
  // Read Operations
  // ---------------------------------------------------------------------------

  describe('read_selection', () => {
    it('returns selection and text when editor focused', async () => {
      const result = await tools.read_selection.execute({}, { toolCallId: 'test' })

      expect(result).toHaveProperty('selection')
      expect(result).toHaveProperty('text')
      expect(result.selection).toEqual({ from: 0, to: 10, empty: false })
      expect(result.text).toBe('selected text')
    })

    it('returns error when no editor focused', async () => {
      const noFocusContext = createMockContext(new Map(), null)
      const noFocusTools = createBaseEditorTools(noFocusContext)

      const result = await noFocusTools.read_selection.execute({}, { toolCallId: 'test' })

      expect(result).toHaveProperty('error')
      expect(result.selection).toBeNull()
    })
  })

  describe('get_context', () => {
    it('returns comprehensive context when editor focused', async () => {
      const result = await tools.get_context.execute({}, { toolCallId: 'test' })

      expect(result).toHaveProperty('editorId')
      expect(result).toHaveProperty('title')
      expect(result).toHaveProperty('selection')
      expect(result).toHaveProperty('selectedText')
      expect(result).toHaveProperty('wordCount')
      expect(result).toHaveProperty('cursorPosition')
    })

    it('returns error when no editor focused', async () => {
      const noFocusContext = createMockContext(new Map(), null)
      const noFocusTools = createBaseEditorTools(noFocusContext)

      const result = await noFocusTools.get_context.execute({}, { toolCallId: 'test' })

      expect(result).toHaveProperty('error')
    })
  })

  describe('get_content_range', () => {
    it('returns content for valid range', async () => {
      const result = await tools.get_content_range.execute(
        { from: 0, to: 50 },
        { toolCallId: 'test' }
      )

      expect(result).toHaveProperty('content')
      expect(result).toHaveProperty('from', 0)
      expect(result).toHaveProperty('to', 50)
    })
  })

  // ---------------------------------------------------------------------------
  // Write Operations
  // ---------------------------------------------------------------------------

  describe('insert_text', () => {
    it('inserts text and returns char count', async () => {
      const result = await tools.insert_text.execute(
        { content: 'Hello, world!' },
        { toolCallId: 'test' }
      )

      expect(result.success).toBe(true)
      expect(result.charsInserted).toBe(13)
    })

    it('returns error when no editor focused', async () => {
      const noFocusContext = createMockContext(new Map(), null)
      const noFocusTools = createBaseEditorTools(noFocusContext)

      const result = await noFocusTools.insert_text.execute(
        { content: 'test' },
        { toolCallId: 'test' }
      )

      expect(result.success).toBe(false)
      expect(result).toHaveProperty('error')
    })
  })

  describe('replace_selection', () => {
    it('replaces selection and returns success', async () => {
      const result = await tools.replace_selection.execute(
        { content: 'replacement' },
        { toolCallId: 'test' }
      )

      expect(result.success).toBe(true)
      expect(result.replaced).toBe(11)
    })
  })

  describe('delete_selection', () => {
    it('deletes selection and returns success', async () => {
      const result = await tools.delete_selection.execute({}, { toolCallId: 'test' })

      expect(result.success).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // Selection Operations
  // ---------------------------------------------------------------------------

  describe('set_selection', () => {
    it('sets selection range', async () => {
      const result = await tools.set_selection.execute(
        { from: 5, to: 15 },
        { toolCallId: 'test' }
      )

      expect(result.success).toBe(true)
      expect(result.from).toBe(5)
      expect(result.to).toBe(15)
    })
  })

  describe('clear_selection', () => {
    it('clears selection', async () => {
      const result = await tools.clear_selection.execute({}, { toolCallId: 'test' })

      expect(result.success).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // Editor Management
  // ---------------------------------------------------------------------------

  describe('list_editors', () => {
    it('returns list of registered editors', async () => {
      const result = await tools.list_editors.execute({}, { toolCallId: 'test' })

      expect(result.editors).toEqual(['editor-1'])
      expect(result.focused).toBe('editor-1')
      expect(result.count).toBe(1)
    })

    it('returns empty list when no editors registered', async () => {
      const emptyContext = createMockContext(new Map(), null)
      const emptyTools = createBaseEditorTools(emptyContext)

      const result = await emptyTools.list_editors.execute({}, { toolCallId: 'test' })

      expect(result.editors).toEqual([])
      expect(result.focused).toBeNull()
      expect(result.count).toBe(0)
    })

    it('handles multiple editors', async () => {
      const editor1 = createMockEditor('editor-1' as EditorId)
      const editor2 = createMockEditor('editor-2' as EditorId)
      const editor3 = createMockEditor('editor-3' as EditorId)

      const editors = new Map<EditorId, EditorOperationsShape>([
        ['editor-1' as EditorId, editor1],
        ['editor-2' as EditorId, editor2],
        ['editor-3' as EditorId, editor3],
      ])

      const multiContext = createMockContext(editors, 'editor-2' as EditorId)
      const multiTools = createBaseEditorTools(multiContext)

      const result = await multiTools.list_editors.execute({}, { toolCallId: 'test' })

      expect(result.editors).toHaveLength(3)
      expect(result.focused).toBe('editor-2')
      expect(result.count).toBe(3)
    })
  })

  describe('focus_editor', () => {
    it('focuses existing editor', async () => {
      const result = await tools.focus_editor.execute(
        { editorId: 'editor-1' },
        { toolCallId: 'test' }
      )

      expect(result.success).toBe(true)
      expect(result.focused).toBe('editor-1')
      expect(mockContext.setFocusedEditor).toHaveBeenCalledWith('editor-1')
    })

    it('returns error for non-existent editor', async () => {
      const result = await tools.focus_editor.execute(
        { editorId: 'nonexistent' },
        { toolCallId: 'test' }
      )

      expect(result.success).toBe(false)
      expect(result).toHaveProperty('error')
      expect(result.error).toContain('nonexistent')
    })
  })
})

// -----------------------------------------------------------------------------
// Edge Cases
// -----------------------------------------------------------------------------

describe('Base Tools Edge Cases', () => {
  describe('Editor operation errors', () => {
    it('handles editor operation that throws', async () => {
      const failingEditor = createMockEditor('failing' as EditorId, {
        getSelectedText: Effect.fail(new Error('Editor disconnected')),
      })

      const editors = new Map<EditorId, EditorOperationsShape>([
        ['failing' as EditorId, failingEditor],
      ])

      const failContext = createMockContext(editors, 'failing' as EditorId)
      const failTools = createBaseEditorTools(failContext)

      // This should throw since the Effect fails
      await expect(
        failTools.read_selection.execute({}, { toolCallId: 'test' })
      ).rejects.toThrow()
    })
  })

  describe('Empty content operations', () => {
    it('insert_text handles empty string', async () => {
      const editor = createMockEditor('editor-1' as EditorId)
      const editors = new Map([['editor-1' as EditorId, editor]])
      const ctx = createMockContext(editors, 'editor-1' as EditorId)
      const tools = createBaseEditorTools(ctx)

      const result = await tools.insert_text.execute(
        { content: '' },
        { toolCallId: 'test' }
      )

      expect(result.success).toBe(true)
      expect(result.charsInserted).toBe(0)
    })

    it('replace_selection handles empty replacement', async () => {
      const editor = createMockEditor('editor-1' as EditorId)
      const editors = new Map([['editor-1' as EditorId, editor]])
      const ctx = createMockContext(editors, 'editor-1' as EditorId)
      const tools = createBaseEditorTools(ctx)

      const result = await tools.replace_selection.execute(
        { content: '' },
        { toolCallId: 'test' }
      )

      expect(result.success).toBe(true)
      expect(result.replaced).toBe(0)
    })
  })

  describe('Null selection handling', () => {
    it('get_context handles null selection gracefully', async () => {
      const nullSelectionEditor = createMockEditor('editor-1' as EditorId, {
        getSelection: Effect.succeed(null),
      })

      const editors = new Map([['editor-1' as EditorId, nullSelectionEditor]])
      const ctx = createMockContext(editors, 'editor-1' as EditorId)
      const tools = createBaseEditorTools(ctx)

      const result = await tools.get_context.execute({}, { toolCallId: 'test' })

      expect(result.selection).toBeNull()
      expect(result.cursorPosition).toBe(0) // Defaults to 0 when no selection
    })
  })
})
