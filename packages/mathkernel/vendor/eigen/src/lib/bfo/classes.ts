import * as Schema from 'effect/Schema';

/**
 * BFO Continuant class literals (branded + annotated)
 */

export const BfoContinuant = Schema.Literal('continuant').pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/literals/Continuant'),
  Schema.annotations({
    description: 'BFO class: continuant (root of continuant hierarchy).',
  })
);
export type BfoContinuant = Schema.Schema.Type<typeof BfoContinuant>;

export const BfoIndependentContinuant = Schema.Literal(
  'independent_continuant'
).pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/literals/IndependentContinuant'),
  Schema.annotations({
    description: 'BFO class: independent continuant.',
  })
);
export type BfoIndependentContinuant = Schema.Schema.Type<
  typeof BfoIndependentContinuant
>;

export const BfoGenericallyIndependentContinuant = Schema.Literal(
  'generically_independent_continuant'
).pipe(
  Schema.brand(
    '@gbg/tmnl/v1/schemas/Bfo/v1/literals/GenericallyIndependentContinuant'
  ),
  Schema.annotations({
    description: 'BFO class: generically independent continuant.',
  })
);
export type BfoGenericallyIndependentContinuant = Schema.Schema.Type<
  typeof BfoGenericallyIndependentContinuant
>;

export const BfoSpecificallyDependentContinuant = Schema.Literal(
  'specifically_dependent_continuant'
).pipe(
  Schema.brand(
    '@gbg/tmnl/v1/schemas/Bfo/v1/literals/SpecificallyDependentContinuant'
  ),
  Schema.annotations({
    description: 'BFO class: specifically dependent continuant.',
  })
);
export type BfoSpecificallyDependentContinuant = Schema.Schema.Type<
  typeof BfoSpecificallyDependentContinuant
>;

export const BfoRealizableEntity = Schema.Literal('realizable_entity').pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/literals/RealizableEntity'),
  Schema.annotations({
    description:
      'BFO class: realizable entity (functions, roles, dispositions).',
  })
);
export type BfoRealizableEntity = Schema.Schema.Type<
  typeof BfoRealizableEntity
>;

export const BfoQuality = Schema.Literal('quality').pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/literals/Quality'),
  Schema.annotations({
    description: 'BFO class: quality (e.g., mass, color, length).',
  })
);
export type BfoQuality = Schema.Schema.Type<typeof BfoQuality>;

export const BfoDisposition = Schema.Literal('disposition').pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/literals/Disposition'),
  Schema.annotations({
    description: 'BFO class: disposition (e.g., fragility, solubility).',
  })
);
export type BfoDisposition = Schema.Schema.Type<typeof BfoDisposition>;

export const BfoRole = Schema.Literal('role').pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/literals/Role'),
  Schema.annotations({
    description: 'BFO class: role (context-dependent realizable entity).',
  })
);
export type BfoRole = Schema.Schema.Type<typeof BfoRole>;

export const BfoRelationalQuality = Schema.Literal('relational_quality').pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/literals/RelationalQuality'),
  Schema.annotations({
    description:
      'BFO class: relational quality (quality that relates multiple bearers).',
  })
);
export type BfoRelationalQuality = Schema.Schema.Type<
  typeof BfoRelationalQuality
>;

export const BfoFunction = Schema.Literal('function').pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/literals/Function'),
  Schema.annotations({
    description: 'BFO class: function (designed purpose of an entity).',
  })
);
export type BfoFunction = Schema.Schema.Type<typeof BfoFunction>;

export const BfoImmaterialEntity = Schema.Literal('immaterial_entity').pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/literals/ImmaterialEntity'),
  Schema.annotations({
    description: 'BFO class: immaterial entity.',
  })
);
export type BfoImmaterialEntity = Schema.Schema.Type<
  typeof BfoImmaterialEntity
>;

export const BfoMaterialEntity = Schema.Literal('material_entity').pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/literals/MaterialEntity'),
  Schema.annotations({
    description: 'BFO class: material entity.',
  })
);
export type BfoMaterialEntity = Schema.Schema.Type<typeof BfoMaterialEntity>;

export const BfoContinuantFiatBoundary = Schema.Literal(
  'continuant_fiat_boundary'
).pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/literals/ContinuantFiatBoundary'),
  Schema.annotations({
    description: 'BFO class: continuant fiat boundary.',
  })
);
export type BfoContinuantFiatBoundary = Schema.Schema.Type<
  typeof BfoContinuantFiatBoundary
>;

export const BfoSpatialRegion = Schema.Literal('spatial_region').pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/literals/SpatialRegion'),
  Schema.annotations({
    description: 'BFO class: spatial region.',
  })
);
export type BfoSpatialRegion = Schema.Schema.Type<typeof BfoSpatialRegion>;

export const BfoSite = Schema.Literal('site').pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/literals/Site'),
  Schema.annotations({
    description:
      'BFO class: site (immaterial entity located in a region of space).',
  })
);
export type BfoSite = Schema.Schema.Type<typeof BfoSite>;

export const BfoObjectEntityPart = Schema.Literal('object_entity_part').pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/literals/ObjectEntityPart'),
  Schema.annotations({
    description: 'BFO class: object entity part (fiat object part-like).',
  })
);
export type BfoObjectEntityPart = Schema.Schema.Type<
  typeof BfoObjectEntityPart
>;

export const BfoObjectEntityAggregate = Schema.Literal(
  'object_entity_aggregate'
).pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/literals/ObjectEntityAggregate'),
  Schema.annotations({
    description: 'BFO class: object entity aggregate (collection of objects).',
  })
);
export type BfoObjectEntityAggregate = Schema.Schema.Type<
  typeof BfoObjectEntityAggregate
>;

/**
 * Union of all BFO continuant classes
 */
export const BfoContinuantClasses = Schema.Union(
  BfoContinuant,
  BfoIndependentContinuant,
  BfoGenericallyIndependentContinuant,
  BfoSpecificallyDependentContinuant,
  BfoRealizableEntity,
  BfoQuality,
  BfoDisposition,
  BfoRole,
  BfoRelationalQuality,
  BfoFunction,
  BfoImmaterialEntity,
  BfoMaterialEntity,
  BfoContinuantFiatBoundary,
  BfoSpatialRegion,
  BfoSite,
  BfoObjectEntityPart,
  BfoObjectEntityAggregate
).pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/unions/BfoContinuantClasses'),
  Schema.annotations({
    description: 'Union of BFO continuant class literals.',
  })
);
export type BfoContinuantClasses = Schema.Schema.Type<
  typeof BfoContinuantClasses
>;

/**
 * BFO Occurrent class literals (branded + annotated)
 */

export const BfoOccurrent = Schema.Literal('occurrent').pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/literals/Occurrent'),
  Schema.annotations({
    description: 'BFO class: occurrent (root of occurrent hierarchy).',
  })
);
export type BfoOccurrent = Schema.Schema.Type<typeof BfoOccurrent>;

export const BfoProcess = Schema.Literal('process').pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/literals/Process'),
  Schema.annotations({
    description: 'BFO class: process.',
  })
);
export type BfoProcess = Schema.Schema.Type<typeof BfoProcess>;

export const BfoProcessBoundary = Schema.Literal('process_boundary').pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/literals/ProcessBoundary'),
  Schema.annotations({
    description: 'BFO class: process boundary.',
  })
);
export type BfoProcessBoundary = Schema.Schema.Type<typeof BfoProcessBoundary>;

export const BfoTemporalRegion = Schema.Literal('temporal_region').pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/literals/TemporalRegion'),
  Schema.annotations({
    description: 'BFO class: temporal region.',
  })
);
export type BfoTemporalRegion = Schema.Schema.Type<typeof BfoTemporalRegion>;

export const BfoSpatioTemporalRegion = Schema.Literal(
  'spatio_temporal_region'
).pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/literals/SpatioTemporalRegion'),
  Schema.annotations({
    description: 'BFO class: spatio-temporal region.',
  })
);
export type BfoSpatioTemporalRegion = Schema.Schema.Type<
  typeof BfoSpatioTemporalRegion
>;

export const BfoHistory = Schema.Literal('history').pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/literals/History'),
  Schema.annotations({
    description: 'BFO class: history (maximal occurrent for an entity).',
  })
);
export type BfoHistory = Schema.Schema.Type<typeof BfoHistory>;

export const BfoProcessProfile = Schema.Literal('process_profile').pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/literals/ProcessProfile'),
  Schema.annotations({
    description:
      'BFO class: process profile (cross-section / projection of a process).',
  })
);
export type BfoProcessProfile = Schema.Schema.Type<typeof BfoProcessProfile>;

/**
 * Union of all BFO occurrent classes
 */
export const BfoOccurentClasses = Schema.Union(
  BfoOccurrent,
  BfoProcess,
  BfoProcessBoundary,
  BfoTemporalRegion,
  BfoSpatioTemporalRegion,
  BfoHistory,
  BfoProcessProfile
).pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/unions/BfoOccurentClasses'),
  Schema.annotations({
    description: 'Union of BFO occurrent class literals.',
  })
);
export type BfoOccurentClasses = Schema.Schema.Type<typeof BfoOccurentClasses>;

/**
 * Union of all BFO base classes (continuant + occurrent)
 */
export const BfoBaseClasses = Schema.Union(
  BfoContinuantClasses,
  BfoOccurentClasses
).pipe(
  Schema.brand('@gbg/tmnl/v1/schemas/Bfo/v1/unions/BfoBaseClasses'),
  Schema.annotations({
    description:
      'Union of all BFO base class literals (continuant and occurrent).',
  })
);
export type BfoBaseClasses = Schema.Schema.Type<typeof BfoBaseClasses>;
