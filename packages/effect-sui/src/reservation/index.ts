/** Runtime-owned STM reservation state for Sui objects, gas, payment, and dispatch. */

import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import * as Option from 'effect-v4/Option';
import * as TxHashMap from 'effect-v4/TxHashMap';
import * as TxRef from 'effect-v4/TxRef';

import {
  SuiReservationConflict,
  type SuiAddress,
  type SuiObjectId,
  type SuiObjectRef,
} from '../schema';
import {
  SuiReservationService,
  type SuiReservationRequest,
  type SuiReservationServiceShape,
  type SuiReservationToken,
} from '../services';

export type SuiReservationResourceKind = 'object' | 'gas' | 'sender' | 'sponsor';

export interface SuiReservationResource {
  readonly key: string;
  readonly kind: SuiReservationResourceKind;
}

export interface SuiReservationLock {
  readonly resourceKey: string;
  readonly kind: SuiReservationResourceKind;
  readonly tokenId: string;
  readonly intent: string;
}

export interface SuiReservationRecord extends SuiReservationToken {
  readonly request: SuiReservationRequest;
  readonly resources: ReadonlyArray<SuiReservationResource>;
  readonly acquiredAt: number;
  readonly releasedAt?: number;
  readonly result?: unknown;
}

export interface SuiTxState {
  readonly nextToken: TxRef.TxRef<number>;
  readonly locks: TxHashMap.TxHashMap<string, SuiReservationLock>;
  readonly reservations: TxHashMap.TxHashMap<string, SuiReservationRecord>;
  readonly completed: TxHashMap.TxHashMap<string, SuiReservationRecord>;
}

export interface SuiTxStateSnapshot {
  readonly nextToken: number;
  readonly locks: ReadonlyArray<SuiReservationLock>;
  readonly reservations: ReadonlyArray<SuiReservationRecord>;
  readonly completed: ReadonlyArray<SuiReservationRecord>;
}

export const makeTxState = (): Effect.Effect<SuiTxState> => Effect.gen(function* () {
  const nextToken = yield* TxRef.make(0);
  const locks = yield* TxHashMap.empty<string, SuiReservationLock>();
  const reservations = yield* TxHashMap.empty<string, SuiReservationRecord>();
  const completed = yield* TxHashMap.empty<string, SuiReservationRecord>();
  return { nextToken, locks, reservations, completed };
});

export const makeReservationService = (state: SuiTxState): SuiReservationServiceShape => ({
  acquire: (request) => acquireReservation(state, request).pipe(
    Effect.withSpan('@tmnl/effect-sui/SuiReservationService.acquire', {
      attributes: { intent: request.intent },
    }),
  ),
  release: (token) => releaseReservation(state, token.id).pipe(
    Effect.withSpan('@tmnl/effect-sui/SuiReservationService.release', {
      attributes: { intent: token.intent, tokenId: token.id },
    }),
  ),
  reconcile: (token, result) => reconcileReservation(state, token.id, result).pipe(
    Effect.withSpan('@tmnl/effect-sui/SuiReservationService.reconcile', {
      attributes: { intent: token.intent, tokenId: token.id },
    }),
  ),
});

export const SuiReservationServiceLive = Layer.effect(SuiReservationService)(
  Effect.map(makeTxState(), makeReservationService),
);

export const snapshot = (state: SuiTxState): Effect.Effect<SuiTxStateSnapshot> => Effect.tx(
  Effect.gen(function* () {
    const nextToken = yield* TxRef.get(state.nextToken);
    const locks = yield* TxHashMap.values(state.locks);
    const reservations = yield* TxHashMap.values(state.reservations);
    const completed = yield* TxHashMap.values(state.completed);
    return { nextToken, locks, reservations, completed };
  }),
);

export const resourceKeysFor = (request: SuiReservationRequest): ReadonlyArray<SuiReservationResource> => {
  const resources: Array<SuiReservationResource> = [];

  for (const ref of request.objectRefs) {
    resources.push({ key: objectKey(ref.objectId), kind: 'object' });
  }
  for (const objectId of request.objectIds ?? []) {
    resources.push({ key: objectKey(objectId), kind: 'object' });
  }
  for (const ref of request.gasRefs) {
    resources.push({ key: gasKey(ref.objectId), kind: 'gas' });
  }
  if (request.sender) resources.push({ key: senderKey(request.sender), kind: 'sender' });
  if (request.sponsor) resources.push({ key: sponsorKey(request.sponsor), kind: 'sponsor' });

  return resources;
};

export const objectKey = (objectId: SuiObjectId): string => `owned:${objectId}`;
export const gasKey = (objectId: SuiObjectId): string => `owned:${objectId}`;
export const senderKey = (sender: SuiAddress): string => `sender:${sender}`;
export const sponsorKey = (sponsor: SuiAddress): string => `sponsor:${sponsor}`;

const acquireReservation = (
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

const releaseReservation = (state: SuiTxState, tokenId: string): Effect.Effect<void> => Effect.tx(
  Effect.gen(function* () {
    yield* releaseRecord(state, tokenId);
  }),
);

const reconcileReservation = (
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
