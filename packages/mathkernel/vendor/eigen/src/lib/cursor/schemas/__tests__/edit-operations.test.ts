/**
 * Edit Operations Schema Tests
 *
 * Verifies Effect Schema encoding, decoding, and validation
 * for structured edit operations.
 */

import { describe, it, expect } from 'vitest'
import { Schema } from 'effect'
import {
  EditOperationType,
  ConfidenceLevel,
  LineNumber,
  LineRange,
  FileTarget,
  EditMetadata,
  ReplaceOperation,
  InsertOperation,
  DeleteOperation,
  CreateFileOperation,
  EditOperation,
  EditBatch,
  EditOperationResult,
  EditBatchResult,
  generateEditOperationId,
  createReplaceOperation,
  createInsertOperation,
  createDeleteOperation,
  createCreateFileOperation,
  isReplaceOperation,
  isInsertOperation,
  isDeleteOperation,
  isCreateFileOperation,
  type FilePath,
  type EditOperationId,
} from '../edit-operations'

describe('Edit Operations Schema', () => {
  // ===========================================================================
  // Basic Types
  // ===========================================================================

  describe('EditOperationType', () => {
    it('should decode valid operation types', () => {
      const decode = Schema.decodeSync(EditOperationType)
      expect(decode('replace')).toBe('replace')
      expect(decode('insert')).toBe('insert')
      expect(decode('delete')).toBe('delete')
      expect(decode('create_file')).toBe('create_file')
    })

    it('should reject invalid operation types', () => {
      const decode = Schema.decodeSync(EditOperationType)
      expect(() => decode('patch' as any)).toThrow()
    })
  })

  describe('ConfidenceLevel', () => {
    it('should decode valid confidence levels', () => {
      const decode = Schema.decodeSync(ConfidenceLevel)
      expect(decode('high')).toBe('high')
      expect(decode('medium')).toBe('medium')
      expect(decode('low')).toBe('low')
    })
  })

  describe('LineNumber', () => {
    it('should accept positive integers', () => {
      const decode = Schema.decodeSync(LineNumber)
      expect(decode(1)).toBe(1)
      expect(decode(100)).toBe(100)
    })

    it('should reject zero', () => {
      const decode = Schema.decodeSync(LineNumber)
      expect(() => decode(0)).toThrow()
    })

    it('should reject negative numbers', () => {
      const decode = Schema.decodeSync(LineNumber)
      expect(() => decode(-1)).toThrow()
    })

    it('should reject non-integers', () => {
      const decode = Schema.decodeSync(LineNumber)
      expect(() => decode(1.5)).toThrow()
    })
  })

  describe('LineRange', () => {
    it('should accept valid ranges', () => {
      const decode = Schema.decodeSync(LineRange)
      expect(decode({ startLine: 1, endLine: 10 })).toEqual({
        startLine: 1,
        endLine: 10,
      })
    })

    it('should accept equal start and end', () => {
      const decode = Schema.decodeSync(LineRange)
      expect(decode({ startLine: 5, endLine: 5 })).toEqual({
        startLine: 5,
        endLine: 5,
      })
    })

    it('should reject startLine > endLine', () => {
      const decode = Schema.decodeSync(LineRange)
      expect(() => decode({ startLine: 10, endLine: 5 })).toThrow()
    })
  })

  // ===========================================================================
  // Operation Payloads
  // ===========================================================================

  describe('ReplaceOperation', () => {
    const validReplace: typeof ReplaceOperation.Type = {
      _tag: 'ReplaceOperation',
      id: 'edit-123' as EditOperationId,
      type: 'replace',
      target: {
        path: '/src/file.ts' as FilePath,
        startLine: 10 as typeof LineNumber.Type,
        endLine: 20 as typeof LineNumber.Type,
      },
      content: 'const x = 1;',
      metadata: {
        reasoning: 'Fixing variable declaration',
        confidence: 'high',
      },
    }

    it('should decode valid replace operation', () => {
      const decode = Schema.decodeSync(ReplaceOperation)
      const result = decode(validReplace)
      expect(result._tag).toBe('ReplaceOperation')
      expect(result.type).toBe('replace')
      expect(result.target.path).toBe('/src/file.ts')
    })

    it('should include optional originalContent', () => {
      const decode = Schema.decodeSync(ReplaceOperation)
      const withOriginal = {
        ...validReplace,
        originalContent: 'const x = 0;',
      }
      const result = decode(withOriginal)
      expect(result.originalContent).toBe('const x = 0;')
    })
  })

  describe('InsertOperation', () => {
    const validInsert: typeof InsertOperation.Type = {
      _tag: 'InsertOperation',
      id: 'edit-456' as EditOperationId,
      type: 'insert',
      target: {
        path: '/src/file.ts' as FilePath,
        startLine: 10 as typeof LineNumber.Type,
      },
      content: '// New comment\n',
      metadata: {
        reasoning: 'Adding documentation',
        confidence: 'medium',
      },
    }

    it('should decode valid insert operation', () => {
      const decode = Schema.decodeSync(InsertOperation)
      const result = decode(validInsert)
      expect(result._tag).toBe('InsertOperation')
      expect(result.type).toBe('insert')
    })

    it('should accept position parameter', () => {
      const decode = Schema.decodeSync(InsertOperation)
      const withPosition = {
        ...validInsert,
        position: 'after' as const,
      }
      const result = decode(withPosition)
      expect(result.position).toBe('after')
    })
  })

  describe('DeleteOperation', () => {
    const validDelete: typeof DeleteOperation.Type = {
      _tag: 'DeleteOperation',
      id: 'edit-789' as EditOperationId,
      type: 'delete',
      target: {
        path: '/src/file.ts' as FilePath,
        startLine: 10 as typeof LineNumber.Type,
        endLine: 15 as typeof LineNumber.Type,
      },
      metadata: {
        reasoning: 'Removing dead code',
        confidence: 'high',
      },
    }

    it('should decode valid delete operation', () => {
      const decode = Schema.decodeSync(DeleteOperation)
      const result = decode(validDelete)
      expect(result._tag).toBe('DeleteOperation')
      expect(result.type).toBe('delete')
    })
  })

  describe('CreateFileOperation', () => {
    const validCreate: typeof CreateFileOperation.Type = {
      _tag: 'CreateFileOperation',
      id: 'edit-abc' as EditOperationId,
      type: 'create_file',
      target: {
        path: '/src/new-file.ts' as FilePath,
      },
      content: 'export const foo = 1;',
      metadata: {
        reasoning: 'Creating new module',
        confidence: 'high',
      },
    }

    it('should decode valid create file operation', () => {
      const decode = Schema.decodeSync(CreateFileOperation)
      const result = decode(validCreate)
      expect(result._tag).toBe('CreateFileOperation')
      expect(result.type).toBe('create_file')
    })

    it('should accept overwrite flag', () => {
      const decode = Schema.decodeSync(CreateFileOperation)
      const withOverwrite = {
        ...validCreate,
        overwrite: true,
      }
      const result = decode(withOverwrite)
      expect(result.overwrite).toBe(true)
    })
  })

  // ===========================================================================
  // Union Type
  // ===========================================================================

  describe('EditOperation (Union)', () => {
    it('should decode replace operation', () => {
      const decode = Schema.decodeSync(EditOperation)
      const result = decode({
        _tag: 'ReplaceOperation',
        id: 'edit-123',
        type: 'replace',
        target: { path: '/src/file.ts', startLine: 1, endLine: 10 },
        content: 'new content',
        metadata: { reasoning: 'test', confidence: 'high' },
      })
      expect(result._tag).toBe('ReplaceOperation')
    })

    it('should decode insert operation', () => {
      const decode = Schema.decodeSync(EditOperation)
      const result = decode({
        _tag: 'InsertOperation',
        id: 'edit-456',
        type: 'insert',
        target: { path: '/src/file.ts', startLine: 5 },
        content: 'inserted',
        metadata: { reasoning: 'test', confidence: 'medium' },
      })
      expect(result._tag).toBe('InsertOperation')
    })
  })

  // ===========================================================================
  // Factory Functions
  // ===========================================================================

  describe('Factory Functions', () => {
    it('generateEditOperationId should create unique IDs', () => {
      const id1 = generateEditOperationId()
      const id2 = generateEditOperationId()
      expect(id1).not.toBe(id2)
      expect(id1.startsWith('edit-')).toBe(true)
    })

    it('createReplaceOperation should create valid operation', () => {
      const op = createReplaceOperation({
        path: '/src/file.ts',
        startLine: 10,
        endLine: 20,
        content: 'new code',
        reasoning: 'refactoring',
      })

      expect(op._tag).toBe('ReplaceOperation')
      expect(op.type).toBe('replace')
      expect(op.target.startLine).toBe(10)
      expect(op.metadata.reasoning).toBe('refactoring')
      expect(op.metadata.confidence).toBe('medium') // default
    })

    it('createInsertOperation should create valid operation', () => {
      const op = createInsertOperation({
        path: '/src/file.ts',
        startLine: 5,
        content: '// comment',
        reasoning: 'adding docs',
        confidence: 'high',
        position: 'before',
      })

      expect(op._tag).toBe('InsertOperation')
      expect(op.position).toBe('before')
      expect(op.metadata.confidence).toBe('high')
    })

    it('createDeleteOperation should create valid operation', () => {
      const op = createDeleteOperation({
        path: '/src/file.ts',
        startLine: 1,
        endLine: 5,
        reasoning: 'cleanup',
      })

      expect(op._tag).toBe('DeleteOperation')
      expect(op.type).toBe('delete')
    })

    it('createCreateFileOperation should create valid operation', () => {
      const op = createCreateFileOperation({
        path: '/src/new.ts',
        content: 'export {}',
        reasoning: 'new module',
        overwrite: true,
      })

      expect(op._tag).toBe('CreateFileOperation')
      expect(op.overwrite).toBe(true)
    })
  })

  // ===========================================================================
  // Type Guards
  // ===========================================================================

  describe('Type Guards', () => {
    it('isReplaceOperation should identify replace ops', () => {
      const op = createReplaceOperation({
        path: '/src/file.ts',
        startLine: 1,
        endLine: 10,
        content: 'x',
        reasoning: 'test',
      })
      expect(isReplaceOperation(op)).toBe(true)
      expect(isInsertOperation(op)).toBe(false)
      expect(isDeleteOperation(op)).toBe(false)
      expect(isCreateFileOperation(op)).toBe(false)
    })

    it('isInsertOperation should identify insert ops', () => {
      const op = createInsertOperation({
        path: '/src/file.ts',
        startLine: 1,
        content: 'x',
        reasoning: 'test',
      })
      expect(isInsertOperation(op)).toBe(true)
      expect(isReplaceOperation(op)).toBe(false)
    })

    it('isDeleteOperation should identify delete ops', () => {
      const op = createDeleteOperation({
        path: '/src/file.ts',
        startLine: 1,
        endLine: 5,
        reasoning: 'test',
      })
      expect(isDeleteOperation(op)).toBe(true)
      expect(isReplaceOperation(op)).toBe(false)
    })

    it('isCreateFileOperation should identify create ops', () => {
      const op = createCreateFileOperation({
        path: '/src/file.ts',
        content: 'x',
        reasoning: 'test',
      })
      expect(isCreateFileOperation(op)).toBe(true)
      expect(isReplaceOperation(op)).toBe(false)
    })
  })

  // ===========================================================================
  // Batch Operations
  // ===========================================================================

  describe('EditBatch', () => {
    it('should decode valid batch', () => {
      const decode = Schema.decodeSync(EditBatch)
      const batch = decode({
        id: 'batch-123',
        operations: [
          {
            _tag: 'ReplaceOperation',
            id: 'edit-1',
            type: 'replace',
            target: { path: '/src/file.ts', startLine: 1, endLine: 10 },
            content: 'new',
            metadata: { reasoning: 'test', confidence: 'high' },
          },
        ],
        createdAt: Date.now(),
      })
      expect(batch.id).toBe('batch-123')
      expect(batch.operations.length).toBe(1)
    })
  })

  // ===========================================================================
  // Results
  // ===========================================================================

  describe('EditOperationResult', () => {
    it('should decode success result', () => {
      const decode = Schema.decodeSync(EditOperationResult)
      const result = decode({
        operationId: 'edit-123',
        status: 'success',
        linesAffected: 5,
      })
      expect(result.status).toBe('success')
    })

    it('should decode failure result', () => {
      const decode = Schema.decodeSync(EditOperationResult)
      const result = decode({
        operationId: 'edit-123',
        status: 'failure',
        error: 'File not found',
      })
      expect(result.status).toBe('failure')
      expect(result.error).toBe('File not found')
    })
  })

  describe('EditBatchResult', () => {
    it('should decode batch result', () => {
      const decode = Schema.decodeSync(EditBatchResult)
      const result = decode({
        batchId: 'batch-123',
        status: 'success',
        results: [
          { operationId: 'edit-1', status: 'success' },
          { operationId: 'edit-2', status: 'success' },
        ],
        summary: {
          total: 2,
          succeeded: 2,
          failed: 0,
          skipped: 0,
        },
        durationMs: 150,
      })
      expect(result.status).toBe('success')
      expect(result.summary.succeeded).toBe(2)
    })
  })
})
