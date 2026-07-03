/** Reservation STM state and record types. */

import type * as Effect from 'effect/Effect';
import type * as TxHashMap from 'effect/TxHashMap';
import type * as TxRef from 'effect/TxRef';

import type { SuiReservationRequest, SuiReservationToken } from '../services';

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

export interface SuiReservationPersistence {
  readonly load: () => Effect.Effect<SuiTxStateSnapshot | undefined, never, never>;
  readonly save: (snapshot: SuiTxStateSnapshot) => Effect.Effect<void, never, never>;
}

export interface SuiReservationServiceOptions {
  readonly persistence?: SuiReservationPersistence;
}
