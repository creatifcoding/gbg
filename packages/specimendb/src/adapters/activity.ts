/**
 * Activity systems. Used / Generated / Supersedes hang on the activity's entity_id.
 * Corrections append a new ref. There is no lab_activities / lab_used / lab_generated table.
 *
 * @module @tmnl/specimendb/adapters/activity
 */

import * as Effect from 'effect/Effect';
import {
  BytesComponent,
  GeneratedComponent,
  KindComponent,
  TypeComponent,
  SupersedesComponent,
  UsedComponent,
  relationTargets,
  type Component,
} from '../schemas/components.js';
import {
  ActivityAppendError,
  CatalogError,
  EntityNotFoundError,
} from '../schemas/errors.js';
import { parseEntityRef, trustEntityRef, type EntityRef } from '../schemas/identifiers.js';
import type { EntityKind, EntityType, LabEntity } from '../schemas/provenance.js';
import type { ContentAddress } from '../schemas/provenance.js';
import type { CatalogRecord } from '../schemas/entity.js';
import type { EntityStateShape, EntityMint } from '../state/EntityState.js';

export interface ActivityRelations {
  readonly used: ReadonlyArray<EntityRef>;
  readonly generated: ReadonlyArray<EntityRef>;
  readonly supersedes?: EntityRef;
}

export const uniqueEntityRefs = (refs: ReadonlyArray<EntityRef>): ReadonlyArray<EntityRef> => {
  const seen = new Set<string>();
  const out: Array<EntityRef> = [];
  for (const ref of refs) {
    if (seen.has(ref)) continue;
    seen.add(ref);
    out.push(ref);
  }
  return out;
};

/** Copy used/generated from LabEntity (`what.used ?? used`). */
export const relationsFromLabEntity = (entity: LabEntity): ActivityRelations => ({
  used: uniqueEntityRefs([...(entity.what?.used ?? []), ...(entity.used ?? [])]),
  generated: uniqueEntityRefs([...(entity.what?.generated ?? []), ...(entity.generated ?? [])]),
  ...(entity.supersedes !== undefined ? { supersedes: entity.supersedes } : {}),
});

export const declarationComponents = (input: {
  readonly kind: EntityKind;
  readonly type?: EntityType;
  readonly bytes?: ContentAddress;
}): ReadonlyArray<Component> => {
  const out: Array<Component> = [new KindComponent({ value: input.kind })];
  if (input.type !== undefined) {
    out.push(new TypeComponent({ value: input.type }));
  }
  if (input.bytes !== undefined) {
    out.push(new BytesComponent(input.bytes));
  }
  return out;
};

export const activityComponents = (relations: ActivityRelations, type?: EntityType): ReadonlyArray<Component> => {
  const out: Array<Component> = [...declarationComponents({ kind: 'activity', type })];
  for (const target of uniqueEntityRefs(relations.used)) {
    out.push(new UsedComponent({ target }));
  }
  for (const target of uniqueEntityRefs(relations.generated)) {
    out.push(new GeneratedComponent({ target }));
  }
  if (relations.supersedes !== undefined) {
    out.push(new SupersedesComponent({ target: relations.supersedes }));
  }
  return out;
};

/** Kind + Type + Bytes. Honesty / Claim / Used / Generated stay gated. */
export const labEntityComponents = (entity: LabEntity): ReadonlyArray<Component> => {
  const declared = declarationComponents({
    kind: entity.kind,
    type: entity.type,
    bytes: entity.bytes,
  });
  if (entity.kind === 'activity') {
    const relations = activityComponents(relationsFromLabEntity(entity), entity.type).filter(
      (component) => component._tag !== 'Kind' && component._tag !== 'Type',
    );
    return [...declared, ...relations];
  }
  return declared;
};

export const createdAtOf = (entity: LabEntity): string =>
  entity.when?.startedAt ?? new Date().toISOString();

export const mintFromLabEntity = (entity: LabEntity): EntityMint => ({
  id: entity.ref,
  kind: entity.kind,
  ...(entity.type !== undefined ? { type: entity.type } : {}),
  createdAt: createdAtOf(entity),
});

/** `gbg:run:doctor:pr57-fixture` → `gbg:activity:doctor:pr57-fixture`. */
export const doctorActivityRef = (runRef: EntityRef): EntityRef => {
  const parsed = parseEntityRef(runRef);
  const local = parsed?.local ?? runRef;
  return trustEntityRef(`gbg:activity:${local}`);
};

export const projectActivityRef = (): EntityRef =>
  trustEntityRef(`gbg:activity:project:${globalThis.crypto.randomUUID()}`);

export const requireTargets = (
  state: EntityStateShape,
  refs: ReadonlyArray<EntityRef>,
): Effect.Effect<void, CatalogError | EntityNotFoundError> =>
  Effect.gen(function* () {
    for (const target of uniqueEntityRefs(refs)) {
      yield* state.get(target);
    }
  });

export const runActivitySystem = (
  state: EntityStateShape,
  input: {
    readonly id: EntityRef;
    readonly type?: EntityType;
    readonly used?: ReadonlyArray<EntityRef>;
    readonly generated?: ReadonlyArray<EntityRef>;
    readonly supersedes?: EntityRef;
    readonly createdAt?: string;
    readonly requireTargets?: boolean;
  },
): Effect.Effect<CatalogRecord, CatalogError | EntityNotFoundError> => {
  const relations: ActivityRelations = {
    used: uniqueEntityRefs(input.used ?? []),
    generated: uniqueEntityRefs(input.generated ?? []),
    ...(input.supersedes !== undefined ? { supersedes: input.supersedes } : {}),
  };
  return Effect.gen(function* () {
    if (input.requireTargets !== false) {
      yield* requireTargets(state, [
        ...relations.used,
        ...relations.generated,
        ...(relations.supersedes !== undefined ? [relations.supersedes] : []),
      ]);
    }
    return yield* state.ensure(
      {
        id: input.id,
        kind: 'activity',
        ...(input.type !== undefined ? { type: input.type } : {}),
        createdAt: input.createdAt ?? new Date().toISOString(),
      },
      activityComponents(relations, input.type),
    );
  });
};

/**
 * PR 92 `ActivityRepo.append` invariant, as a system:
 * refuse to rewrite a ref; corrections append a new one; attach Used/Generated/Supersedes.
 */
export const appendActivity = (
  state: EntityStateShape,
  entity: LabEntity,
): Effect.Effect<CatalogRecord, CatalogError | ActivityAppendError> =>
  Effect.gen(function* () {
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

    const existing = yield* state.get(entity.ref).pipe(
      Effect.catchTag('EntityNotFoundError', () => Effect.succeed(undefined)),
    );
    if (existing !== undefined) {
      return yield* new ActivityAppendError({
        message: 'activity ref already exists; corrections must append a new ref',
        ref: entity.ref,
      });
    }

    return yield* state.mint(mintFromLabEntity(entity), labEntityComponents(entity)).pipe(
      Effect.mapError((cause): CatalogError | ActivityAppendError => {
        if (/unique|duplicate key|already exists/i.test(cause.message)) {
          return new ActivityAppendError({
            message: 'activity ref already exists; corrections must append a new ref',
            ref: entity.ref,
            cause,
          });
        }
        return cause;
      }),
    );
  });

export const activitiesByRef = (
  state: EntityStateShape,
  ref: EntityRef,
): Effect.Effect<ReadonlyArray<CatalogRecord>, CatalogError> =>
  state.list('activity').pipe(
    Effect.map((rows) =>
      rows.filter(
        (row) =>
          row.id === ref ||
          relationTargets(row.components, 'Used').includes(ref) ||
          relationTargets(row.components, 'Generated').includes(ref) ||
          relationTargets(row.components, 'Supersedes').includes(ref),
      ),
    ),
  );
