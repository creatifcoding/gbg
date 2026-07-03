/** Reservation service layer assembly. */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

import { SuiReservationService, type SuiReservationServiceShape } from '../services';
import { acquireReservation, reconcileReservation, releaseReservation } from './operations';
import { makeTxState, makeTxStateFromSnapshot, snapshot } from './state';
import type { SuiReservationServiceOptions, SuiTxState } from './types';

export const makeReservationService = (
  state: SuiTxState,
  options: SuiReservationServiceOptions = {},
): SuiReservationServiceShape => {
  const persist = persistReservationState(state, options);
  return {
    acquire: (request) => acquireReservation(state, request).pipe(
      Effect.tap(() => persist),
      Effect.withSpan('@tmnl/effect-sui/SuiReservationService.acquire', {
        attributes: { intent: request.intent },
      }),
    ),
    release: (token) => releaseReservation(state, token.id).pipe(
      Effect.tap(() => persist),
      Effect.withSpan('@tmnl/effect-sui/SuiReservationService.release', {
        attributes: { intent: token.intent, tokenId: token.id },
      }),
    ),
    reconcile: (token, result) => reconcileReservation(state, token.id, result).pipe(
      Effect.tap(() => persist),
      Effect.withSpan('@tmnl/effect-sui/SuiReservationService.reconcile', {
        attributes: { intent: token.intent, tokenId: token.id },
      }),
    ),
  };
};

export const makePersistentReservationService = (
  options: SuiReservationServiceOptions,
): Effect.Effect<SuiReservationServiceShape> => Effect.gen(function* () {
  const restored = options.persistence ? yield* options.persistence.load() : undefined;
  const state = restored ? yield* makeTxStateFromSnapshot(restored) : yield* makeTxState();
  return makeReservationService(state, options);
});

const persistReservationState = (
  state: SuiTxState,
  options: SuiReservationServiceOptions,
): Effect.Effect<void, never, never> => options.persistence
  ? snapshot(state).pipe(Effect.flatMap(options.persistence.save))
  : Effect.void;

export const SuiReservationServiceLive = Layer.effect(SuiReservationService)(
  Effect.map(makeTxState(), makeReservationService),
);
