import { toBase58, toHex } from '@mysten/bcs';
import * as Effect from 'effect/Effect';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  decodeSuiAddress,
  decodeSuiObjectId,
  SuiObjectRef,
  SuiReservationConflict,
} from '../../src/schema';
import { makeReservationService, makeTxState, snapshot } from '../../src/reservation';

const bytes32 = fc.uint8Array({ minLength: 32, maxLength: 32 });
const objectIdArb = bytes32.map((bytes) => decodeSuiObjectId(`0x${toHex(bytes)}`));
const digestArb = bytes32.map((bytes) => toBase58(bytes));
const senderArb = bytes32.map((bytes) => decodeSuiAddress(`0x${toHex(bytes)}`));

const refFor = (objectId: ReturnType<typeof decodeSuiObjectId>, digest: string) =>
  new SuiObjectRef({ objectId, version: '1', digest: digest as never });

describe('@tmnl/effect-sui reservation STM properties', () => {
  it('never allows two live reservations for the same owned object', async () => {
    await fc.assert(
      fc.asyncProperty(objectIdArb, digestArb, async (objectId, digest) => {
        const state = await Effect.runPromise(makeTxState());
        const service = makeReservationService(state);
        const ref = refFor(objectId, digest);

        await Effect.runPromise(service.acquire({ objectRefs: [ref], gasRefs: [], intent: 'tx/one' }));
        const conflict = await Effect.runPromise(Effect.flip(
          service.acquire({ objectRefs: [ref], gasRefs: [], intent: 'tx/two' }),
        ));
        const stateSnapshot = await Effect.runPromise(snapshot(state));

        expect(conflict).toBeInstanceOf(SuiReservationConflict);
        expect(stateSnapshot.reservations).toHaveLength(1);
        expect(stateSnapshot.locks).toHaveLength(1);
      }),
      { numRuns: 25 },
    );
  });

  it('reconcile always clears live locks even for arbitrary sender reservations', async () => {
    await fc.assert(
      fc.asyncProperty(senderArb, async (sender) => {
        const state = await Effect.runPromise(makeTxState());
        const service = makeReservationService(state);

        const token = await Effect.runPromise(service.acquire({
          objectRefs: [],
          gasRefs: [],
          sender,
          intent: `tx/${sender}`,
        }));
        await Effect.runPromise(service.reconcile(token, { status: 'done' }));
        const stateSnapshot = await Effect.runPromise(snapshot(state));

        expect(stateSnapshot.locks).toHaveLength(0);
        expect(stateSnapshot.reservations).toHaveLength(0);
        expect(stateSnapshot.completed).toHaveLength(1);
      }),
      { numRuns: 25 },
    );
  });
});
