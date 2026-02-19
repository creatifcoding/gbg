/**
 * useGenerativeMode Hook
 *
 * Manages generative content per mode with lazy generation and caching.
 *
 * Pattern:
 * - Generate on first visit to a mode
 * - Cache result for subsequent visits
 * - Independent retry per card
 *
 * @module morph-card/hooks/useGenerativeMode
 */

import { useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue, RegistryContext } from '@effect-atom/atom-react';
import { Effect, Exit, Option, Scope, Logger } from 'effect';
import { observable, batch, type ObservableObject } from '@legendapp/state';
import type { CardId, CardMode } from '../schemas/card-state';
import type { GeneratedContent } from '../schemas/generative-state';
import { DEFAULT_MODE_GENERATION } from '../schemas/generative-state';
import { getGenerativeAtoms } from '../atoms/generative-atoms';
import { cardStateFamily } from '../atoms';
import { useGenerativeDepth } from '@/lib/genifer/react';
import type { ObservableUITree } from '@/lib/genifer/react';
import type { UIElement } from '@/lib/genifer';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_API = '/api/ui-generate';

// =============================================================================
// Types
// =============================================================================

/**
 * Return type for useGenerativeMode hook
 */
export interface UseGenerativeModeResult {
  /** Whether generative mode is enabled for this card */
  isEnabled: boolean;
  /** Current mode's generation status */
  status: 'idle' | 'loading' | 'streaming' | 'success' | 'error';
  /** Current mode's streaming progress (0-1) */
  progress: number;
  /** Current mode's generated content (if available) */
  content: Option.Option<GeneratedContent>;
  /** Current mode's error message (if any) */
  error: string | undefined;
  /** Retry generation for current mode */
  retry: () => void;
  /** Manually trigger generation for a specific mode */
  generateForMode: (mode: CardMode) => Promise<void>;
  /**
   * Legend State observable tree for fine-grained reactivity
   * Use with LegendRenderer for optimal streaming performance
   */
  tree$: ObservableObject<ObservableUITree> | null;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook for managing generative content per mode
 *
 * Implements lazy generate + cache pattern:
 * - Generate on first visit to a mode
 * - Cache result for subsequent visits
 * - Independent retry per card
 *
 * @param cardId - The card identifier
 * @returns Generative mode controls and state
 *
 * @example
 * ```tsx
 * function GenerativeCard({ cardId }: { cardId: CardId }) {
 *   const { status, progress, content, retry } = useGenerativeMode(cardId);
 *
 *   if (status === 'loading') return <LoadingSpinner />;
 *   if (status === 'error') return <ErrorState onRetry={retry} />;
 *   if (status === 'success') return <Content data={content} />;
 *   return null;
 * }
 * ```
 */
export function useGenerativeMode(cardId: CardId): UseGenerativeModeResult {
  const registry = useContext(RegistryContext);
  const atoms = useMemo(() => getGenerativeAtoms(cardId), [cardId]);
  const depthContext = useGenerativeDepth();

  const genState = useAtomValue(atoms.state);
  const cardState = useAtomValue(cardStateFamily(cardId));
  const currentMode = cardState.mode;
  const currentModeState = genState.modes[currentMode] ?? DEFAULT_MODE_GENERATION;

  // Track active generation to prevent duplicate triggers
  const generatingModeRef = useRef<CardMode | null>(null);
  // Scope ref for Effect-based cleanup
  const scopeRef = useRef<Scope.CloseableScope | null>(null);
  // Legend State observable tree for fine-grained reactivity
  const tree$Ref = useRef<ObservableObject<ObservableUITree> | null>(null);

  // Cleanup scope on unmount
  useEffect(() => {
    return () => {
      // Close the scope when component unmounts - this aborts any in-flight operations
      if (scopeRef.current) {
        Effect.runFork(Scope.close(scopeRef.current, Exit.void));
        scopeRef.current = null;
      }
    };
  }, []);

  /**
   * Generate content for a specific mode
   * Uses Effect acquireRelease for scoped AbortController cleanup
   */
  const generateForMode = useCallback(async (mode: CardMode) => {
    // Prevent duplicate generation for same mode
    if (generatingModeRef.current === mode) return;

    const currentGenState = registry.get(atoms.state);
    if (!currentGenState.enabled) return;

    // Check cache first
    const modeState = currentGenState.modes[mode] ?? DEFAULT_MODE_GENERATION;
    if (Option.isSome(modeState.content)) {
      return; // Cache hit - no generation needed
    }

    // Mark as generating
    generatingModeRef.current = mode;

    // Close any previous scope (aborts previous generation)
    if (scopeRef.current) {
      await Effect.runPromise(Scope.close(scopeRef.current, Exit.void));
    }

    // Create new scope for this generation
    const scope = Effect.runSync(Scope.make());
    scopeRef.current = scope;

    // Set loading state
    registry.set(atoms.state, {
      ...currentGenState,
      modes: {
        ...currentGenState.modes,
        [mode]: { ...modeState, status: 'loading' as const, progress: 0 },
      },
    });

    // Build the generation Effect with scoped AbortController
    const generateEffect = Effect.gen(function* () {
      // LOGGING: Start generation span
      yield* Effect.log(`[useGenerativeMode] Starting generation for mode: ${mode}`);

      // Acquire AbortController with automatic release on scope close
      const abortController = yield* Effect.acquireRelease(
        Effect.sync(() => new AbortController()),
        (controller) => Effect.sync(() => controller.abort())
      );

      // Interpolate prompt with mode
      const prompt = currentGenState.prompt.replace(/\{\{mode\}\}/g, mode);
      const api = currentGenState.api ?? DEFAULT_API;

      yield* Effect.log(`[useGenerativeMode] Fetching from API: ${api}`);

      const response = yield* Effect.tryPromise({
        try: () => fetch(api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            context: {
              ...currentGenState.context,
              mode,
              _depth: depthContext.depth,
              _maxDepth: depthContext.maxDepth,
            },
          }),
          signal: abortController.signal,
        }),
        catch: (error) => error as Error,
      });

      yield* Effect.log(`[useGenerativeMode] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        yield* Effect.log(`[useGenerativeMode] ERROR: HTTP ${response.status}`);
        return yield* Effect.fail(new Error(`HTTP ${response.status}: ${response.statusText}`));
      }

      const reader = response.body?.getReader();
      if (!reader) {
        yield* Effect.log(`[useGenerativeMode] ERROR: No response body`);
        return yield* Effect.fail(new Error('No response body'));
      }

      // Ensure reader is cancelled on scope close
      yield* Effect.addFinalizer(() => Effect.sync(() => reader.cancel()));

      const decoder = new TextDecoder();
      let buffer = '';
      let root: string | null = null;
      // OPTIMIZATION: Direct mutation instead of O(n²) object spread
      // Benchmark shows 17.6x speedup at 500 elements
      const elements: Record<string, unknown> = {};
      let progress = 0;
      let pendingOps = 0;
      const BATCH_SIZE = 5; // Flush state every N ops for incremental rendering

      // LEGEND STATE: Create observable tree for fine-grained reactivity
      const tree$ = observable<ObservableUITree>({ root: null, elements: {} });
      tree$Ref.current = tree$;

      yield* Effect.log(`[useGenerativeMode] tree$ created, ref set: ${tree$Ref.current !== null}`);

      const flushState = () => {
        // LOGGING: Log flush state
        console.log(`[useGenerativeMode] flushState called`, {
          root,
          elementCount: Object.keys(elements).length,
          elementKeys: Object.keys(elements).slice(0, 5), // First 5 keys
          progress,
          pendingOps,
          tree$RefIsSet: tree$Ref.current !== null,
        });

        // LEGEND STATE: Update observable tree with batched changes
        batch(() => {
          tree$.root.set(root);
          // Spread into observable for fine-grained element updates
          for (const [key, value] of Object.entries(elements)) {
            if (!tree$.elements[key].peek()) {
              // New element - set it
              tree$.elements[key].set(value as UIElement);
            }
          }
        });

        // LOGGING: Log tree$ state after batch
        console.log(`[useGenerativeMode] tree$ after batch`, {
          root: tree$.root.get(),
          elementCount: Object.keys(tree$.elements.get() ?? {}).length,
        });

        const latestState = registry.get(atoms.state);
        registry.set(atoms.state, {
          ...latestState,
          modes: {
            ...latestState.modes,
            [mode]: {
              status: 'streaming' as const,
              // Snapshot elements only when flushing (not on every op)
              content: Option.some({ root, elements: { ...elements }, generatedAt: Date.now() }),
              error: Option.none(),
              progress,
            },
          },
        });
        pendingOps = 0;
      };

      while (true) {
        // Check if aborted before reading
        if (abortController.signal.aborted) {
          return;
        }

        const result = yield* Effect.tryPromise({
          try: () => reader.read(),
          catch: (error) => error as Error,
        });

        if (result.done) break;

        buffer += decoder.decode(result.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const op = JSON.parse(line);
            // Handle JSON Patch operations from UITree stream
            if ((op.op === 'replace' || op.op === 'set') && op.path === '/root') {
              console.log(`[useGenerativeMode] OP: set root = ${op.value}`);
              const wasNull = root === null;
              root = op.value;
              // INCREMENTAL: Flush immediately when root is first set
              // This enables rendering to start ASAP, even before all elements arrive
              if (wasNull && root !== null) {
                console.log(`[useGenerativeMode] Root set - flushing immediately for incremental render`);
                flushState();
              }
            } else if (op.op === 'add' && op.path.startsWith('/elements/')) {
              const key = op.path.replace('/elements/', '');
              // OPTIMIZATION: Direct mutation O(1) instead of spread O(n)
              elements[key] = op.value;
              // Only log first few elements to avoid spam
              if (Object.keys(elements).length <= 3) {
                console.log(`[useGenerativeMode] OP: add element ${key}`, { type: (op.value as any)?.type });
              }
            } else {
              // LOGGING: Unknown op pattern
              console.warn(`[useGenerativeMode] Unknown op pattern:`, op);
            }
            progress = Math.min(progress + 0.05, 0.95);
            pendingOps++;
          } catch (parseError) {
            // LOGGING: Malformed JSON
            console.warn(`[useGenerativeMode] Malformed JSON line:`, line.slice(0, 100), parseError);
          }
        }

        // OPTIMIZATION: Batched state updates for UI responsiveness
        // Don't trigger React reconciliation on every single operation
        if (pendingOps >= BATCH_SIZE) {
          flushState();
        }
      }

      // Final flush if any pending ops
      if (pendingOps > 0) {
        flushState();
      }

      // LOGGING: Final state summary
      yield* Effect.log(`[useGenerativeMode] Generation complete`);
      console.log(`[useGenerativeMode] FINAL STATE:`, {
        root,
        elementCount: Object.keys(elements).length,
        elementTypes: [...new Set(Object.values(elements).map((e: any) => e?.type))],
        tree$RefIsSet: tree$Ref.current !== null,
        tree$Root: tree$Ref.current?.root.get(),
        tree$ElementCount: Object.keys(tree$Ref.current?.elements.get() ?? {}).length,
      });

      // Final success state
      const finalState = registry.get(atoms.state);
      registry.set(atoms.state, {
        ...finalState,
        modes: {
          ...finalState.modes,
          [mode]: {
            status: 'success' as const,
            content: Option.some({ root, elements, generatedAt: Date.now() }),
            error: Option.none(),
            progress: 1,
          },
        },
      });

      yield* Effect.log(`[useGenerativeMode] Atom state updated to 'success'`);
    });

    // Run the effect with error handling
    const result = await Effect.runPromiseExit(
      generateEffect.pipe(Effect.provide(Scope.Scope.context(scope)))
    );

    // Handle errors (but ignore AbortError from cleanup)
    if (result._tag === 'Failure') {
      const error = result.cause;
      // Check if it's an abort error (user navigated away or new generation started)
      const isAbortError = error._tag === 'Fail' &&
        error.error instanceof Error &&
        error.error.name === 'AbortError';

      if (!isAbortError) {
        const message = error._tag === 'Fail' && error.error instanceof Error
          ? error.error.message
          : 'Generation failed';
        const errorState = registry.get(atoms.state);
        registry.set(atoms.state, {
          ...errorState,
          modes: {
            ...errorState.modes,
            [mode]: {
              status: 'error' as const,
              content: Option.none(),
              error: Option.some(message),
              progress: 0,
            },
          },
        });
      }
    }

    // Clear generating flag
    if (generatingModeRef.current === mode) {
      generatingModeRef.current = null;
    }
  }, [atoms.state, registry, depthContext.depth, depthContext.maxDepth]);

  /**
   * Trigger generation when mode changes (lazy)
   * CRITICAL: genState.enabled MUST be in dependencies to re-run
   * when MorphCard's initialization effect sets enabled: true
   */
  useEffect(() => {
    // Early exit if not enabled (wait for MorphCard's init effect)
    if (!genState.enabled) return;

    const modeState = genState.modes[currentMode] ?? DEFAULT_MODE_GENERATION;
    const hasContent = Option.isSome(modeState.content);
    const isIdle = modeState.status === 'idle';

    // Only generate if idle and no cache
    if (isIdle && !hasContent) {
      generateForMode(currentMode);
    }
  }, [currentMode, genState.enabled, genState.modes, generateForMode]);

  /**
   * Retry generation for current mode
   */
  const retry = useCallback(() => {
    // Clear generating ref to allow retry
    generatingModeRef.current = null;

    const currentGenState = registry.get(atoms.state);
    // Clear error state first
    registry.set(atoms.state, {
      ...currentGenState,
      modes: {
        ...currentGenState.modes,
        [currentMode]: {
          ...DEFAULT_MODE_GENERATION,
          status: 'idle' as const,
        },
      },
    });
    // Trigger regeneration
    generateForMode(currentMode);
  }, [currentMode, atoms.state, registry, generateForMode]);

  // LOGGING: Log hook return value on every render
  const returnValue = {
    isEnabled: genState.enabled,
    status: currentModeState.status,
    progress: currentModeState.progress,
    content: currentModeState.content,
    error: Option.isSome(currentModeState.error) ? currentModeState.error.value : undefined,
    retry,
    generateForMode,
    tree$: tree$Ref.current,
  };

  // Log when key values change
  useEffect(() => {
    console.log(`[useGenerativeMode] Hook return value changed:`, {
      cardId,
      mode: currentMode,
      isEnabled: returnValue.isEnabled,
      status: returnValue.status,
      progress: returnValue.progress,
      hasContent: Option.isSome(returnValue.content),
      contentRoot: Option.isSome(returnValue.content) ? returnValue.content.value.root : null,
      contentElementCount: Option.isSome(returnValue.content) ? Object.keys(returnValue.content.value.elements).length : 0,
      hasTree$: returnValue.tree$ !== null,
      tree$Root: returnValue.tree$?.root.get() ?? null,
    });
  }, [cardId, currentMode, returnValue.isEnabled, returnValue.status, returnValue.progress, returnValue.content, returnValue.tree$]);

  return returnValue;
}

export default useGenerativeMode;
