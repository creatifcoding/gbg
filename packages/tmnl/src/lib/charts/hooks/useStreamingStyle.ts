/**
 * useStreamingStyle Hook
 *
 * Effect-native React hook for streaming style updates with progressive confidence.
 * Fetches from chart-style endpoint and parses JSONL stream.
 *
 * Follows the useUIStream Effect pattern:
 * - Effect.gen() for stream processing
 * - Fiber for cancellation (not AbortController)
 * - Option for nullable values
 * - registry.set() for synchronous atom updates
 * - useAtomValue() for reactive subscriptions
 *
 * @module charts/hooks/useStreamingStyle
 */

import { useCallback, useEffect, useContext } from 'react';
import { useAtomValue, RegistryContext, Atom } from '@effect-atom/atom-react';
import { Effect, Fiber, Option, Stream, pipe, Queue, Chunk } from 'effect';
import type { RuntimeFiber } from 'effect/Fiber';

import {
  chartStyleFamily,
  chartIsStreamingFamily,
  chartConfidenceFamily,
} from '../styler/atoms';
import { makeChartStyleId } from '../styler/schemas';
import type { AgentStylePatch } from '../styler/agent';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_API = 'http://localhost:7682/chart-style';

// =============================================================================
// Stream Fiber Atom (per-chart fiber storage)
// =============================================================================

/**
 * Atom family for storing stream fibers per chart.
 * Allows proper cancellation of ongoing streams.
 */
const streamFiberFamily = Atom.family(
  (_chartId: string) => Atom.make<Option.Option<RuntimeFiber<void, Error>>>(Option.none())
);

// =============================================================================
// Types
// =============================================================================

export interface UseStreamingStyleOptions {
  /** Chart ID to stream styles for */
  chartId: string;
}

/**
 * Input for starting a style stream.
 * Maps to ChartStylerAgentInput but only requires what the hook needs.
 */
export interface StreamStyleInput {
  /** User prompt describing desired style */
  prompt: string;
  /** Chart type (Line, Bar, Pie, etc.) */
  chartType: string;
  /** Optional style intent (cyberpunk, minimal, etc.) */
  intent?: string;
  /** Optional data context */
  dataContext?: {
    fields?: string[];
    shape?: string;
    rowCount?: number;
  };
}

export interface UseStreamingStyleResult {
  /** Current streaming state */
  isStreaming: boolean;
  /** Current confidence level (0-1) */
  confidence: number;
  /** Latest patches received */
  patches: readonly AgentStylePatch[];
  /** Final patch when complete */
  finalPatch: Option.Option<AgentStylePatch>;
  /** Error if streaming failed */
  error: Option.Option<Error>;
  /** Start streaming with given input */
  startStream: (input: StreamStyleInput) => void;
  /** Cancel ongoing stream */
  cancelStream: () => void;
}

// =============================================================================
// Patch Atoms (per-chart state)
// =============================================================================

const patchesFamily = Atom.family(
  (_chartId: string) => Atom.make<readonly AgentStylePatch[]>([])
);
const finalPatchFamily = Atom.family(
  (_chartId: string) => Atom.make<Option.Option<AgentStylePatch>>(Option.none())
);
const errorFamily = Atom.family(
  (_chartId: string) => Atom.make<Option.Option<Error>>(Option.none())
);

// =============================================================================
// Stream Processing
// =============================================================================

/**
 * Create a stream of patches from fetch response.
 * Uses Queue-based progressive streaming like useUIStream.
 */
function streamFromChartStyleEndpoint(
  api: string,
  body: Record<string, unknown>,
  signal: AbortSignal
): Effect.Effect<Stream.Stream<AgentStylePatch, Error>, Error> {
  return Effect.gen(function* () {
    // Create queue for progressive emission
    const queue = yield* Queue.unbounded<Chunk.Chunk<AgentStylePatch>>();

    // Fork the fetch/parse operation
    yield* Effect.fork(
      Effect.gen(function* () {
        const response = yield* Effect.tryPromise({
          try: () =>
            fetch(api, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
              signal,
            }),
          catch: (e) => new Error(e instanceof Error ? e.message : String(e)),
        });

        if (!response.ok) {
          yield* Effect.fail(
            new Error(`HTTP ${response.status}: ${response.statusText}`)
          );
        }

        const reader = response.body?.getReader();
        if (!reader) {
          yield* Effect.fail(new Error('No response body'));
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const result = yield* Effect.tryPromise({
            try: () => reader!.read(),
            catch: (e) => new Error(e instanceof Error ? e.message : String(e)),
          });

          if (result.done) break;

          buffer += decoder.decode(result.value, { stream: true });

          // Split on newlines, keep incomplete line in buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          const patches: AgentStylePatch[] = [];
          for (const line of lines) {
            if (!line.trim() || !line.startsWith('{')) continue;
            try {
              patches.push(JSON.parse(line) as AgentStylePatch);
            } catch {
              // Skip parse errors for incomplete JSON
            }
          }

          if (patches.length > 0) {
            yield* Queue.offer(queue, Chunk.fromIterable(patches));
          }
        }

        // Handle remaining buffer
        if (buffer.trim() && buffer.startsWith('{')) {
          try {
            const patch = JSON.parse(buffer) as AgentStylePatch;
            yield* Queue.offer(queue, Chunk.of(patch));
          } catch {
            // Skip
          }
        }

        // Signal completion
        yield* Queue.shutdown(queue);
      }).pipe(
        Effect.catchAll((err) =>
          Effect.gen(function* () {
            yield* Queue.shutdown(queue);
            yield* Effect.fail(err);
          })
        )
      )
    );

    // Return stream from queue
    return Stream.fromQueue(queue).pipe(Stream.flattenChunks);
  });
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Effect-native hook for streaming chart style updates from the LLM agent.
 *
 * Follows the useUIStream pattern:
 * - Effect.gen() for stream processing
 * - Fiber for cancellation
 * - Option for nullable values
 * - registry.set() for sync updates
 *
 * Must be used within ChartStyleRegistryProvider.
 *
 * @example
 * ```tsx
 * const { startStream, isStreaming, confidence, finalPatch } = useStreamingStyle({
 *   chartId: 'my-chart'
 * })
 *
 * // Start streaming
 * startStream({
 *   prompt: 'Style with a cyberpunk theme',
 *   chartType: 'Bar',
 *   intent: 'cyberpunk'
 * })
 *
 * // Watch progress
 * if (isStreaming) {
 *   console.log(`Confidence: ${confidence}`)
 * }
 *
 * // Use final result
 * if (Option.isSome(finalPatch) && finalPatch.value.type === 'complete') {
 *   console.log(finalPatch.value.palette, finalPatch.value.rationale)
 * }
 * ```
 */
export function useStreamingStyle(
  options: UseStreamingStyleOptions
): UseStreamingStyleResult {
  const { chartId } = options;

  // Get registry from context (follows useUIStream pattern)
  const registry = useContext(RegistryContext);

  // Normalize chart ID
  const normalizedId = makeChartStyleId(chartId);

  // Read reactive state via atoms (cast from unknown)
  const isStreaming = useAtomValue(chartIsStreamingFamily(normalizedId)) as boolean;
  const confidence = useAtomValue(chartConfidenceFamily(normalizedId)) as number;
  const patches = useAtomValue(patchesFamily(normalizedId)) as readonly AgentStylePatch[];
  const finalPatch = useAtomValue(finalPatchFamily(normalizedId)) as Option.Option<AgentStylePatch>;
  const error = useAtomValue(errorFamily(normalizedId)) as Option.Option<Error>;

  /**
   * Start streaming styles from chart-style endpoint
   *
   * Uses Effect.gen() for the stream logic and Fiber for cancellation.
   */
  const startStream = useCallback(
    (input: StreamStyleInput) => {
      // Cancel any existing stream via Fiber.interrupt
      const existingFiber = registry.get(
        streamFiberFamily(normalizedId)
      ) as Option.Option<RuntimeFiber<void, Error>>;
      if (Option.isSome(existingFiber)) {
        Effect.runFork(Fiber.interrupt(existingFiber.value));
      }

      // Reset state
      registry.set(patchesFamily(normalizedId), []);
      registry.set(finalPatchFamily(normalizedId), Option.none());
      registry.set(errorFamily(normalizedId), Option.none());
      registry.set(chartIsStreamingFamily(normalizedId), true);
      registry.set(chartConfidenceFamily(normalizedId), 0);

      // Create AbortController for fetch (still needed for fetch API)
      const abortController = new AbortController();

      // Create the stream processing effect
      const streamEffect = Effect.gen(function* () {
        const patchStream = yield* streamFromChartStyleEndpoint(
          DEFAULT_API,
          {
            chartId: normalizedId,
            prompt: input.prompt,
            chartType: input.chartType,
            intent: input.intent,
            dataContext: input.dataContext,
          },
          abortController.signal
        );

        // Process each patch
        yield* pipe(
          patchStream,
          Stream.runForEach((patch) =>
            Effect.gen(function* () {
              // Accumulate patches
              const currentPatches = registry.get(
                patchesFamily(normalizedId)
              ) as readonly AgentStylePatch[];
              registry.set(patchesFamily(normalizedId), [...currentPatches, patch]);

              // Update confidence
              registry.set(chartConfidenceFamily(normalizedId), patch.confidence);

              // Update style state with palette
              if (patch.palette && patch.palette.length > 0) {
                const styleAtom = chartStyleFamily(normalizedId);
                const currentStyle = registry.get(styleAtom);
                registry.set(styleAtom, {
                  ...currentStyle,
                  colorPalette: patch.palette,
                  intent: input.intent ?? null,
                });
              }

              // Handle completion
              if (patch.type === 'complete') {
                registry.set(finalPatchFamily(normalizedId), Option.some(patch));
              }

              // Yield to browser event loop (same pattern as useUIStream)
              yield* Effect.promise(
                () => new Promise<void>((r) => setTimeout(r, 0))
              );
            })
          )
        );
      }).pipe(
        Effect.catchAll((err) =>
          Effect.sync(() => {
            const e = err instanceof Error ? err : new Error(String(err));
            registry.set(errorFamily(normalizedId), Option.some(e));
          })
        ),
        Effect.ensuring(
          Effect.sync(() => {
            registry.set(chartIsStreamingFamily(normalizedId), false);
            registry.set(streamFiberFamily(normalizedId), Option.none());
          })
        )
      );

      // Fork the stream processing
      const fiber = Effect.runFork(streamEffect) as RuntimeFiber<void, Error>;
      registry.set(streamFiberFamily(normalizedId), Option.some(fiber));
    },
    [normalizedId, registry]
  );

  /**
   * Cancel ongoing stream via Fiber.interrupt
   */
  const cancelStream = useCallback(() => {
    const existingFiber = registry.get(
      streamFiberFamily(normalizedId)
    ) as Option.Option<RuntimeFiber<void, Error>>;
    if (Option.isSome(existingFiber)) {
      Effect.runFork(Fiber.interrupt(existingFiber.value));
    }
    registry.set(chartIsStreamingFamily(normalizedId), false);
    registry.set(streamFiberFamily(normalizedId), Option.none());
  }, [normalizedId, registry]);

  // Cleanup on unmount (interrupt any running fiber)
  useEffect(() => {
    return () => {
      const existingFiber = registry.get(
        streamFiberFamily(normalizedId)
      ) as Option.Option<RuntimeFiber<void, Error>>;
      if (Option.isSome(existingFiber)) {
        Effect.runFork(Fiber.interrupt(existingFiber.value));
      }
    };
  }, [normalizedId, registry]);

  return {
    isStreaming,
    confidence,
    patches,
    finalPatch,
    error,
    startStream,
    cancelStream,
  };
}
