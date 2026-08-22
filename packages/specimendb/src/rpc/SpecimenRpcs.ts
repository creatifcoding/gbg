/**
 * Specimen RPC surface — Effect v4 Rpc.make / RpcGroup.
 * Intake / Get / List / Promote stay the specimen systems (SpecimenRepo).
 * Export / Project / Doctor / AppendActivity are more systems in the same group.
 *
 * @module @tmnl/specimendb/rpc/SpecimenRpcs
 */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as Rpc from 'effect/unstable/rpc/Rpc';
import * as RpcGroup from 'effect/unstable/rpc/RpcGroup';
import {
  queryActivities,
  appendActivity,
  doctorActivityRef,
  projectActivityRef,
  runActivitySystem,
} from '../adapters/activity.js';
import { SpecimenRepo } from '../repos/SpecimenRepo.js';
import { CatalogRecord, DoctorPayload, ExportPayload, ProjectPayload } from '../schemas/entity.js';
import {
  ActivityAppendError,
  CatalogError,
  EntityNotFoundError,
  IntakeError,
  SpecimenNotFoundError,
} from '../schemas/errors.js';
import { GetByRefPayload, LabEntityRecord } from '../schemas/provenance.js';
import { GetPayload, IntakePayload, IntakeResult, Specimen } from '../schemas/specimen.js';
import { EntityState } from '../state/EntityState.js';
import {
  AppendActivityTag,
  DoctorTag,
  ExportTag,
  GetByRefTag,
  GetTag,
  IntakeTag,
  ListTag,
  ProjectTag,
  PromoteTag,
} from '../tags.js';

export const Intake = Rpc.make(IntakeTag, {
  payload: IntakePayload,
  success: IntakeResult,
  error: Schema.Union([CatalogError, IntakeError]),
});

export const Get = Rpc.make(GetTag, {
  payload: GetPayload,
  success: Specimen,
  error: Schema.Union([CatalogError, SpecimenNotFoundError]),
});

export const List = Rpc.make(ListTag, {
  success: Schema.Array(Specimen),
  error: CatalogError,
});

export const Promote = Rpc.make(PromoteTag, {
  payload: GetPayload,
  success: Specimen,
  error: Schema.Union([CatalogError, SpecimenNotFoundError]),
});

export const Export = Rpc.make(ExportTag, {
  payload: ExportPayload,
  success: CatalogRecord,
  error: Schema.Union([CatalogError, EntityNotFoundError]),
});

export const Project = Rpc.make(ProjectTag, {
  payload: ProjectPayload,
  success: CatalogRecord,
  error: Schema.Union([CatalogError, EntityNotFoundError]),
});

export const Doctor = Rpc.make(DoctorTag, {
  payload: DoctorPayload,
  success: CatalogRecord,
  error: Schema.Union([CatalogError, EntityNotFoundError]),
});

export const AppendActivity = Rpc.make(AppendActivityTag, {
  payload: LabEntityRecord,
  success: CatalogRecord,
  error: Schema.Union([CatalogError, ActivityAppendError]),
});

export const GetByRef = Rpc.make(GetByRefTag, {
  payload: GetByRefPayload,
  success: Schema.Array(CatalogRecord),
  error: CatalogError,
});

export class SpecimenRpcs extends RpcGroup.make(
  Intake,
  Get,
  List,
  Promote,
  Export,
  Project,
  Doctor,
  AppendActivity,
  GetByRef,
) {}

export const SpecimenRpcsLive = SpecimenRpcs.toLayer(
  Effect.gen(function* () {
    const repo = yield* SpecimenRepo;
    const state = yield* EntityState;
    return SpecimenRpcs.of({
      Intake: (payload) => repo.intake(payload),
      Get: (payload) => repo.get(payload.specimenId),
      List: () => repo.list(),
      Promote: (payload) => repo.promote(payload.specimenId),
      Export: (payload) =>
        runActivitySystem(state, {
          id: payload.ref,
          used: payload.used,
          generated: payload.generated,
        }),
      Project: (payload) =>
        runActivitySystem(state, {
          id: payload.ref ?? projectActivityRef(),
          type: 'hlr',
          used: payload.used,
          generated: payload.generated,
        }),
      Doctor: (payload) =>
        runActivitySystem(state, {
          id: payload.ref ?? doctorActivityRef(payload.run),
          used: payload.used,
          generated: payload.generated ?? [payload.run],
        }),
      AppendActivity: (payload) => appendActivity(state, payload),
      GetByRef: (payload) => queryActivities(state, payload),
    });
  }),
);
