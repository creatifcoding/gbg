import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as TxHashMap from 'effect/TxHashMap';

import type { SuiReservationRecord, SuiTxState } from './types';

export const releaseReservation = (state: SuiTxState, tokenId: string): Effect.Effect<void> => Effect.tx(
  Effect.gen(function* () {
    yield* releaseRecord(state, tokenId);
  }),
);

export const reconcileReservation = (
  state: SuiTxState,
  tokenId: string,
  result: unknown,
): Effect.Effect<void> => Effect.tx(Effect.gen(function* () {
  const record = yield* releaseRecord(state, tokenId);
  if (record) {
    yield* TxHashMap.set(state.completed, tokenId, {
      ...record,
      releasedAt: Date.now(),
      result,
    });
  }
}));

const releaseRecord = (state: SuiTxState, tokenId: string): Effect.Effect<SuiReservationRecord | undefined> => Effect.gen(function* () {
  const recordOption = yield* TxHashMap.get(state.reservations, tokenId);
  if (Option.isNone(recordOption)) return undefined;

  const record = recordOption.value;
  for (const resource of record.resources) {
    const lock = yield* TxHashMap.get(state.locks, resource.key);
    if (Option.isSome(lock) && lock.value.tokenId === tokenId) {
      yield* TxHashMap.remove(state.locks, resource.key);
    }
  }
  yield* TxHashMap.remove(state.reservations, tokenId);
  return record;
});
