import * as Effect from 'effect-v4/Effect';
import { describe, expect, it } from 'vitest';

import {
  decodeSuiAddress,
  decodeSuiObjectDigest,
  decodeSuiObjectId,
  SuiObjectRef,
  SuiReservationConflict,
} from '../schema';
import {
  makeReservationService,
  makeTxState,
  objectKey,
  senderKey,
  snapshot,
} from './index';

const objectId = decodeSuiObjectId('0x7');
const otherObjectId = decodeSuiObjectId('0x8');
const digest = decodeSuiObjectDigest('11111111111111111111111111111112');
const sender = decodeSuiAddress('0x2');
const otherSender = decodeSuiAddress('0x3');

const objectRef = new SuiObjectRef({ objectId, version: '1', digest });
const otherObjectRef = new SuiObjectRef({ objectId: otherObjectId, version: '1', digest });

describe('SuiReservationService STM state', () => {
  it('acquires object, gas, and sender locks in TxHashMap-backed state', async () => {
    const state = await Effect.runPromise(makeTxState());
    const service = makeReservationService(state);

    const token = await Effect.runPromise(service.acquire({
      objectRefs: [objectRef],
      gasRefs: [],
      sender,
      intent: 'tx/one',
    }));
    const stateSnapshot = await Effect.runPromise(snapshot(state));

    expect(token.intent).toBe('tx/one');
    expect(token.resourceKeys).toEqual([objectKey(objectId), senderKey(sender)]);
    expect(stateSnapshot.locks.map((lock) => lock.resourceKey).sort()).toEqual([
      objectKey(objectId),
      senderKey(sender),
    ].sort());
    expect(stateSnapshot.reservations).toHaveLength(1);
  });

  it('rejects conflicting owned object reservations with a Schema-backed error', async () => {
    const state = await Effect.runPromise(makeTxState());
    const service = makeReservationService(state);

    const first = await Effect.runPromise(service.acquire({
      objectRefs: [objectRef],
      gasRefs: [],
      intent: 'tx/one',
    }));
    const conflict = await Effect.runPromise(Effect.flip(service.acquire({
      objectRefs: [objectRef],
      gasRefs: [],
      intent: 'tx/two',
    })));

    expect(conflict).toBeInstanceOf(SuiReservationConflict);
    expect(conflict.resourceKey).toBe(objectKey(objectId));
    expect(conflict.heldBy).toBe(first.id);
  });

  it('releases locks and allows later reservations', async () => {
    const state = await Effect.runPromise(makeTxState());
    const service = makeReservationService(state);

    const first = await Effect.runPromise(service.acquire({
      objectRefs: [objectRef],
      gasRefs: [],
      intent: 'tx/one',
    }));
    await Effect.runPromise(service.release(first));

    const second = await Effect.runPromise(service.acquire({
      objectRefs: [objectRef],
      gasRefs: [],
      intent: 'tx/two',
    }));
    const stateSnapshot = await Effect.runPromise(snapshot(state));

    expect(second.id).not.toBe(first.id);
    expect(stateSnapshot.reservations).toHaveLength(1);
    expect(stateSnapshot.locks).toHaveLength(1);
  });

  it('reconciles by releasing active locks and recording completed reservations', async () => {
    const state = await Effect.runPromise(makeTxState());
    const service = makeReservationService(state);

    const token = await Effect.runPromise(service.acquire({
      objectRefs: [objectRef],
      gasRefs: [],
      sender,
      intent: 'tx/reconcile',
    }));
    await Effect.runPromise(service.reconcile(token, { status: 'finalized' }));
    const stateSnapshot = await Effect.runPromise(snapshot(state));

    expect(stateSnapshot.locks).toEqual([]);
    expect(stateSnapshot.reservations).toEqual([]);
    expect(stateSnapshot.completed).toHaveLength(1);
    expect(stateSnapshot.completed[0]?.result).toEqual({ status: 'finalized' });
  });

  it('permits non-overlapping reservations concurrently and rejects overlapping sender dispatch', async () => {
    const state = await Effect.runPromise(makeTxState());
    const service = makeReservationService(state);

    const distinct = await Promise.all([
      Effect.runPromise(service.acquire({ objectRefs: [objectRef], gasRefs: [], sender, intent: 'tx/one' })),
      Effect.runPromise(service.acquire({ objectRefs: [otherObjectRef], gasRefs: [], sender: otherSender, intent: 'tx/two' })),
    ]);
    expect(distinct).toHaveLength(2);

    const overlapping = await Promise.allSettled([
      Effect.runPromise(service.acquire({ objectRefs: [], gasRefs: [], sender: decodeSuiAddress('0x4'), intent: 'tx/three' })),
      Effect.runPromise(service.acquire({ objectRefs: [], gasRefs: [], sender: decodeSuiAddress('0x4'), intent: 'tx/four' })),
    ]);

    expect(overlapping.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(overlapping.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });
});
