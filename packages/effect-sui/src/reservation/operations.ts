/** STM reservation acquire/release/reconcile operations. */

import * as Effect from 'effect-v4/Effect';
import * as Option from 'effect-v4/Option';
import * as TxHashMap from 'effect-v4/TxHashMap';
import * as TxRef from 'effect-v4/TxRef';

import { SuiReservationConflict } from '../schema';
import type { SuiReservationRequest, SuiReservationToken } from '../services';
import { resourceKeysFor } from './resources';
import type { SuiReservationRecord, SuiTxState } from './types';

export const acquireReservation = (
  state: SuiTxState,
  request: SuiReservationRequest,
): Effect.Effect<SuiReservationToken, SuiReservationConflict> => Effect.tx(
  Effect.gen(function* () {
    const resources = resourceKeysFor(request);
    const duplicate = firstDuplicate(resources.map((resource) => resource.key));
    if (duplicate) {
      return yield* Effect.fail(new SuiReservationConflict({
        kind: 'duplicate',
        resourceKey: duplicate,
        intent: request.intent,
        message: `Reservation request ${request.intent} contains duplicate resource ${duplicate}`,
      }));
    }

    for (const resource of resources) {
      const existing = yield* TxHashMap.get(state.locks, resource.key);
      if (Option.isSome(existing)) {
        return yield* Effect.fail(new SuiReservationConflict({
          kind: resource.kind,
          resourceKey: resource.key,
          intent: request.intent,
          heldBy: existing.value.tokenId,
          requestedBy: request.intent,
          message: `Resource ${resource.key} is already reserved by ${existing.value.intent}`,
        }));
      }
    }

    const sequence = yield* TxRef.modify(state.nextToken, (current) => {
      const next = current + 1;
      return [next, next];
    });
    const token: SuiReservationToken = {
      id: `sui-reservation:${sequence}`,
      intent: request.intent,
      resourceKeys: resources.map((resource) => resource.key),
    };
    const record: SuiReservationRecord = {
      ...token,
      request,
      resources,
      acquiredAt: Date.now(),
    };

    for (const resource of resources) {
      yield* TxHashMap.set(state.locks, resource.key, {
        resourceKey: resource.key,
        kind: resource.kind,
        tokenId: token.id,
        intent: request.intent,
      });
    }
    yield* TxHashMap.set(state.reservations, token.id, record);

    return token;
  }),
);

export const releaseReservation = (state: SuiTxState, tokenId: string): Effect.Effect<void> => Effect.tx(
  Effect.gen(function* () {
    yield* releaseRecord(state, tokenId);
  }),
);

export const reconcileReservation = (
  state: SuiTxState,
  tokenId: string,
  result: unknown,
): Effect.Effect<void> => Effect.tx(
  Effect.gen(function* () {
    const record = yield* releaseRecord(state, tokenId);
    if (record) {
      yield* TxHashMap.set(state.completed, tokenId, {
        ...record,
        releasedAt: Date.now(),
        result,
      });
    }
  }),
);

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

const firstDuplicate = (values: ReadonlyArray<string>): string | undefined => {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return undefined;
};
