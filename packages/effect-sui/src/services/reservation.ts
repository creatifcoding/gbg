/** Reservation service contracts. */

import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';

import type { SuiAddress, SuiObjectId, SuiObjectRef, SuiReservationConflict } from '../schema';

export interface SuiReservationRequest {
  readonly objectRefs: ReadonlyArray<SuiObjectRef>;
  readonly objectIds?: ReadonlyArray<SuiObjectId>;
  readonly gasRefs: ReadonlyArray<SuiObjectRef>;
  readonly sender?: SuiAddress;
  readonly sponsor?: SuiAddress;
  readonly intent: string;
}

export interface SuiReservationToken {
  readonly id: string;
  readonly intent: string;
  readonly resourceKeys: ReadonlyArray<string>;
}

export interface SuiReservationServiceShape {
  readonly acquire: (request: SuiReservationRequest) => Effect.Effect<SuiReservationToken, SuiReservationConflict, never>;
  readonly release: (token: SuiReservationToken) => Effect.Effect<void, never, never>;
  readonly reconcile: (token: SuiReservationToken, result: unknown) => Effect.Effect<void, never, never>;
}

export class SuiReservationService extends Context.Service<
  SuiReservationService,
  SuiReservationServiceShape
>()('@tmnl/effect-sui/SuiReservationService') {}
