import { Schema } from 'effect';
import { BfoBaseClasses, BfoContinuantClasses } from '@/lib/bfo/classes';

/**/
/* TODO: Implement a utility that assembles canonical tags. (e.g. assembleCanonicalTag({  })). */
/* assembleCanonicalTag needs to be able to, possibly via Type inference, infer the 'path hiearchy', */
/* and allow for arbitrary emplacement of tags within that recognized hiearchy.
 */

export const EntityIdentifier = Schema.Union(
  Schema.UUID.pipe(
    Schema.brand('EntityIdentifier'),
    Schema.annotations({
      description: 'Entity identifier as UUID',
    })
  ),
  Schema.String.pipe(
    Schema.brand('EntityIdentifier'),
    Schema.annotations({
      description:
        'Entity identifier as string (e.g., solicitation number, SAM notice ID)',
    })
  ),
  Schema.Number.pipe(
    Schema.brand('EntityIdentifier'),
    Schema.annotations({
      description: 'Entity identifier as number',
    })
  )
).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/v1/schemas/EntityIdentifier',
    description:
      'Flexible entity identifier supporting UUID, string, or number formats',
  })
);

export const CreatedAt = Schema.DateTimeUtc.pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/BfoEntity/v1/fields/CreatedAt'),
  Schema.annotations({
    description: 'The date the opportunity was created',
  })
);

export const UpdatedAt = Schema.DateTimeUtc.pipe(
  Schema.brand('@gbg/tmnl/schemas/BfoEntity/v1/fields/UpdatedAt'),
  Schema.annotations({
    description: 'The date the opportunity was updated',
  })
);

export type EntityIdentifier = Schema.Schema.Type<typeof EntityIdentifier>;
export type CreatedAt = Schema.Schema.Type<typeof CreatedAt>;
export type UpdatedAt = Schema.Schema.Type<typeof UpdatedAt>;

export class BfoEntity extends Schema.Class<BfoEntity>('BfoEntity')({
  id: EntityIdentifier,
  created_at: CreatedAt,
  updated_at: UpdatedAt,
  bfo_base_class: BfoBaseClasses
}) {}

export class Continuant extends BfoEntity.extend<Continuant>('Continuant')(
  {
    bfo_base_class: BfoContinuantClasses
  }
) {}

export type BfoContinuant = Schema.Schema.Type<typeof Continuant>

export class IndependentContinuant extends Continuant.extend<IndependentContinuant>(
  'IndependentContinuant'
)({}) {}
export class GenericallyDependentContinuant extends Continuant.extend<GenericallyDependentContinuant>(
  'GenericallyDependentContinuant'
)({}) {}
export class SpecificallyDependentContinuant extends Continuant.extend<GenericallyDependentContinuant>(
  'GenericallyDependentContinuant'
)({}) {}

export class RelizableEntity extends SpecificallyDependentContinuant.extend<GenericallyDependentContinuant>(
  'GenericallyDependentContinuant'
)({}) {}
export class Quality extends SpecificallyDependentContinuant.extend<GenericallyDependentContinuant>(
  'GenericallyDependentContinuant'
)({}) {}

export class Disposition extends RelizableEntity.extend<Disposition>(
  'Disposition'
)({}) {}
export class Role extends RelizableEntity.extend<Role>('Role')({}) {}

export class RelationalQuality extends Quality.extend<RelationalQuality>(
  'RelationalQuality'
)({}) {}

export class Function extends Disposition.extend<Function>('Function')({}) {}

export class ImmaterialEntity extends IndependentContinuant.extend<ImmaterialEntity>(
  'ImmaterialEntity'
)({}) {}
export class MaterialEntity extends IndependentContinuant.extend<MaterialEntity>(
  'MaterialEntity'
)({}) {}

/**/
/* TODO: Find a flexible, mixin friendly way for define 1-3 dimensional ContinuantFiatBoundaries/SpatialRegion
 */
export class ContinuantFiatBoundary extends ImmaterialEntity.extend<ContinuantFiatBoundary>(
  'ContinuantFiatBoundary'
)({}) {}
export class SpatialRegion extends ImmaterialEntity.extend<SpatialRegion>(
  'SpatialRegion'
)({}) {}
export class Site extends ImmaterialEntity.extend<Site>('Site')({}) {}

export class ObjectEntity extends MaterialEntity.extend<ObjectEntity>(
  'ObjectEntity'
)({}) {}
export class ObjectEntityPart extends MaterialEntity.extend<ObjectEntityPart>(
  'ObjectEntityPart'
)({}) {}


/*
* A material entity consisting exactly of a plurality of objects as parts which may move independently in space
* and which are  not causally unified
*
*An object aggregate is a collection of separate objects. Thus not every collection of objects is an
*    object aggregate. (The collection of atoms in a lump of iron is not an object aggregate.) An object
*    aggregate may be defined by fiat – for example in the case of the aggregate of members of an
*    organization. Object aggregates in such cases may gain and lose object parts while remaining
*    identical.
*/
export class ObjectEntityAggregate extends MaterialEntity.extend<ObjectEntityAggregate>(
  'ObjectEntityAggregate'
)({}) {}

export class Occurent extends BfoEntity.extend<Occurent>('Occurent')({}) {}


export class ProcessBoundary extends Occurent.extend<ProcessBoundary>('ProcessBoundary')({}) {}
export class Process extends Occurent.extend<Process>('Process')({}) {}
export class SpatioTemporalRegion extends Occurent.extend<SpatioTemporalRegion>('SpatioTemporalRegion')({}) {}
export class TemporalRegion extends Occurent.extend<TemporalRegion>('TemporalRegion')({}) {}


export class History extends Process.extend<History>('History')({}) {}
export class ProcessProfile extends Process.extend<ProcessProfile>('ProcessProfile')({}) {}



export class Asset extends ObjectEntity.extend<Asset>('Asset')({}) {}
export class AssetTrait extends .extend<AssetTrait>('AssetTrait')(
  {}
) {}
export class AssetProperty extends Continuant.extend<AssetProperty>(
  'AssetProperty'
)({}) {}
