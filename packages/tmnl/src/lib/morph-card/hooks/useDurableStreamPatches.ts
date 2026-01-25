/**
 * useDurableStreamPatches Hook
 *
 * Effect-native hook for consuming patches from a durable stream
 * and applying them to UITree state via the Differ system.
 *
 * Pattern:
 * - Stream → Differ.patch → Atom update → React re-render
 * - Effect Scope for resource cleanup (SSE connection)
 * - Compositional tree patching via UITreeDiffer
 *
 * @module morph-card/hooks/useDurableStreamPatches
 */

import { useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RegistryContext, useAtomValue } from '@effect-atom/atom-react';
import { Effect, Exit, Scope, Schema, Fiber } from 'effect';
import type { CardId } from '../schemas/card-state';
import { MorphPatch, type JsonPatch } from '../schemas/patch-protocol';
import { applyJsonPatches } from '../differ/UITreeDiffer';
import { uiTreeAtomFamily } from '../atoms';
import type { UITree } from '@/lib/json-render/core/schemas';

// =============================================================================
// Constants
// =============================================================================

/**
 * Durable stream server base URL.
 * Must match port in scripts/durable-streams-server.ts (default: 4437)
 */
const DURABLE_STREAM_BASE = 'http://localhost:4437/v1/stream';

// =============================================================================
// Types
// =============================================================================

export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'error';

export interface UseDurableStreamPatchesResult {
  /** Current UITree state */
  tree: UITree;
  /** Subscribe to a durable stream for this card */
  subscribe: () => void;
  /** Unsubscribe from the stream */
  unsubscribe: () => void;
  /** Apply a local patch (not pushed to stream) */
  applyLocalPatch: (patch: MorphPatch) => void;
  /** Apply JSON patches directly */
  applyJsonPatches: (patches: JsonPatch[]) => void;
  /** Current subscription status */
  status: StreamStatus;
  /** Last error (if any) */
  error: string | undefined;
  /** Last patch sequence number received */
  lastSeq: number | undefined;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Effect-native hook for consuming patches from durable stream
 *
 * Uses:
 * - Effect Scope for resource cleanup (SSE connection)
 * - Effect Differ for compositional tree patching
 * - Registry sync mutations (ctx.set pattern)
 *
 * Pattern matches useGenerativeMode for consistency.
 *
 * @param cardId - The card identifier
 * @param userId - User ID for durable stream namespace
 * @returns Durable stream controls and state
 *
 * @example
 * ```tsx
 * function PatchedCard({ cardId, userId }: { cardId: CardId; userId: string }) {
 *   const { tree, status, subscribe, error } = useDurableStreamPatches(cardId, userId);
 *
 *   useEffect(() => {
 *     subscribe();
 *     return () => unsubscribe();
 *   }, []);
 *
 *   if (status === 'error') return <ErrorState message={error} />;
 *   return <UITreeRenderer tree={tree} />;
 * }
 * ```
 */
export function useDurableStreamPatches(
  cardId: CardId,
  userId: string
): UseDurableStreamPatchesResult {
  const registry = useContext(RegistryContext);
  const treeAtom = useMemo(() => uiTreeAtomFamily(cardId), [cardId]);
  const tree = useAtomValue(treeAtom);

  // Status tracking via React state (for re-renders)
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [error, setError] = useState<string | undefined>(undefined);
  const [lastSeq, setLastSeq] = useState<number | undefined>(undefined);

  // Scope ref for Effect-based cleanup
  const scopeRef = useRef<Scope.CloseableScope | null>(null);
  // Fiber ref for running stream
  const fiberRef = useRef<Fiber.RuntimeFiber<void, Error> | null>(null);

  // Cleanup scope on unmount
  useEffect(() => {
    return () => {
      if (scopeRef.current) {
        Effect.runFork(Scope.close(scopeRef.current, Exit.void));
        scopeRef.current = null;
      }
      if (fiberRef.current) {
        Effect.runFork(Fiber.interrupt(fiberRef.current));
        fiberRef.current = null;
      }
    };
  }, []);

  /**
   * Apply patches using Differ pattern
   * Converts JSON Patches → UITreePatch → apply via Differ.patch
   */
  const applyPatchesWithDiffer = useCallback(
    (morphPatch: MorphPatch) => {
      const currentTree = registry.get(treeAtom);
      const newTree = applyJsonPatches(morphPatch.patches, currentTree);
      registry.set(treeAtom, newTree);

      // Track sequence number
      if (morphPatch.metadata.seq !== undefined) {
        setLastSeq(morphPatch.metadata.seq);
      }
    },
    [registry, treeAtom]
  );

  /**
   * Apply JSON patches directly (convenience method)
   */
  const applyJsonPatchesDirect = useCallback(
    (patches: JsonPatch[]) => {
      const currentTree = registry.get(treeAtom);
      const newTree = applyJsonPatches(patches, currentTree);
      registry.set(treeAtom, newTree);
    },
    [registry, treeAtom]
  );

  /**
   * Subscribe to durable stream
   * Uses Effect.acquireRelease for SSE connection lifecycle
   */
  const subscribe = useCallback(() => {
    if (status === 'streaming') return;

    // Close any previous scope
    if (scopeRef.current) {
      Effect.runFork(Scope.close(scopeRef.current, Exit.void));
    }
    if (fiberRef.current) {
      Effect.runFork(Fiber.interrupt(fiberRef.current));
    }

    // Create new scope
    const scope = Effect.runSync(Scope.make());
    scopeRef.current = scope;
    setStatus('connecting');
    setError(undefined);

    const streamEffect = Effect.gen(function* () {
      const streamUrl = `${DURABLE_STREAM_BASE}/${userId}/${cardId}`;

      // Acquire SSE connection with automatic cleanup
      const { reader, decoder } = yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: async () => {
            const response = await fetch(`${streamUrl}?live=sse&offset=-1`);
            if (!response.ok || !response.body) {
              throw new Error(`HTTP ${response.status}`);
            }
            return {
              reader: response.body.getReader(),
              decoder: new TextDecoder(),
            };
          },
          catch: (e) => e as Error,
        }),
        ({ reader }) => Effect.sync(() => reader.cancel())
      );

      setStatus('streaming');
      let buffer = '';

      // Process SSE stream
      while (true) {
        const result = yield* Effect.tryPromise({
          try: () => reader.read(),
          catch: (e) => e as Error,
        });

        if (result.done) break;

        buffer += decoder.decode(result.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const morphPatch = Schema.decodeUnknownSync(MorphPatch)(parsed);

            // Apply using Differ pattern
            applyPatchesWithDiffer(morphPatch);
          } catch (e) {
            console.error('[useDurableStreamPatches] Parse error:', e);
          }
        }
      }
    });

    // Run with scope context
    const fiber = Effect.runFork(
      streamEffect.pipe(
        Effect.provide(Scope.Scope.context(scope)),
        Effect.catchAll((err) =>
          Effect.sync(() => {
            setStatus('error');
            setError(err instanceof Error ? err.message : 'Stream error');
          })
        )
      )
    );
    fiberRef.current = fiber;
  }, [cardId, userId, applyPatchesWithDiffer, status]);

  /**
   * Unsubscribe from stream
   */
  const unsubscribe = useCallback(() => {
    if (scopeRef.current) {
      Effect.runFork(Scope.close(scopeRef.current, Exit.void));
      scopeRef.current = null;
    }
    if (fiberRef.current) {
      Effect.runFork(Fiber.interrupt(fiberRef.current));
      fiberRef.current = null;
    }
    setStatus('idle');
  }, []);

  /**
   * Apply local patch (for optimistic updates)
   */
  const applyLocalPatch = useCallback(
    (patch: MorphPatch) => {
      applyPatchesWithDiffer(patch);
    },
    [applyPatchesWithDiffer]
  );

  return {
    tree,
    subscribe,
    unsubscribe,
    applyLocalPatch,
    applyJsonPatches: applyJsonPatchesDirect,
    status,
    error,
    lastSeq,
  };
}

export default useDurableStreamPatches;
