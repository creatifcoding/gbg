/**
 * Specimen RPC surface — Effect v4 Rpc.make / RpcGroup (not @effect/rpc, not tmnl).
 *
 * @module @tmnl/specimendb/rpc
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import * as Rpc from 'effect/unstable/rpc/Rpc';
import * as RpcGroup from 'effect/unstable/rpc/RpcGroup';
import { CatalogError, IntakeError, SpecimenNotFoundError } from '../schemas/errors.js';
import { GetPayload, IntakePayload, IntakeResult, Specimen } from '../schemas/specimen.js';
import { SpecimenRepo } from '../repos/SpecimenRepo.js';

export const Intake = Rpc.make('Intake', {
  payload: IntakePayload,
  success: IntakeResult,
  error: Schema.Union([CatalogError, IntakeError]),
});

export const Get = Rpc.make('Get', {
  payload: GetPayload,
  success: Specimen,
  error: Schema.Union([CatalogError, SpecimenNotFoundError]),
});

export const List = Rpc.make('List', {
  success: Schema.Array(Specimen),
  error: CatalogError,
});

export const Promote = Rpc.make('Promote', {
  payload: GetPayload,
  success: Specimen,
  error: Schema.Union([CatalogError, SpecimenNotFoundError]),
});

export class SpecimenRpcs extends RpcGroup.make(Intake, Get, List, Promote) {}

export const SpecimenRpcsLive = SpecimenRpcs.toLayer(
  Effect.gen(function* () {
    const repo = yield* SpecimenRepo;
    return SpecimenRpcs.of({
      Intake: (payload) => repo.intake(payload),
      Get: (payload) => repo.get(payload.specimenId),
      List: () => repo.list(),
      Promote: (payload) => repo.promote(payload.specimenId),
    });
  }),
);
