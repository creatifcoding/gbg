/**
 * Activity systems. Used / Generated / Supersedes hang on the activity's entity_id.
 * W7 hangs as Who / When / Where / Why / How when it arrived. What is Used + Generated.
 * Corrections append a new ref. There is no lab_activities / lab_used / lab_generated table.
 *
 * @module @tmnl/specimendb/adapters/activity
 */

import * as Effect from 'effect/Effect';
import {
  BytesComponent,
  GeneratedComponent,
  HowComponent,
  KindComponent,
  TypeComponent,
  SupersedesComponent,
  UsedComponent,
  WhenComponent,
  WhereComponent,
  WhoComponent,
  WhyComponent,
  relationTargets,
  type Component,
} from '../schemas/components.js';
import {
  ActivityAppendError,
  CatalogError,
  EntityNotFoundError,
} from '../schemas/errors.js';
import { parseEntityRef, trustEntityRef, type EntityRef } from '../schemas/identifiers.js';
import type { Agent, EntityKind, EntityType, LabEntity, ProvenanceWhen } from '../schemas/provenance.js';
import type { ContentAddress } from '../schemas/provenance.js';
import type { CatalogRecord } from '../schemas/entity.js';
import type { EntityStateShape, EntityMint } from '../state/EntityState.js';

export interface ActivityRelations {
  readonly used: ReadonlyArray<EntityRef>;
  readonly generated: ReadonlyArray<EntityRef>;
  readonly supersedes?: EntityRef;
}

export interface ActivityW7 {
  readonly who?: ReadonlyArray<Agent>;
  readonly when?: ProvenanceWhen;
  readonly where?: string;
  readonly why?: string;
  readonly how?: string;
}

export type ActivityQuery =
  | { readonly ref: EntityRef }
  | { readonly who: string }
  | { readonly why: string }
  | { readonly gitSha: string }
  | { readonly startedAt: string };

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

export const w7FromLabEntity = (entity: LabEntity): ActivityW7 => ({
  ...(entity.who !== undefined ? { who: entity.who } : {}),
  ...(entity.when !== undefined ? { when: entity.when } : {}),
  ...(entity.where !== undefined ? { where: entity.where } : {}),
  ...(entity.why !== undefined ? { why: entity.why } : {}),
  ...(entity.how !== undefined ? { how: entity.how } : {}),
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

export const w7Components = (w7: ActivityW7): ReadonlyArray<Component> => {
  const out: Array<Component> = [];
  for (const agent of w7.who ?? []) {
    out.push(
      new WhoComponent({
        agentType: agent.agentType,
        label: agent.label,
        ...(agent.ref !== undefined ? { ref: agent.ref } : {}),
      }),
    );
  }
  if (w7.when !== undefined) {
    out.push(
      new WhenComponent({
        startedAt: w7.when.startedAt,
        ...(w7.when.completedAt !== undefined ? { completedAt: w7.when.completedAt } : {}),
        ...(w7.when.gitSha !== undefined ? { gitSha: w7.when.gitSha } : {}),
      }),
    );
  }
  if (w7.where !== undefined) {
    out.push(new WhereComponent({ value: w7.where }));
  }
  if (w7.why !== undefined) {
    out.push(new WhyComponent({ value: w7.why }));
  }
  if (w7.how !== undefined) {
    out.push(new HowComponent({ value: w7.how }));
  }
  return out;
};

export const activityComponents = (
  relations: ActivityRelations,
  type?: EntityType,
  w7?: ActivityW7,
): ReadonlyArray<Component> => {
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
  if (w7 !== undefined) {
    out.push(...w7Components(w7));
  }
  return out;
};

/** Kind + Type + Bytes. Honesty stays gated. W7 attaches when it arrived. */
export const labEntityComponents = (entity: LabEntity): ReadonlyArray<Component> => {
  const declared = declarationComponents({
    kind: entity.kind,
    type: entity.type,
    bytes: entity.bytes,
  });
  if (entity.kind === 'activity') {
    const relations = activityComponents(
      relationsFromLabEntity(entity),
      entity.type,
      w7FromLabEntity(entity),
    ).filter((component) => component._tag !== 'Kind' && component._tag !== 'Type');
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

const optionalW7 = (input: ActivityW7): ActivityW7 | undefined => {
  if (
    input.who === undefined &&
    input.when === undefined &&
    input.where === undefined &&
    input.why === undefined &&
    input.how === undefined
  ) {
    return undefined;
  }
  return input;
};

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
    readonly who?: ReadonlyArray<Agent>;
    readonly when?: ProvenanceWhen;
    readonly where?: string;
    readonly why?: string;
    readonly how?: string;
  },
): Effect.Effect<CatalogRecord, CatalogError | EntityNotFoundError> => {
  const relations: ActivityRelations = {
    used: uniqueEntityRefs(input.used ?? []),
    generated: uniqueEntityRefs(input.generated ?? []),
    ...(input.supersedes !== undefined ? { supersedes: input.supersedes } : {}),
  };
  const w7 = optionalW7({
    ...(input.who !== undefined ? { who: input.who } : {}),
    ...(input.when !== undefined ? { when: input.when } : {}),
    ...(input.where !== undefined ? { where: input.where } : {}),
    ...(input.why !== undefined ? { why: input.why } : {}),
    ...(input.how !== undefined ? { how: input.how } : {}),
  });
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
      activityComponents(relations, input.type, w7),
    );
  });
};

/**
 * PR 92 `ActivityRepo.append` invariant, as a system:
 * refuse to rewrite a ref; corrections append a new one; attach Used/Generated/Supersedes and W7.
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

const listActivities = (
  state: EntityStateShape,
  matches: (row: CatalogRecord) => boolean,
): Effect.Effect<ReadonlyArray<CatalogRecord>, CatalogError> =>
  state.list('activity').pipe(Effect.map((rows) => rows.filter(matches)));

export const activitiesByRef = (
  state: EntityStateShape,
  ref: EntityRef,
): Effect.Effect<ReadonlyArray<CatalogRecord>, CatalogError> =>
  listActivities(
    state,
    (row) =>
      row.id === ref ||
      relationTargets(row.components, 'Used').includes(ref) ||
      relationTargets(row.components, 'Generated').includes(ref) ||
      relationTargets(row.components, 'Supersedes').includes(ref),
  );

export const activitiesByWho = (
  state: EntityStateShape,
  label: string,
): Effect.Effect<ReadonlyArray<CatalogRecord>, CatalogError> =>
  listActivities(state, (row) =>
    row.components.some((component) => component._tag === 'Who' && component.label === label),
  );

export const activitiesByWhy = (
  state: EntityStateShape,
  issue: string,
): Effect.Effect<ReadonlyArray<CatalogRecord>, CatalogError> =>
  listActivities(state, (row) =>
    row.components.some((component) => component._tag === 'Why' && component.value === issue),
  );

export const activitiesBySha = (
  state: EntityStateShape,
  gitSha: string,
): Effect.Effect<ReadonlyArray<CatalogRecord>, CatalogError> =>
  listActivities(state, (row) =>
    row.components.some(
      (component) =>
        (component._tag === 'When' && component.gitSha === gitSha) ||
        (component._tag === 'Bytes' && component.gitSha === gitSha),
    ),
  );

export const activitiesByWhen = (
  state: EntityStateShape,
  startedAt: string,
): Effect.Effect<ReadonlyArray<CatalogRecord>, CatalogError> =>
  listActivities(state, (row) =>
    row.components.some((component) => component._tag === 'When' && component.startedAt === startedAt),
  );

export const queryActivities = (
  state: EntityStateShape,
  query: ActivityQuery,
): Effect.Effect<ReadonlyArray<CatalogRecord>, CatalogError> => {
  if ('ref' in query) return activitiesByRef(state, query.ref);
  if ('who' in query) return activitiesByWho(state, query.who);
  if ('why' in query) return activitiesByWhy(state, query.why);
  if ('gitSha' in query) return activitiesBySha(state, query.gitSha);
  if ('startedAt' in query) return activitiesByWhen(state, query.startedAt);
  const _exhaustive: never = query;
  return _exhaustive;
};
