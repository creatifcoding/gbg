/**
 * Activity log RPC — AppendActivity / GetByRef. Same Postgres as the specimen catalog.
 *
 * @module @tmnl/specimendb/rpc/ActivityRpcs
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import * as Rpc from 'effect/unstable/rpc/Rpc';
import * as RpcGroup from 'effect/unstable/rpc/RpcGroup';
import { ActivityAppendError, CatalogError } from '../schemas/errors.js';
import { GetByRefPayload, LabEntity, LabEntityRecord } from '../schemas/provenance.js';
import { ActivityRepo } from '../repos/ActivityRepo.js';

export const AppendActivity = Rpc.make('AppendActivity', {
  payload: LabEntityRecord,
  success: LabEntity,
  error: Schema.Union([CatalogError, ActivityAppendError]),
});

export const GetByRef = Rpc.make('GetByRef', {
  payload: GetByRefPayload,
  success: Schema.Array(LabEntity),
  error: CatalogError,
});

export class ActivityRpcs extends RpcGroup.make(AppendActivity, GetByRef) {}

export const ActivityRpcsLive = ActivityRpcs.toLayer(
  Effect.gen(function* () {
    const repo = yield* ActivityRepo;
    return ActivityRpcs.of({
      AppendActivity: (payload) => repo.append(payload),
      GetByRef: (payload) => repo.getByRef(payload.ref),
    });
  }),
);
