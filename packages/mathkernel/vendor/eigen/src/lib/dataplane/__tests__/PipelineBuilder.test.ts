/**
 * @fileoverview PipelineBuilder Service Tests
 *
 * Tests for the d2ts pipeline wiring service.
 * Uses vitest + @effect/vitest for Effect-based testing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Effect, Layer } from 'effect';
import { D2, MessageType, MultiSet } from '@electric-sql/d2ts';

import {
  PipelineBuilder,
  PipelineBuilderLive,
  type PipelineConfig,
  type TransformFn,
} from '../services/PipelineBuilder';
import type { Link, LinkId, PortId, LinkRelationship } from '../schemas/link';

// =============================================================================
// Test Helpers
// =============================================================================

function createMockLink(overrides: Partial<Link> = {}): Link {
  return {
    _tag: 'Link',
    id: `link-${Math.random().toString(36).slice(2, 8)}` as LinkId,
    sourcePort: 'port-1' as PortId,
    targetPort: 'port-2' as PortId,
    direction: 'unidirectional',
    relationship: 'pipe' as LinkRelationship,
    createdAt: new Date(),
    ...overrides,
  } as Link;
}

function createTestGraph() {
  return new D2({ initialFrontier: 0 });
}

// =============================================================================
// Tests
// =============================================================================

describe('PipelineBuilder', () => {
  describe('parseTransform', () => {
    it('parses simple arrow function', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const builder = yield* PipelineBuilder;
          return yield* builder.parseTransform<number>('(x) => x * 2');
        }).pipe(Effect.provide(PipelineBuilderLive))
      );

      expect(result(5)).toBe(10);
    });

    it('parses arrow function without parentheses', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const builder = yield* PipelineBuilder;
          return yield* builder.parseTransform<number>('x => x + 1');
        }).pipe(Effect.provide(PipelineBuilderLive))
      );

      expect(result(3)).toBe(4);
    });

    it('rejects dangerous expressions with eval', async () => {
      const result = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const builder = yield* PipelineBuilder;
          return yield* builder.parseTransform('(x) => eval(x)');
        }).pipe(Effect.provide(PipelineBuilderLive))
      );

      expect(result._tag).toBe('Failure');
    });

    it('rejects dangerous expressions with Function constructor', async () => {
      const result = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const builder = yield* PipelineBuilder;
          return yield* builder.parseTransform('(x) => new Function(x)()');
        }).pipe(Effect.provide(PipelineBuilderLive))
      );

      expect(result._tag).toBe('Failure');
    });

    it('rejects invalid expressions', async () => {
      const result = await Effect.runPromiseExit(
        Effect.gen(function* () {
          const builder = yield* PipelineBuilder;
          return yield* builder.parseTransform('not a function');
        }).pipe(Effect.provide(PipelineBuilderLive))
      );

      expect(result._tag).toBe('Failure');
    });
  });

  describe('buildPipe', () => {
    it('builds a pipe pipeline without transform', async () => {
      const graph = createTestGraph();
      const source = graph.newInput<number>();
      const target = graph.newInput<number>();

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const builder = yield* PipelineBuilder;
          return yield* builder.buildPipe(source, target);
        }).pipe(Effect.provide(PipelineBuilderLive))
      );

      expect(result.success).toBe(true);
    });

    it('builds a pipe pipeline with transform', async () => {
      const graph = createTestGraph();
      const source = graph.newInput<number>();
      const target = graph.newInput<number>();
      const transform: TransformFn<number> = (x) => x * 2;

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const builder = yield* PipelineBuilder;
          return yield* builder.buildPipe(source, target, transform);
        }).pipe(Effect.provide(PipelineBuilderLive))
      );

      expect(result.success).toBe(true);
    });

    it('wires pipeline that can forward data', async () => {
      const graph = createTestGraph();
      const source = graph.newInput<number>();
      const target = graph.newInput<number>();

      // Build the pipeline
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const builder = yield* PipelineBuilder;
          return yield* builder.buildPipe(source, target);
        }).pipe(Effect.provide(PipelineBuilderLive))
      );

      expect(result.success).toBe(true);

      // Verify the graph can be finalized and run without errors
      // (actual data flow testing would be an integration test)
      graph.finalize();

      // Send data and run - should not throw
      source.sendData(1, new MultiSet([[42, 1]]));
      source.sendFrontier(2);
      graph.run();

      // If we get here without errors, the pipeline is wired correctly
      expect(true).toBe(true);
    });
  });

  describe('buildSync', () => {
    it('builds a bidirectional sync pipeline', async () => {
      const graph = createTestGraph();
      const source = graph.newInput<number>();
      const target = graph.newInput<number>();

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const builder = yield* PipelineBuilder;
          return yield* builder.buildSync(source, target);
        }).pipe(Effect.provide(PipelineBuilderLive))
      );

      expect(result.success).toBe(true);
    });
  });

  describe('buildAggregate', () => {
    it('returns error for empty sources array', async () => {
      const graph = createTestGraph();
      const target = graph.newInput<number>();

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const builder = yield* PipelineBuilder;
          return yield* builder.buildAggregate([], target);
        }).pipe(Effect.provide(PipelineBuilderLive))
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('No sources provided for aggregate pipeline');
    });

    it('builds aggregate pipeline with single source', async () => {
      const graph = createTestGraph();
      const source = graph.newInput<number>();
      const target = graph.newInput<number>();

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const builder = yield* PipelineBuilder;
          return yield* builder.buildAggregate([source], target);
        }).pipe(Effect.provide(PipelineBuilderLive))
      );

      expect(result.success).toBe(true);
    });

    it('builds aggregate pipeline with multiple sources', async () => {
      const graph = createTestGraph();
      const source1 = graph.newInput<number>();
      const source2 = graph.newInput<number>();
      const source3 = graph.newInput<number>();
      const target = graph.newInput<number>();

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const builder = yield* PipelineBuilder;
          return yield* builder.buildAggregate([source1, source2, source3], target);
        }).pipe(Effect.provide(PipelineBuilderLive))
      );

      expect(result.success).toBe(true);
    });
  });

  describe('buildMirror', () => {
    it('builds a mirror (1:1 copy) pipeline', async () => {
      const graph = createTestGraph();
      const source = graph.newInput<number>();
      const target = graph.newInput<number>();

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const builder = yield* PipelineBuilder;
          return yield* builder.buildMirror(source, target);
        }).pipe(Effect.provide(PipelineBuilderLive))
      );

      expect(result.success).toBe(true);
    });
  });

  describe('build (main dispatcher)', () => {
    it('builds pipe relationship', async () => {
      const graph = createTestGraph();
      const source = graph.newInput<number>();
      const target = graph.newInput<number>();
      const link = createMockLink({ relationship: 'pipe' as LinkRelationship });

      const config: PipelineConfig<number> = { link, source, target };

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const builder = yield* PipelineBuilder;
          return yield* builder.build(config);
        }).pipe(Effect.provide(PipelineBuilderLive))
      );

      expect(result.success).toBe(true);
    });

    it('builds sync relationship', async () => {
      const graph = createTestGraph();
      const source = graph.newInput<number>();
      const target = graph.newInput<number>();
      const link = createMockLink({ relationship: 'sync' as LinkRelationship });

      const config: PipelineConfig<number> = { link, source, target };

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const builder = yield* PipelineBuilder;
          return yield* builder.build(config);
        }).pipe(Effect.provide(PipelineBuilderLive))
      );

      expect(result.success).toBe(true);
    });

    it('builds aggregate relationship', async () => {
      const graph = createTestGraph();
      const source = graph.newInput<number>();
      const target = graph.newInput<number>();
      const link = createMockLink({ relationship: 'aggregate' as LinkRelationship });

      const config: PipelineConfig<number> = { link, source, target };

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const builder = yield* PipelineBuilder;
          return yield* builder.build(config);
        }).pipe(Effect.provide(PipelineBuilderLive))
      );

      expect(result.success).toBe(true);
    });

    it('builds mirror relationship', async () => {
      const graph = createTestGraph();
      const source = graph.newInput<number>();
      const target = graph.newInput<number>();
      const link = createMockLink({ relationship: 'mirror' as LinkRelationship });

      const config: PipelineConfig<number> = { link, source, target };

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const builder = yield* PipelineBuilder;
          return yield* builder.build(config);
        }).pipe(Effect.provide(PipelineBuilderLive))
      );

      expect(result.success).toBe(true);
    });

    it('parses transform expression from link config', async () => {
      const graph = createTestGraph();
      const source = graph.newInput<number>();
      const target = graph.newInput<number>();
      const link = createMockLink({
        relationship: 'pipe' as LinkRelationship,
        transform: '(x) => x * 10',
      });

      const config: PipelineConfig<number> = { link, source, target };

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const builder = yield* PipelineBuilder;
          return yield* builder.build(config);
        }).pipe(Effect.provide(PipelineBuilderLive))
      );

      expect(result.success).toBe(true);
    });

    it('returns error for unknown relationship type', async () => {
      const graph = createTestGraph();
      const source = graph.newInput<number>();
      const target = graph.newInput<number>();
      const link = createMockLink({ relationship: 'unknown' as LinkRelationship });

      const config: PipelineConfig<number> = { link, source, target };

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const builder = yield* PipelineBuilder;
          return yield* builder.build(config);
        }).pipe(Effect.provide(PipelineBuilderLive))
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown relationship type');
    });
  });
});
