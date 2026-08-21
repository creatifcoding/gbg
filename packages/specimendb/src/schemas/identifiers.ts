/**
 * Branded identifiers for the specimen catalog and lab provenance refs.
 *
 * Compact lab refs: `gbg:<kind>:<local>@<rev>`. `@<rev>` is a citation
 * (PR number or git SHA), not a second identity. `gbg:specimen:<id>` maps
 * onto {@link SpecimenId}; do not fork that brand.
 *
 * @module @tmnl/specimendb/schemas/identifiers
 */

import * as Schema from 'effect/Schema';

export const SpecimenId = Schema.String.pipe(
  Schema.brand('SpecimenId'),
);
export type SpecimenId = typeof SpecimenId.Type;

export const trustSpecimenId = (id: string): SpecimenId => id as SpecimenId;

export const ComponentId = Schema.String.pipe(Schema.brand('ComponentId'));
export type ComponentId = typeof ComponentId.Type;

export const trustComponentId = (id: string): ComponentId => id as ComponentId;

/**
 * `gbg:<kind>:<local>` with optional `@<rev>`.
 * Local may contain colons (`gbg:run:doctor:<run-id>`).
 */
export const ENTITY_REF_PATTERN =
  /^gbg:([a-z][a-z0-9-]*):([A-Za-z0-9._:-]+)(?:@([A-Za-z0-9._-]+))?$/;

export const EntityRef = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isPattern(ENTITY_REF_PATTERN),
).pipe(
  Schema.brand('EntityRef'),
);
export type EntityRef = typeof EntityRef.Type;

export const trustEntityRef = (ref: string): EntityRef => ref as EntityRef;

export type ParsedEntityRef = {
  readonly kind: string;
  readonly local: string;
  readonly rev: string | undefined;
};

export const parseEntityRef = (ref: string): ParsedEntityRef | undefined => {
  const match = ENTITY_REF_PATTERN.exec(ref);
  if (match === null || match[1] === undefined || match[2] === undefined) {
    return undefined;
  }
  return { kind: match[1], local: match[2], rev: match[3] };
};

/** Map an existing catalog id onto a compact specimen ref. Does not mint a new brand. */
export const specimenRefFromId = (id: SpecimenId): EntityRef =>
  trustEntityRef(`gbg:specimen:${id}`);

/** Inverse of {@link specimenRefFromId}. Undefined if the ref is not a specimen. */
export const specimenIdFromRef = (ref: EntityRef): SpecimenId | undefined => {
  const parsed = parseEntityRef(ref);
  if (parsed === undefined || parsed.kind !== 'specimen') return undefined;
  return trustSpecimenId(parsed.local);
};
