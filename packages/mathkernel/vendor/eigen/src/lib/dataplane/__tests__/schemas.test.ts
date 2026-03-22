/**
 * @fileoverview Schema validation tests for dataplane link system
 */

import { describe, it, expect } from 'vitest';
import { Schema } from 'effect';
import {
  PortId,
  LinkId,
  PlaneId,
  BlockId,
  LinkDirection,
  LinkRelationship,
  PortDirection,
  PortPosition,
  PortDataType,
  LinkPort,
  Link,
  Plane,
  CreateLinkConfig,
  CreatePortConfig,
  CreatePlaneConfig,
} from '../schemas/link';

describe('Dataplane Schemas', () => {
  // ===========================================================================
  // Branded ID Types
  // ===========================================================================

  describe('PortId', () => {
    it('accepts valid string', () => {
      const result = Schema.decodeUnknownSync(PortId)('port-123');
      expect(result).toBe('port-123');
    });

    it('rejects empty string', () => {
      expect(() => Schema.decodeUnknownSync(PortId)('')).toThrow();
    });

    it('maintains brand through encode/decode roundtrip', () => {
      const encoded = Schema.encodeSync(PortId)('port-abc' as PortId);
      const decoded = Schema.decodeUnknownSync(PortId)(encoded);
      expect(decoded).toBe('port-abc');
    });
  });

  describe('LinkId', () => {
    it('accepts valid string', () => {
      const result = Schema.decodeUnknownSync(LinkId)('link-456');
      expect(result).toBe('link-456');
    });

    it('rejects empty string', () => {
      expect(() => Schema.decodeUnknownSync(LinkId)('')).toThrow();
    });
  });

  describe('PlaneId', () => {
    it('accepts valid string', () => {
      const result = Schema.decodeUnknownSync(PlaneId)('plane-789');
      expect(result).toBe('plane-789');
    });

    it('rejects empty string', () => {
      expect(() => Schema.decodeUnknownSync(PlaneId)('')).toThrow();
    });
  });

  describe('BlockId', () => {
    it('accepts valid string', () => {
      const result = Schema.decodeUnknownSync(BlockId)('block-xyz');
      expect(result).toBe('block-xyz');
    });

    it('rejects empty string', () => {
      expect(() => Schema.decodeUnknownSync(BlockId)('')).toThrow();
    });
  });

  // ===========================================================================
  // Literal Enums
  // ===========================================================================

  describe('LinkDirection', () => {
    it('accepts unidirectional', () => {
      const result = Schema.decodeUnknownSync(LinkDirection)('unidirectional');
      expect(result).toBe('unidirectional');
    });

    it('accepts bidirectional', () => {
      const result = Schema.decodeUnknownSync(LinkDirection)('bidirectional');
      expect(result).toBe('bidirectional');
    });

    it('rejects invalid values', () => {
      expect(() =>
        Schema.decodeUnknownSync(LinkDirection)('invalid')
      ).toThrow();
    });
  });

  describe('LinkRelationship', () => {
    const validValues = ['pipe', 'sync', 'aggregate', 'mirror'] as const;

    it.each(validValues)('accepts %s', (value) => {
      const result = Schema.decodeUnknownSync(LinkRelationship)(value);
      expect(result).toBe(value);
    });

    it('rejects invalid values', () => {
      expect(() =>
        Schema.decodeUnknownSync(LinkRelationship)('broadcast')
      ).toThrow();
    });
  });

  describe('PortDirection', () => {
    const validValues = ['in', 'out', 'inout'] as const;

    it.each(validValues)('accepts %s', (value) => {
      const result = Schema.decodeUnknownSync(PortDirection)(value);
      expect(result).toBe(value);
    });
  });

  describe('PortPosition', () => {
    const validValues = ['left', 'right', 'top', 'bottom'] as const;

    it.each(validValues)('accepts %s', (value) => {
      const result = Schema.decodeUnknownSync(PortPosition)(value);
      expect(result).toBe(value);
    });
  });

  describe('PortDataType', () => {
    const validValues = ['table', 'row', 'cell', 'json', 'stream'] as const;

    it.each(validValues)('accepts %s', (value) => {
      const result = Schema.decodeUnknownSync(PortDataType)(value);
      expect(result).toBe(value);
    });
  });

  // ===========================================================================
  // LinkPort TaggedClass
  // ===========================================================================

  describe('LinkPort', () => {
    const validPort = {
      _tag: 'LinkPort',
      id: 'port-1',
      blockId: 'block-1',
      direction: 'in',
      dataType: 'table',
      position: 'left',
    };

    it('creates valid LinkPort instance', () => {
      const port = new LinkPort({
        id: 'port-1' as PortId,
        blockId: 'block-1' as BlockId,
        direction: 'in',
        dataType: 'table',
        position: 'left',
      });

      expect(port._tag).toBe('LinkPort');
      expect(port.id).toBe('port-1');
      expect(port.blockId).toBe('block-1');
      expect(port.direction).toBe('in');
    });

    it('decodes from plain object', () => {
      const port = Schema.decodeUnknownSync(LinkPort)(validPort);
      expect(port._tag).toBe('LinkPort');
      expect(port.id).toBe('port-1');
    });

    it('encodes to plain object', () => {
      const port = new LinkPort({
        id: 'port-1' as PortId,
        blockId: 'block-1' as BlockId,
        direction: 'out',
        dataType: 'json',
        position: 'right',
      });

      const encoded = Schema.encodeSync(LinkPort)(port);
      expect(encoded._tag).toBe('LinkPort');
      expect(encoded.id).toBe('port-1');
    });

    it('computes acceptsInput correctly', () => {
      const inPort = new LinkPort({
        id: 'p1' as PortId,
        blockId: 'b1' as BlockId,
        direction: 'in',
        dataType: 'table',
        position: 'left',
      });

      const outPort = new LinkPort({
        id: 'p2' as PortId,
        blockId: 'b1' as BlockId,
        direction: 'out',
        dataType: 'table',
        position: 'right',
      });

      const inoutPort = new LinkPort({
        id: 'p3' as PortId,
        blockId: 'b1' as BlockId,
        direction: 'inout',
        dataType: 'table',
        position: 'top',
      });

      expect(inPort.acceptsInput).toBe(true);
      expect(outPort.acceptsInput).toBe(false);
      expect(inoutPort.acceptsInput).toBe(true);
    });

    it('computes producesOutput correctly', () => {
      const inPort = new LinkPort({
        id: 'p1' as PortId,
        blockId: 'b1' as BlockId,
        direction: 'in',
        dataType: 'table',
        position: 'left',
      });

      const outPort = new LinkPort({
        id: 'p2' as PortId,
        blockId: 'b1' as BlockId,
        direction: 'out',
        dataType: 'table',
        position: 'right',
      });

      expect(inPort.producesOutput).toBe(false);
      expect(outPort.producesOutput).toBe(true);
    });

    it('handles optional fields', () => {
      const port = new LinkPort({
        id: 'p1' as PortId,
        blockId: 'b1' as BlockId,
        direction: 'in',
        dataType: 'table',
        position: 'left',
        label: 'Data Input',
        parentBlockId: 'parent-block' as BlockId,
      });

      expect(port.label).toBe('Data Input');
      expect(port.parentBlockId).toBe('parent-block');
    });
  });

  // ===========================================================================
  // Link TaggedClass
  // ===========================================================================

  describe('Link', () => {
    const now = new Date();

    it('creates valid Link instance', () => {
      const link = new Link({
        id: 'link-1' as LinkId,
        sourcePort: 'port-1' as PortId,
        targetPort: 'port-2' as PortId,
        direction: 'unidirectional',
        relationship: 'pipe',
        createdAt: now,
      });

      expect(link._tag).toBe('Link');
      expect(link.id).toBe('link-1');
      expect(link.sourcePort).toBe('port-1');
      expect(link.targetPort).toBe('port-2');
      expect(link.direction).toBe('unidirectional');
      expect(link.relationship).toBe('pipe');
    });

    it('computes isBidirectional correctly', () => {
      const uniLink = new Link({
        id: 'l1' as LinkId,
        sourcePort: 'p1' as PortId,
        targetPort: 'p2' as PortId,
        direction: 'unidirectional',
        relationship: 'pipe',
        createdAt: now,
      });

      const biLink = new Link({
        id: 'l2' as LinkId,
        sourcePort: 'p1' as PortId,
        targetPort: 'p2' as PortId,
        direction: 'bidirectional',
        relationship: 'sync',
        createdAt: now,
      });

      expect(uniLink.isBidirectional).toBe(false);
      expect(biLink.isBidirectional).toBe(true);
    });

    it('computes hasTransform correctly', () => {
      const noTransform = new Link({
        id: 'l1' as LinkId,
        sourcePort: 'p1' as PortId,
        targetPort: 'p2' as PortId,
        direction: 'unidirectional',
        relationship: 'mirror',
        createdAt: now,
      });

      const withTransform = new Link({
        id: 'l2' as LinkId,
        sourcePort: 'p1' as PortId,
        targetPort: 'p2' as PortId,
        direction: 'unidirectional',
        relationship: 'pipe',
        transform: '(row) => row.value > 10',
        createdAt: now,
      });

      expect(noTransform.hasTransform).toBe(false);
      expect(withTransform.hasTransform).toBe(true);
    });

    it('encodes/decodes with Date', () => {
      const link = new Link({
        id: 'l1' as LinkId,
        sourcePort: 'p1' as PortId,
        targetPort: 'p2' as PortId,
        direction: 'unidirectional',
        relationship: 'pipe',
        createdAt: now,
      });

      const encoded = Schema.encodeSync(Link)(link);
      const decoded = Schema.decodeUnknownSync(Link)(encoded);

      expect(decoded.createdAt.getTime()).toBe(now.getTime());
    });
  });

  // ===========================================================================
  // Plane TaggedClass
  // ===========================================================================

  describe('Plane', () => {
    const now = new Date();

    it('creates valid Plane instance', () => {
      const plane = new Plane({
        id: 'plane-1' as PlaneId,
        name: 'Main Bus',
        parentPlaneId: null,
        portIds: ['port-1' as PortId, 'port-2' as PortId],
        createdAt: now,
      });

      expect(plane._tag).toBe('Plane');
      expect(plane.id).toBe('plane-1');
      expect(plane.name).toBe('Main Bus');
      expect(plane.portIds).toHaveLength(2);
    });

    it('computes isNested correctly', () => {
      const rootPlane = new Plane({
        id: 'p1' as PlaneId,
        name: 'Root',
        parentPlaneId: null,
        portIds: [],
        createdAt: now,
      });

      const nestedPlane = new Plane({
        id: 'p2' as PlaneId,
        name: 'Nested',
        parentPlaneId: 'p1' as PlaneId,
        portIds: [],
        createdAt: now,
      });

      expect(rootPlane.isNested).toBe(false);
      expect(nestedPlane.isNested).toBe(true);
    });

    it('computes hasPorts correctly', () => {
      const emptyPlane = new Plane({
        id: 'p1' as PlaneId,
        name: 'Empty',
        parentPlaneId: null,
        portIds: [],
        createdAt: now,
      });

      const populatedPlane = new Plane({
        id: 'p2' as PlaneId,
        name: 'Populated',
        parentPlaneId: null,
        portIds: ['port-1' as PortId],
        createdAt: now,
      });

      expect(emptyPlane.hasPorts).toBe(false);
      expect(populatedPlane.hasPorts).toBe(true);
    });

    it('computes memberCount correctly', () => {
      const plane = new Plane({
        id: 'p1' as PlaneId,
        name: 'Test',
        parentPlaneId: null,
        portIds: ['p1' as PortId, 'p2' as PortId, 'p3' as PortId],
        createdAt: now,
      });

      expect(plane.memberCount).toBe(3);
    });
  });

  // ===========================================================================
  // Config Schemas
  // ===========================================================================

  describe('CreateLinkConfig', () => {
    it('decodes valid config', () => {
      const config = Schema.decodeUnknownSync(CreateLinkConfig)({
        sourcePort: 'port-1',
        targetPort: 'port-2',
        direction: 'unidirectional',
        relationship: 'pipe',
      });

      expect(config.sourcePort).toBe('port-1');
      expect(config.relationship).toBe('pipe');
    });

    it('handles optional transform', () => {
      const config = Schema.decodeUnknownSync(CreateLinkConfig)({
        sourcePort: 'port-1',
        targetPort: 'port-2',
        direction: 'unidirectional',
        relationship: 'pipe',
        transform: 'SELECT value WHERE value > 0',
      });

      expect(config.transform).toBe('SELECT value WHERE value > 0');
    });
  });

  describe('CreatePortConfig', () => {
    it('decodes valid config', () => {
      const config = Schema.decodeUnknownSync(CreatePortConfig)({
        blockId: 'block-1',
        direction: 'in',
        dataType: 'table',
        position: 'left',
      });

      expect(config.blockId).toBe('block-1');
      expect(config.direction).toBe('in');
    });
  });

  describe('CreatePlaneConfig', () => {
    it('decodes valid config', () => {
      const config = Schema.decodeUnknownSync(CreatePlaneConfig)({
        name: 'My Plane',
      });

      expect(config.name).toBe('My Plane');
    });

    it('rejects empty name', () => {
      expect(() =>
        Schema.decodeUnknownSync(CreatePlaneConfig)({
          name: '',
        })
      ).toThrow();
    });

    it('handles optional parentPlaneId', () => {
      const config = Schema.decodeUnknownSync(CreatePlaneConfig)({
        name: 'Nested Plane',
        parentPlaneId: 'parent-plane',
      });

      expect(config.parentPlaneId).toBe('parent-plane');
    });
  });
});
