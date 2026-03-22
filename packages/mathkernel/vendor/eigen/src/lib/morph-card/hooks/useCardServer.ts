/**
 * useCardServer Hook
 *
 * React hook for CardServerService - provides query and subscribe
 * methods bound to a specific card.
 *
 * @module morph-card/hooks/useCardServer
 */

import { useCallback } from 'react';
import { Effect } from 'effect';
import {
  CardServerService,
  CardServerServiceLive,
  type QueryOptions,
} from '../services/CardServerService';

/**
 * Hook result type
 */
export interface UseCardServerResult {
  /**
   * Query an endpoint and get JSON response
   */
  query: (endpoint: string, options?: QueryOptions) => Promise<unknown>;

  /**
   * Subscribe to a topic with a handler
   * Returns unsubscribe function
   */
  subscribe: (topic: string, handler: (data: unknown) => void) => Promise<() => void>;
}

/**
 * React hook for CardServerService
 *
 * Provides query/subscribe methods bound to a card.
 *
 * @example
 * ```tsx
 * function MyCardContent({ cardId }: { cardId: string }) {
 *   const { query, subscribe } = useCardServer(cardId);
 *
 *   useEffect(() => {
 *     query('/api/data').then(setData);
 *
 *     const unsubPromise = subscribe('updates', (data) => {
 *       console.log('Update:', data);
 *     });
 *
 *     return () => { unsubPromise.then(unsub => unsub()); };
 *   }, [query, subscribe]);
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useCardServer(cardId: string): UseCardServerResult {
  const query = useCallback(
    async (endpoint: string, options?: QueryOptions): Promise<unknown> => {
      const program = Effect.gen(function* () {
        const service = yield* CardServerService;
        return yield* service.query(cardId, endpoint, options);
      }).pipe(Effect.provide(CardServerServiceLive));

      return Effect.runPromise(program);
    },
    [cardId]
  );

  const subscribe = useCallback(
    async (
      topic: string,
      handler: (data: unknown) => void
    ): Promise<() => void> => {
      const program = Effect.gen(function* () {
        const service = yield* CardServerService;
        return yield* service.subscribe(cardId, topic, handler);
      }).pipe(Effect.provide(CardServerServiceLive));

      return Effect.runPromise(program);
    },
    [cardId]
  );

  return { query, subscribe };
}
