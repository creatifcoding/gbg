import * as Effect from 'effect-v4/Effect';
import * as TxHashMap from 'effect-v4/TxHashMap';
import * as TxRef from 'effect-v4/TxRef';

import { SuiReservationConflict } from '../schema';
import type { SuiReservationRequest, SuiReservationToken } from '../services';
import { checkedResourcesFor } from './operations-guards';
import type { SuiReservationRecord, SuiTxState } from './types';

export const acquireReservation = (
  state: SuiTxState,
  request: SuiReservationRequest,
): Effect.Effect<SuiReservationToken, SuiReservationConflict> => Effect.tx(Effect.gen(function* () {
  const resources = yield* checkedResourcesFor(state, request);
  const sequence = yield* TxRef.modify(state.nextToken, (current) => {
    const next = current + 1;
    return [next, next];
  });
  const token: SuiReservationToken = {
    id: `sui-reservation:${sequence}`,
    intent: request.intent,
    resourceKeys: resources.map((resource) => resource.key),
  };
  const record: SuiReservationRecord = { ...token, request, resources, acquiredAt: Date.now() };

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
}));
