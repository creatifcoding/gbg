/**
 * ActivityRepo — append-only provenance log.
 *
 * Tables: `lab_activities`, `lab_used`, `lab_generated`. Same Postgres as
 * specimens. Corrections are new rows; who/when are never updated.
 *
 * @module @tmnl/specimendb/repos/ActivityRepo
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import { SqlError } from 'effect/unstable/sql/SqlError';
import { ActivityAppendError, CatalogError } from '../schemas/errors.js';
import { type EntityRef } from '../schemas/identifiers.js';
import { decodeLabEntity, LabEntity } from '../schemas/provenance.js';

export interface ActivityRepoShape {
  readonly append: (
    entity: LabEntity,
  ) => Effect.Effect<LabEntity, CatalogError | ActivityAppendError>;
  readonly getByRef: (
    ref: EntityRef,
  ) => Effect.Effect<ReadonlyArray<LabEntity>, CatalogError>;
}

const nowIso = () => new Date().toISOString();

const catalogError = (operation: string) => (cause: SqlError) =>
  new CatalogError({
    operation,
    message: cause.message,
    cause,
  });

const parsePayload = (raw: unknown): unknown => {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
};

const uniqueRefs = (refs: ReadonlyArray<EntityRef>): ReadonlyArray<EntityRef> => {
  const seen = new Set<string>();
  const out: Array<EntityRef> = [];
  for (const ref of refs) {
    if (seen.has(ref)) continue;
    seen.add(ref);
    out.push(ref);
  }
  return out;
};

const usedOf = (entity: LabEntity): ReadonlyArray<EntityRef> =>
  uniqueRefs(entity.what?.used ?? entity.used ?? []);

const generatedOf = (entity: LabEntity): ReadonlyArray<EntityRef> =>
  uniqueRefs(entity.what?.generated ?? entity.generated ?? []);

const isUniqueViolation = (error: SqlError): boolean =>
  error.reason._tag === 'UniqueViolation' ||
  /unique|duplicate key|already exists/i.test(error.message);

const encodeActivity = Schema.encodeUnknownSync(LabEntity);

export class ActivityRepo extends Context.Service<ActivityRepo, ActivityRepoShape>()(
  '@tmnl/specimendb/ActivityRepo',
) {
  static readonly layer = Layer.effect(
    ActivityRepo,
    Effect.gen(function* () {
      const sql = yield* SqlClient;

      const insertUsed = (activityRef: EntityRef, refs: ReadonlyArray<EntityRef>) =>
        Effect.gen(function* () {
          for (const entityRef of refs) {
            yield* sql`
              INSERT INTO lab_used (activity_ref, entity_ref)
              VALUES (${activityRef}, ${entityRef})
            `.pipe(Effect.asVoid, Effect.mapError(catalogError('insertUsed')));
          }
        });

      const insertGenerated = (activityRef: EntityRef, refs: ReadonlyArray<EntityRef>) =>
        Effect.gen(function* () {
          for (const entityRef of refs) {
            yield* sql`
              INSERT INTO lab_generated (activity_ref, entity_ref)
              VALUES (${activityRef}, ${entityRef})
            `.pipe(Effect.asVoid, Effect.mapError(catalogError('insertGenerated')));
          }
        });

      const append = Effect.fn('@tmnl/specimendb/ActivityRepo.append')(function* (
        entity: LabEntity,
      ) {
        if (entity.kind !== 'activity') {
          return yield* new ActivityAppendError({
            message: 'AppendActivity requires kind=activity',
            ref: entity.ref,
          });
        }
        if (
          entity.who === undefined ||
          entity.who.length === 0 ||
          entity.what === undefined ||
          entity.when === undefined ||
          entity.where === undefined ||
          entity.where.length === 0 ||
          entity.why === undefined ||
          entity.why.length === 0 ||
          entity.how === undefined ||
          entity.how.length === 0
        ) {
          return yield* new ActivityAppendError({
            message: 'activity entities require W7: who, what, when, where, why, how',
            ref: entity.ref,
          });
        }

        const payload = JSON.stringify(encodeActivity(entity));
        const gitSha = entity.when.gitSha ?? entity.bytes?.gitSha;
        const supersedes = entity.supersedes;
        const appendedAt = nowIso();

        yield* sql`
          INSERT INTO lab_activities (
            ref, payload, started_at, git_sha, where_text, why, how, who, supersedes, appended_at
          ) VALUES (
            ${entity.ref},
            ${payload}::jsonb,
            ${entity.when.startedAt},
            ${gitSha ?? null},
            ${entity.where},
            ${entity.why},
            ${entity.how},
            ${JSON.stringify(entity.who)}::jsonb,
            ${supersedes ?? null},
            ${appendedAt}
          )
        `.pipe(
          Effect.asVoid,
          Effect.mapError((cause) => {
            if (isUniqueViolation(cause)) {
              return new ActivityAppendError({
                message: 'activity ref already exists; corrections must append a new ref',
                ref: entity.ref,
                cause,
              });
            }
            return catalogError('appendActivity')(cause);
          }),
        );

        yield* insertUsed(entity.ref, usedOf(entity));
        yield* insertGenerated(entity.ref, generatedOf(entity));

        return entity;
      });

      const getByRef = Effect.fn('@tmnl/specimendb/ActivityRepo.getByRef')(function* (
        ref: EntityRef,
      ) {
        const rows = yield* sql<{ payload: unknown }>`
          SELECT a.payload
          FROM lab_activities a
          WHERE a.ref = ${ref}
             OR a.supersedes = ${ref}
             OR EXISTS (
               SELECT 1 FROM lab_used u
               WHERE u.activity_ref = a.ref AND u.entity_ref = ${ref}
             )
             OR EXISTS (
               SELECT 1 FROM lab_generated g
               WHERE g.activity_ref = a.ref AND g.entity_ref = ${ref}
             )
          ORDER BY a.appended_seq ASC
        `.pipe(Effect.mapError(catalogError('getByRef')));

        const activities: Array<LabEntity> = [];
        for (const row of rows) {
          const decoded = yield* Effect.try({
            try: () => decodeLabEntity(parsePayload(row.payload)),
            catch: (cause) =>
              new CatalogError({
                operation: 'decodeActivity',
                message: 'Failed to decode stored activity',
                cause,
              }),
          });
          activities.push(decoded);
        }
        return activities;
      });

      return ActivityRepo.of({ append, getByRef });
    }),
  );
}
