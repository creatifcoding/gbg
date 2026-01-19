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

import { useContext, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAtomValue, RegistryContext } from '@effect-atom/atom-react';
import { Effect, Exit, Option, Scope } from 'effect';
import type { CardId, CardMode } from '../schemas/card-state';
import type { GeneratedContent } from '../schemas/generative-state';
import { DEFAULT_MODE_GENERATION } from '../schemas/generative-state';
import { getGenerativeAtoms } from '../atoms/generative-atoms';
import { cardStateFamily } from '../atoms';
import { useGenerativeDepth } from '@/lib/json-render/react/generative';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_API = 'http://localhost:7682/ui-generate';

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
      // Acquire AbortController with automatic release on scope close
      const abortController = yield* Effect.acquireRelease(
        Effect.sync(() => new AbortController()),
        (controller) => Effect.sync(() => controller.abort())
      );

      // Interpolate prompt with mode
      const prompt = currentGenState.prompt.replace(/\{\{mode\}\}/g, mode);
      const api = currentGenState.api ?? DEFAULT_API;

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

      if (!response.ok) {
        return yield* Effect.fail(new Error(`HTTP ${response.status}: ${response.statusText}`));
      }

      const reader = response.body?.getReader();
      if (!reader) {
        return yield* Effect.fail(new Error('No response body'));
      }

      // Ensure reader is cancelled on scope close
      yield* Effect.addFinalizer(() => Effect.sync(() => reader.cancel()));

      const decoder = new TextDecoder();
      let buffer = '';
      let root: string | null = null;
      let elements: Record<string, unknown> = {};
      let progress = 0;

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
            if (op.op === 'replace' && op.path === '/root') {
              root = op.value;
            } else if (op.op === 'add' && op.path.startsWith('/elements/')) {
              const key = op.path.replace('/elements/', '');
              elements = { ...elements, [key]: op.value };
            }
            progress = Math.min(progress + 0.05, 0.95);
          } catch {
            // Skip malformed JSON lines
          }
        }

        // Update streaming state
        const latestState = registry.get(atoms.state);
        registry.set(atoms.state, {
          ...latestState,
          modes: {
            ...latestState.modes,
            [mode]: {
              status: 'streaming' as const,
              content: Option.some({ root, elements, generatedAt: Date.now() }),
              error: Option.none(),
              progress,
            },
          },
        });
      }

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

  return {
    isEnabled: genState.enabled,
    status: currentModeState.status,
    progress: currentModeState.progress,
    content: currentModeState.content,
    error: Option.isSome(currentModeState.error) ? currentModeState.error.value : undefined,
    retry,
    generateForMode,
  };
}

export default useGenerativeMode;
