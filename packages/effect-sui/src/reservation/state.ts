/** Runtime-owned STM state for Sui transaction reservations. */

import * as Effect from 'effect-v4/Effect';
import * as TxHashMap from 'effect-v4/TxHashMap';
import * as TxRef from 'effect-v4/TxRef';

import type { SuiReservationLock, SuiReservationRecord, SuiTxState, SuiTxStateSnapshot } from './types';

export const makeTxState = (): Effect.Effect<SuiTxState> => Effect.gen(function* () {
  const nextToken = yield* TxRef.make(0);
  const locks = yield* TxHashMap.empty<string, SuiReservationLock>();
  const reservations = yield* TxHashMap.empty<string, SuiReservationRecord>();
  const completed = yield* TxHashMap.empty<string, SuiReservationRecord>();
  return { nextToken, locks, reservations, completed };
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
