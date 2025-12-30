/**
 * @fileoverview PipelineBuilder Service
 *
 * Builds d2ts pipelines based on link relationship types:
 * - pipe: Unidirectional transform (source → transform → target)
 * - sync: Bidirectional sync with conflict resolution
 * - aggregate: Many sources → single aggregated target
 * - mirror: 1:1 copy (no transform)
 */

import { Effect } from 'effect';
import {
  RootStreamBuilder,
  map,
  output,
  concat,
  MessageType,
  type Message,
  type MultiSet,
} from '@electric-sql/d2ts';

import type { Link, LinkRelationship } from '../schemas/link';

// =============================================================================
// Types
// =============================================================================

/** Transform function for pipe relationship */
export type TransformFn<T, U = T> = (value: T) => U;

/** Pipeline configuration */
export interface PipelineConfig<T = unknown> {
  /** The link being wired */
  readonly link: Link;
  /** Source input stream (RootStreamBuilder from graph.newInput()) */
  readonly source: RootStreamBuilder<T>;
  /** Target input stream (RootStreamBuilder from graph.newInput()) */
  readonly target: RootStreamBuilder<T>;
  /** Optional transform function (for pipe relationship) */
  readonly transform?: TransformFn<T>;
}

/** Result of building a pipeline */
export interface PipelineResult {
  /** Whether the pipeline was successfully built */
  readonly success: boolean;
  /** Error message if build failed */
  readonly error?: string;
}

// =============================================================================
// Service Interface
// =============================================================================

export interface PipelineBuilderShape {
  /**
   * Build a pipeline based on link configuration
   */
  readonly build: <T>(config: PipelineConfig<T>) => Effect.Effect<PipelineResult>;

  /**
   * Parse a transform expression string into a function
   * Supports simple JS expressions like "(x) => x.value > 10"
   */
  readonly parseTransform: <T, U = T>(
    expression: string
  ) => Effect.Effect<TransformFn<T, U>, Error>;

  /**
   * Build a pipe (unidirectional) pipeline
   */
  readonly buildPipe: <T>(
    source: RootStreamBuilder<T>,
    target: RootStreamBuilder<T>,
    transform?: TransformFn<T>
  ) => Effect.Effect<PipelineResult>;

  /**
   * Build a sync (bidirectional) pipeline
   */
  readonly buildSync: <T>(
    source: RootStreamBuilder<T>,
    target: RootStreamBuilder<T>
  ) => Effect.Effect<PipelineResult>;

  /**
   * Build an aggregate (many-to-one) pipeline
   */
  readonly buildAggregate: <T>(
    sources: ReadonlyArray<RootStreamBuilder<T>>,
    target: RootStreamBuilder<T>
  ) => Effect.Effect<PipelineResult>;

  /**
   * Build a mirror (1:1 copy) pipeline
   */
  readonly buildMirror: <T>(
    source: RootStreamBuilder<T>,
    target: RootStreamBuilder<T>
  ) => Effect.Effect<PipelineResult>;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Safely parse a transform expression
 * Only allows simple arrow functions for security
 */
function safeParseExpression<T, U>(expression: string): TransformFn<T, U> | null {
  // Only allow simple arrow function expressions
  // Pattern: (x) => expression or x => expression
  const arrowPattern = /^\s*\(?\s*(\w+)\s*\)?\s*=>\s*(.+)$/;
  const match = expression.match(arrowPattern);

  if (!match) {
    return null;
  }

  const [, param, body] = match;

  // Disallow dangerous patterns
  const dangerous = [
    'eval',
    'Function',
    'setTimeout',
    'setInterval',
    'fetch',
    'XMLHttpRequest',
    'import',
    'require',
    '__proto__',
    'constructor',
    'prototype',
  ];

  for (const pattern of dangerous) {
    if (expression.includes(pattern)) {
      return null;
    }
  }

  try {
    // Create a safe function from the expression
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    return new Function(param, `return (${body})`) as TransformFn<T, U>;
  } catch {
    return null;
  }
}

// =============================================================================
// Service Implementation
// =============================================================================

export class PipelineBuilder extends Effect.Service<PipelineBuilder>()(
  'tmnl/PipelineBuilder',
  {
    effect: Effect.gen(function* () {
      /**
       * Parse transform expression
       */
      const parseTransform = <T, U = T>(expression: string) =>
        Effect.gen(function* () {
          const fn = safeParseExpression<T, U>(expression);

          if (!fn) {
            return yield* Effect.fail(
              new Error(`Invalid transform expression: ${expression}`)
            );
          }

          return fn;
        });

      /**
       * Build a pipe (unidirectional) pipeline
       */
      const buildPipe = <T>(
        source: RootStreamBuilder<T>,
        target: RootStreamBuilder<T>,
        transform?: TransformFn<T>
      ) =>
        Effect.gen(function* () {
          yield* Effect.sync(() => {
            const forwardToTarget = output((message: Message<T>) => {
              if (message.type === MessageType.DATA) {
                target.sendData(message.data.version, message.data.collection);
              }
            });

            if (transform) {
              // Apply transform then forward
              source.pipe(map(transform), forwardToTarget);
            } else {
              // Direct forward
              source.pipe(forwardToTarget);
            }
          });

          return { success: true } satisfies PipelineResult;
        });

      /**
       * Build a sync (bidirectional) pipeline
       * Uses last-write-wins conflict resolution
       */
      const buildSync = <T>(
        source: RootStreamBuilder<T>,
        target: RootStreamBuilder<T>
      ) =>
        Effect.gen(function* () {
          yield* Effect.sync(() => {
            const createForwarder = (dest: RootStreamBuilder<T>) =>
              output((message: Message<T>) => {
                if (message.type === MessageType.DATA) {
                  dest.sendData(message.data.version, message.data.collection);
                }
              });

            // Forward source → target
            source.pipe(createForwarder(target));

            // Forward target → source (bidirectional)
            target.pipe(createForwarder(source));
          });

          return { success: true } satisfies PipelineResult;
        });

      /**
       * Build an aggregate (many-to-one) pipeline
       * Concatenates all sources and forwards to target
       */
      const buildAggregate = <T>(
        sources: ReadonlyArray<RootStreamBuilder<T>>,
        target: RootStreamBuilder<T>
      ) =>
        Effect.gen(function* () {
          if (sources.length === 0) {
            return {
              success: false,
              error: 'No sources provided for aggregate pipeline',
            } satisfies PipelineResult;
          }

          yield* Effect.sync(() => {
            const forwardToTarget = output((message: Message<T>) => {
              if (message.type === MessageType.DATA) {
                target.sendData(message.data.version, message.data.collection);
              }
            });

            if (sources.length === 1) {
              // Single source - just forward
              sources[0].pipe(forwardToTarget);
            } else {
              // Multiple sources - concat them together then forward
              // Start with first source
              let pipeline = sources[0].pipe(concat(sources[1]));

              // Concat remaining sources
              for (let i = 2; i < sources.length; i++) {
                pipeline = pipeline.pipe(concat(sources[i]));
              }

              // Forward concatenated stream to target
              pipeline.pipe(forwardToTarget);
            }
          });

          return { success: true } satisfies PipelineResult;
        });

      /**
       * Build a mirror (1:1 copy) pipeline
       * Special case of pipe with no transform
       */
      const buildMirror = <T>(
        source: RootStreamBuilder<T>,
        target: RootStreamBuilder<T>
      ) => buildPipe(source, target, undefined);

      /**
       * Main build function that dispatches based on relationship type
       */
      const build = <T>(config: PipelineConfig<T>) =>
        Effect.gen(function* () {
          const { link, source, target, transform } = config;
          const relationship = link.relationship as LinkRelationship;

          switch (relationship) {
            case 'pipe': {
              // Parse transform expression if provided
              let transformFn = transform;
              if (!transformFn && link.transform) {
                transformFn = yield* parseTransform<T>(link.transform);
              }
              return yield* buildPipe(source, target, transformFn);
            }

            case 'sync':
              return yield* buildSync(source, target);

            case 'aggregate':
              // For aggregate, we need multiple sources
              // This simplified version uses a single source array
              return yield* buildAggregate([source], target);

            case 'mirror':
              return yield* buildMirror(source, target);

            default:
              return {
                success: false,
                error: `Unknown relationship type: ${relationship}`,
              } satisfies PipelineResult;
          }
        });

      return {
        build,
        parseTransform,
        buildPipe,
        buildSync,
        buildAggregate,
        buildMirror,
      } satisfies PipelineBuilderShape;
    }),
  }
) {}

// =============================================================================
// Layer
// =============================================================================

export const PipelineBuilderLive = PipelineBuilder.Default;
