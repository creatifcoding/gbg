/**
 * Genifer RPC Layer Tests
 *
 * Tests:
 *   1. Tag constants are well-formed
 *   2. RPC definitions have correct structure
 *   3. Error schemas encode/decode properly
 *   4. RpcGroup composition works
 *
 * @module genifer/__tests__/rpc-layer.test
 */

import { describe, it, expect } from 'vitest'
import { Schema } from 'effect'
import {
  // Tags
  GeniferTreeTag,
  GeniferElementTag,
  GeniferCompositeTag,
  GeniferSignalTag,
  TreeGetByIdTag,
  TreeFindByThreadTag,
  ElementFindByTreeTag,
  CompositeFindByNameTag,
  SignalRecordTag,
  // Errors
  RpcGeniferQueryError,
  RpcGeniferTreeNotFoundError,
  RpcGeniferElementNotFoundError,
  RpcGeniferCompositeNotFoundError,
  RpcGeniferValidationError,
  // RPCs
  GeniferRpcs,
  GeniferTreeRpcs,
  GeniferElementRpcs,
  GeniferCompositeRpcs,
  GeniferSignalRpcs,
  GetTreeById,
  FindTreesByThread,
  InsertTree,
  UpdateTreeRating,
  FindElementsByTree,
  FindCompositeByName,
  RecordSignal,
} from '../rpc'

describe('Genifer RPC Layer', () => {
  // ===========================================================================
  // Tags
  // ===========================================================================

  describe('Tags', () => {
    it('schema tags are simple strings', () => {
      expect(GeniferTreeTag).toBe('GeniferTree')
      expect(GeniferElementTag).toBe('GeniferElement')
      expect(GeniferCompositeTag).toBe('GeniferComposite')
      expect(GeniferSignalTag).toBe('GeniferSignal')
    })

    it('RPC tags follow Entity.Method convention', () => {
      expect(TreeGetByIdTag).toBe('GeniferTree.GetById')
      expect(TreeFindByThreadTag).toBe('GeniferTree.FindByThread')
      expect(ElementFindByTreeTag).toBe('GeniferElement.FindByTree')
      expect(CompositeFindByNameTag).toBe('GeniferComposite.FindByName')
      expect(SignalRecordTag).toBe('GeniferSignal.Record')
    })
  })

  // ===========================================================================
  // Error Schemas
  // ===========================================================================

  describe('Error Schemas', () => {
    it('RpcGeniferQueryError round-trips', () => {
      const err = new RpcGeniferQueryError({
        operation: 'FindByThread',
        message: 'Connection timeout',
      })
      expect(err._tag).toBe('RpcGeniferQueryError')
      expect(err.operation).toBe('FindByThread')
      expect(err.message).toBe('Connection timeout')

      // Schema encode/decode
      const encoded = Schema.encodeSync(RpcGeniferQueryError)(err)
      expect(encoded._tag).toBe('RpcGeniferQueryError')
      const decoded = Schema.decodeUnknownSync(RpcGeniferQueryError)(encoded)
      expect(decoded.operation).toBe('FindByThread')
    })

    it('RpcGeniferTreeNotFoundError carries treeId', () => {
      const err = new RpcGeniferTreeNotFoundError({ treeId: 'tree-abc-123' })
      expect(err._tag).toBe('RpcGeniferTreeNotFoundError')
      expect(err.treeId).toBe('tree-abc-123')
    })

    it('RpcGeniferElementNotFoundError carries treeId + elementKey', () => {
      const err = new RpcGeniferElementNotFoundError({
        treeId: 'tree-1',
        elementKey: 'btn-submit',
      })
      expect(err._tag).toBe('RpcGeniferElementNotFoundError')
      expect(err.elementKey).toBe('btn-submit')
    })

    it('RpcGeniferCompositeNotFoundError carries name', () => {
      const err = new RpcGeniferCompositeNotFoundError({ name: 'LoginCard' })
      expect(err._tag).toBe('RpcGeniferCompositeNotFoundError')
      expect(err.name).toBe('LoginCard')
    })

    it('RpcGeniferValidationError carries field + message', () => {
      const err = new RpcGeniferValidationError({
        field: 'rating',
        message: 'Must be between 0 and 5',
      })
      expect(err._tag).toBe('RpcGeniferValidationError')
      expect(err.field).toBe('rating')
    })
  })

  // ===========================================================================
  // RPC Definitions
  // ===========================================================================

  describe('RPC Definitions', () => {
    it('GetTreeById is a valid Rpc definition', () => {
      expect(GetTreeById._tag).toBe(TreeGetByIdTag)
    })

    it('FindTreesByThread is a valid Rpc definition', () => {
      expect(FindTreesByThread._tag).toBe(TreeFindByThreadTag)
    })

    it('InsertTree is a valid Rpc definition', () => {
      expect(InsertTree._tag).toBe('GeniferTree.Insert')
    })

    it('UpdateTreeRating is a valid Rpc definition', () => {
      expect(UpdateTreeRating._tag).toBe('GeniferTree.UpdateRating')
    })

    it('FindElementsByTree is a valid Rpc definition', () => {
      expect(FindElementsByTree._tag).toBe('GeniferElement.FindByTree')
    })

    it('FindCompositeByName is a valid Rpc definition', () => {
      expect(FindCompositeByName._tag).toBe('GeniferComposite.FindByName')
    })

    it('RecordSignal is a valid Rpc definition', () => {
      expect(RecordSignal._tag).toBe('GeniferSignal.Record')
    })
  })

  // ===========================================================================
  // RpcGroup Composition
  // ===========================================================================

  describe('RpcGroup Composition', () => {
    it('GeniferTreeRpcs has 7 requests', () => {
      expect(GeniferTreeRpcs.requests.size).toBe(7)
    })

    it('GeniferElementRpcs has 4 requests', () => {
      expect(GeniferElementRpcs.requests.size).toBe(4)
    })

    it('GeniferCompositeRpcs has 3 requests', () => {
      expect(GeniferCompositeRpcs.requests.size).toBe(3)
    })

    it('GeniferSignalRpcs has 2 requests', () => {
      expect(GeniferSignalRpcs.requests.size).toBe(2)
    })

    it('GeniferRpcs has all 16 requests combined', () => {
      expect(GeniferRpcs.requests.size).toBe(16)
    })

    it('GeniferRpcs contains tree RPCs', () => {
      expect(GeniferRpcs.requests.has(TreeGetByIdTag)).toBe(true)
      expect(GeniferRpcs.requests.has(TreeFindByThreadTag)).toBe(true)
    })

    it('GeniferRpcs contains element RPCs', () => {
      expect(GeniferRpcs.requests.has(ElementFindByTreeTag)).toBe(true)
    })

    it('GeniferRpcs contains composite RPCs', () => {
      expect(GeniferRpcs.requests.has(CompositeFindByNameTag)).toBe(true)
    })

    it('GeniferRpcs contains signal RPCs', () => {
      expect(GeniferRpcs.requests.has(SignalRecordTag)).toBe(true)
    })
  })
})
