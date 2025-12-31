/**
 * DurableBlockStream Tests
 *
 * Tests for the block stream service - both local in-memory and schema validation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Effect, Layer, Schema, pipe } from 'effect';
import {
  DurableBlockStream,
  DurableBlockStreamLive,
  BlockCreated,
  BlockUpdated,
  BlockDeleted,
  BlockSelectionChanged,
  BlockFocusModeChanged,
  BlockEvent,
  BlockState,
  BlockStateSnapshot,
} from '../services/DurableBlockStream';

describe('DurableBlockStream', () => {
  describe('Block Event Schemas', () => {
    it('should decode BlockCreated event', () => {
      const event = {
        _tag: 'BlockCreated',
        blockId: 'block-123',
        blockTypeName: 'text',
        attributes: { content: 'Hello' },
        timestamp: Date.now(),
      };
      const result = Schema.decodeUnknownSync(BlockCreated)(event);
      expect(result._tag).toBe('BlockCreated');
      expect(result.blockId).toBe('block-123');
      expect(result.blockTypeName).toBe('text');
    });

    it('should decode BlockUpdated event', () => {
      const event = {
        _tag: 'BlockUpdated',
        blockId: 'block-123',
        key: 'content',
        value: 'Updated content',
        timestamp: Date.now(),
      };
      const result = Schema.decodeUnknownSync(BlockUpdated)(event);
      expect(result._tag).toBe('BlockUpdated');
      expect(result.key).toBe('content');
    });

    it('should decode BlockDeleted event', () => {
      const event = {
        _tag: 'BlockDeleted',
        blockId: 'block-123',
        timestamp: Date.now(),
      };
      const result = Schema.decodeUnknownSync(BlockDeleted)(event);
      expect(result._tag).toBe('BlockDeleted');
    });

    it('should decode BlockSelectionChanged event', () => {
      const event = {
        _tag: 'BlockSelectionChanged',
        blockId: 'block-123',
        selected: true,
        timestamp: Date.now(),
      };
      const result = Schema.decodeUnknownSync(BlockSelectionChanged)(event);
      expect(result._tag).toBe('BlockSelectionChanged');
      expect(result.selected).toBe(true);
    });

    it('should decode BlockFocusModeChanged event', () => {
      const event = {
        _tag: 'BlockFocusModeChanged',
        blockId: 'block-123',
        isFocusMode: true,
        timestamp: Date.now(),
      };
      const result = Schema.decodeUnknownSync(BlockFocusModeChanged)(event);
      expect(result._tag).toBe('BlockFocusModeChanged');
      expect(result.isFocusMode).toBe(true);
    });

    it('should decode BlockFocusModeChanged with null blockId', () => {
      const event = {
        _tag: 'BlockFocusModeChanged',
        blockId: null,
        isFocusMode: false,
        timestamp: Date.now(),
      };
      const result = Schema.decodeUnknownSync(BlockFocusModeChanged)(event);
      expect(result.blockId).toBeNull();
    });

    it('should decode BlockEvent union', () => {
      const events = [
        { _tag: 'BlockCreated', blockId: 'b1', blockTypeName: 'text', attributes: {}, timestamp: 1 },
        { _tag: 'BlockUpdated', blockId: 'b1', key: 'x', value: 1, timestamp: 2 },
        { _tag: 'BlockDeleted', blockId: 'b1', timestamp: 3 },
      ];

      for (const event of events) {
        const result = Schema.decodeUnknownSync(BlockEvent)(event);
        expect(result._tag).toBe(event._tag);
      }
    });
  });

  describe('BlockState Schema', () => {
    it('should decode BlockState', () => {
      const state = {
        blockId: 'block-123',
        blockTypeName: 'text',
        attributes: { content: 'Hello' },
        selected: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const result = Schema.decodeUnknownSync(BlockState)(state);
      expect(result.blockId).toBe('block-123');
      expect(result.selected).toBe(false);
    });
  });

  describe('BlockStateSnapshot Schema', () => {
    it('should decode empty snapshot', () => {
      const snapshot = {
        blocks: {},
        focusedBlockId: null,
        isFocusMode: false,
        sequence: 0,
        timestamp: Date.now(),
      };
      const result = Schema.decodeUnknownSync(BlockStateSnapshot)(snapshot);
      expect(result.sequence).toBe(0);
      expect(Object.keys(result.blocks)).toHaveLength(0);
    });

    it('should decode snapshot with blocks', () => {
      const now = Date.now();
      const snapshot = {
        blocks: {
          'block-1': {
            blockId: 'block-1',
            blockTypeName: 'text',
            attributes: {},
            selected: false,
            createdAt: now,
            updatedAt: now,
          },
        },
        focusedBlockId: 'block-1',
        isFocusMode: true,
        sequence: 5,
        timestamp: now,
      };
      const result = Schema.decodeUnknownSync(BlockStateSnapshot)(snapshot);
      expect(result.sequence).toBe(5);
      expect(result.focusedBlockId).toBe('block-1');
      expect(result.isFocusMode).toBe(true);
    });
  });

  describe('DurableBlockStreamLive (In-Memory)', () => {
    const runWithService = <A, E>(
      effect: Effect.Effect<A, E, DurableBlockStream>
    ): Promise<A> =>
      Effect.runPromise(pipe(effect, Effect.provide(DurableBlockStreamLive)));

    it('should start with empty snapshot', async () => {
      const result = await runWithService(
        Effect.gen(function* () {
          const stream = yield* DurableBlockStream;
          return yield* stream.getSnapshot;
        })
      );

      expect(result.sequence).toBe(0);
      expect(Object.keys(result.blocks)).toHaveLength(0);
      expect(result.focusedBlockId).toBeNull();
      expect(result.isFocusMode).toBe(false);
    });

    it('should publish and apply BlockCreated event', async () => {
      const result = await runWithService(
        Effect.gen(function* () {
          const stream = yield* DurableBlockStream;

          yield* stream.publish({
            _tag: 'BlockCreated',
            blockId: 'block-1',
            blockTypeName: 'text',
            attributes: { content: 'Hello' },
            timestamp: Date.now(),
          });

          return yield* stream.getSnapshot;
        })
      );

      expect(result.sequence).toBe(1);
      expect(Object.keys(result.blocks)).toHaveLength(1);
      expect(result.blocks['block-1']).toBeDefined();
      expect(result.blocks['block-1']!.blockTypeName).toBe('text');
    });

    it('should publish and apply BlockUpdated event', async () => {
      const result = await runWithService(
        Effect.gen(function* () {
          const stream = yield* DurableBlockStream;

          yield* stream.publish({
            _tag: 'BlockCreated',
            blockId: 'block-1',
            blockTypeName: 'text',
            attributes: { content: 'Hello' },
            timestamp: Date.now(),
          });

          yield* stream.publish({
            _tag: 'BlockUpdated',
            blockId: 'block-1',
            key: 'content',
            value: 'Updated',
            timestamp: Date.now(),
          });

          return yield* stream.getSnapshot;
        })
      );

      expect(result.sequence).toBe(2);
      expect(result.blocks['block-1']!.attributes['content']).toBe('Updated');
    });

    it('should publish and apply BlockDeleted event', async () => {
      const result = await runWithService(
        Effect.gen(function* () {
          const stream = yield* DurableBlockStream;

          yield* stream.publish({
            _tag: 'BlockCreated',
            blockId: 'block-1',
            blockTypeName: 'text',
            attributes: {},
            timestamp: Date.now(),
          });

          yield* stream.publish({
            _tag: 'BlockDeleted',
            blockId: 'block-1',
            timestamp: Date.now(),
          });

          return yield* stream.getSnapshot;
        })
      );

      expect(result.sequence).toBe(2);
      expect(Object.keys(result.blocks)).toHaveLength(0);
    });

    it('should handle focus mode', async () => {
      const result = await runWithService(
        Effect.gen(function* () {
          const stream = yield* DurableBlockStream;

          yield* stream.publish({
            _tag: 'BlockCreated',
            blockId: 'block-1',
            blockTypeName: 'text',
            attributes: {},
            timestamp: Date.now(),
          });

          yield* stream.publish({
            _tag: 'BlockFocusModeChanged',
            blockId: 'block-1',
            isFocusMode: true,
            timestamp: Date.now(),
          });

          return yield* stream.getSnapshot;
        })
      );

      expect(result.focusedBlockId).toBe('block-1');
      expect(result.isFocusMode).toBe(true);
    });

    it('should clear focus when focused block is deleted', async () => {
      const result = await runWithService(
        Effect.gen(function* () {
          const stream = yield* DurableBlockStream;

          yield* stream.publish({
            _tag: 'BlockCreated',
            blockId: 'block-1',
            blockTypeName: 'text',
            attributes: {},
            timestamp: Date.now(),
          });

          yield* stream.publish({
            _tag: 'BlockFocusModeChanged',
            blockId: 'block-1',
            isFocusMode: true,
            timestamp: Date.now(),
          });

          yield* stream.publish({
            _tag: 'BlockDeleted',
            blockId: 'block-1',
            timestamp: Date.now(),
          });

          return yield* stream.getSnapshot;
        })
      );

      expect(result.focusedBlockId).toBeNull();
      expect(result.isFocusMode).toBe(false);
    });

    it('should publish batch of events', async () => {
      const result = await runWithService(
        Effect.gen(function* () {
          const stream = yield* DurableBlockStream;

          yield* stream.publishBatch([
            {
              _tag: 'BlockCreated',
              blockId: 'block-1',
              blockTypeName: 'text',
              attributes: {},
              timestamp: Date.now(),
            },
            {
              _tag: 'BlockCreated',
              blockId: 'block-2',
              blockTypeName: 'map',
              attributes: {},
              timestamp: Date.now(),
            },
            {
              _tag: 'BlockCreated',
              blockId: 'block-3',
              blockTypeName: 'scene3d',
              attributes: {},
              timestamp: Date.now(),
            },
          ]);

          return yield* stream.getSnapshot;
        })
      );

      expect(result.sequence).toBe(3);
      expect(Object.keys(result.blocks)).toHaveLength(3);
    });

    it('should get specific block state', async () => {
      const result = await runWithService(
        Effect.gen(function* () {
          const stream = yield* DurableBlockStream;

          yield* stream.publish({
            _tag: 'BlockCreated',
            blockId: 'block-1',
            blockTypeName: 'text',
            attributes: { content: 'Hello' },
            timestamp: Date.now(),
          });

          return yield* stream.getBlockState('block-1');
        })
      );

      expect(result).not.toBeNull();
      expect(result!.blockTypeName).toBe('text');
    });

    it('should return null for non-existent block', async () => {
      const result = await runWithService(
        Effect.gen(function* () {
          const stream = yield* DurableBlockStream;
          return yield* stream.getBlockState('non-existent');
        })
      );

      expect(result).toBeNull();
    });

    it('should get current sequence', async () => {
      const result = await runWithService(
        Effect.gen(function* () {
          const stream = yield* DurableBlockStream;

          yield* stream.publish({
            _tag: 'BlockCreated',
            blockId: 'block-1',
            blockTypeName: 'text',
            attributes: {},
            timestamp: Date.now(),
          });

          yield* stream.publish({
            _tag: 'BlockCreated',
            blockId: 'block-2',
            blockTypeName: 'map',
            attributes: {},
            timestamp: Date.now(),
          });

          return yield* stream.getCurrentSequence;
        })
      );

      expect(result).toBe(2);
    });

    it('should clear all events', async () => {
      const result = await runWithService(
        Effect.gen(function* () {
          const stream = yield* DurableBlockStream;

          yield* stream.publish({
            _tag: 'BlockCreated',
            blockId: 'block-1',
            blockTypeName: 'text',
            attributes: {},
            timestamp: Date.now(),
          });

          yield* stream.clear;

          return yield* stream.getSnapshot;
        })
      );

      expect(result.sequence).toBe(0);
      expect(Object.keys(result.blocks)).toHaveLength(0);
    });
  });
});
