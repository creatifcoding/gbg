/** Runtime-owned STM state for Sui transaction reservations. */

import * as Effect from 'effect/Effect';
import * as TxHashMap from 'effect/TxHashMap';
import * as TxRef from 'effect/TxRef';

import type { SuiReservationLock, SuiReservationRecord, SuiTxState, SuiTxStateSnapshot } from './types';

export const makeTxState = (): Effect.Effect<SuiTxState> => makeTxStateFromSnapshot(emptySnapshot);

export const emptySnapshot: SuiTxStateSnapshot = {
  nextToken: 0,
  locks: [],
  reservations: [],
  completed: [],
};

export const makeTxStateFromSnapshot = (input: SuiTxStateSnapshot = emptySnapshot): Effect.Effect<SuiTxState> => Effect.gen(function* () {
  const normalized = normalizeSnapshot(input);
  const nextToken = yield* TxRef.make(normalized.nextToken);
  const locks = yield* TxHashMap.fromIterable(normalized.locks.map((lock) => [lock.resourceKey, lock] as const));
  const reservations = yield* TxHashMap.fromIterable(normalized.reservations.map((reservation) => [reservation.id, reservation] as const));
  const completed = yield* TxHashMap.fromIterable(normalized.completed.map((reservation) => [reservation.id, reservation] as const));
  return { nextToken, locks, reservations, completed };
});

export const normalizeSnapshot = (input: SuiTxStateSnapshot): SuiTxStateSnapshot => ({
  nextToken: Math.max(0, input.nextToken),
  locks: [...input.locks],
  reservations: [...input.reservations],
  completed: [...input.completed],
});

export const snapshot = (state: SuiTxState): Effect.Effect<SuiTxStateSnapshot> => Effect.tx(
  Effect.gen(function* () {
    const nextToken = yield* TxRef.get(state.nextToken);
    const locks = yield* TxHashMap.values(state.locks);
    const reservations = yield* TxHashMap.values(state.reservations);
    const completed = yield* TxHashMap.values(state.completed);
    return { nextToken, locks, reservations, completed };
  }),
);
