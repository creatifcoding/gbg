/**
 * AMS v2 BFO Class Literals
 *
 * Basic Formal Ontology class discriminators.
 * Ported from @/lib/bfo/classes.ts with consistent branding.
 *
 * @module @gbg/tmnl/ams/v2/core/schemas/bfo
 */

import { Schema } from 'effect'

// ─────────────────────────────────────────────────────────────────────────────
// Continuant Classes
// ─────────────────────────────────────────────────────────────────────────────

export const BfoContinuant = Schema.Literal('continuant').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/Continuant'),
  Schema.annotations({ description: 'BFO class: continuant (root)' })
)
export type BfoContinuant = typeof BfoContinuant.Type

export const BfoIndependentContinuant = Schema.Literal('independent_continuant').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/IndependentContinuant'),
  Schema.annotations({ description: 'BFO class: independent continuant' })
)
export type BfoIndependentContinuant = typeof BfoIndependentContinuant.Type

export const BfoGenericallyDependentContinuant = Schema.Literal('generically_dependent_continuant').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/GenericallyDependentContinuant'),
  Schema.annotations({ description: 'BFO class: generically dependent continuant' })
)
export type BfoGenericallyDependentContinuant = typeof BfoGenericallyDependentContinuant.Type

export const BfoSpecificallyDependentContinuant = Schema.Literal('specifically_dependent_continuant').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/SpecificallyDependentContinuant'),
  Schema.annotations({ description: 'BFO class: specifically dependent continuant' })
)
export type BfoSpecificallyDependentContinuant = typeof BfoSpecificallyDependentContinuant.Type

export const BfoRealizableEntity = Schema.Literal('realizable_entity').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/RealizableEntity'),
  Schema.annotations({ description: 'BFO class: realizable entity' })
)
export type BfoRealizableEntity = typeof BfoRealizableEntity.Type

export const BfoQuality = Schema.Literal('quality').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/Quality'),
  Schema.annotations({ description: 'BFO class: quality' })
)
export type BfoQuality = typeof BfoQuality.Type

export const BfoDisposition = Schema.Literal('disposition').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/Disposition'),
  Schema.annotations({ description: 'BFO class: disposition' })
)
export type BfoDisposition = typeof BfoDisposition.Type

export const BfoRole = Schema.Literal('role').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/Role'),
  Schema.annotations({ description: 'BFO class: role' })
)
export type BfoRole = typeof BfoRole.Type

export const BfoFunction = Schema.Literal('function').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/Function'),
  Schema.annotations({ description: 'BFO class: function' })
)
export type BfoFunction = typeof BfoFunction.Type

export const BfoRelationalQuality = Schema.Literal('relational_quality').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/RelationalQuality'),
  Schema.annotations({ description: 'BFO class: relational quality' })
)
export type BfoRelationalQuality = typeof BfoRelationalQuality.Type

export const BfoImmaterialEntity = Schema.Literal('immaterial_entity').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/ImmaterialEntity'),
  Schema.annotations({ description: 'BFO class: immaterial entity' })
)
export type BfoImmaterialEntity = typeof BfoImmaterialEntity.Type

export const BfoMaterialEntity = Schema.Literal('material_entity').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/MaterialEntity'),
  Schema.annotations({ description: 'BFO class: material entity' })
)
export type BfoMaterialEntity = typeof BfoMaterialEntity.Type

export const BfoContinuantFiatBoundary = Schema.Literal('continuant_fiat_boundary').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/ContinuantFiatBoundary'),
  Schema.annotations({ description: 'BFO class: continuant fiat boundary' })
)
export type BfoContinuantFiatBoundary = typeof BfoContinuantFiatBoundary.Type

export const BfoSpatialRegion = Schema.Literal('spatial_region').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/SpatialRegion'),
  Schema.annotations({ description: 'BFO class: spatial region' })
)
export type BfoSpatialRegion = typeof BfoSpatialRegion.Type

export const BfoSite = Schema.Literal('site').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/Site'),
  Schema.annotations({ description: 'BFO class: site' })
)
export type BfoSite = typeof BfoSite.Type

export const BfoObject = Schema.Literal('object').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/Object'),
  Schema.annotations({ description: 'BFO class: object' })
)
export type BfoObject = typeof BfoObject.Type

export const BfoObjectAggregate = Schema.Literal('object_aggregate').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/ObjectAggregate'),
  Schema.annotations({ description: 'BFO class: object aggregate' })
)
export type BfoObjectAggregate = typeof BfoObjectAggregate.Type

export const BfoFiatObjectPart = Schema.Literal('fiat_object_part').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/FiatObjectPart'),
  Schema.annotations({ description: 'BFO class: fiat object part' })
)
export type BfoFiatObjectPart = typeof BfoFiatObjectPart.Type

// ─────────────────────────────────────────────────────────────────────────────
// Occurrent Classes
// ─────────────────────────────────────────────────────────────────────────────

export const BfoOccurrent = Schema.Literal('occurrent').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/Occurrent'),
  Schema.annotations({ description: 'BFO class: occurrent (root)' })
)
export type BfoOccurrent = typeof BfoOccurrent.Type

export const BfoProcess = Schema.Literal('process').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/Process'),
  Schema.annotations({ description: 'BFO class: process' })
)
export type BfoProcess = typeof BfoProcess.Type

export const BfoProcessBoundary = Schema.Literal('process_boundary').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/ProcessBoundary'),
  Schema.annotations({ description: 'BFO class: process boundary' })
)
export type BfoProcessBoundary = typeof BfoProcessBoundary.Type

export const BfoTemporalRegion = Schema.Literal('temporal_region').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/TemporalRegion'),
  Schema.annotations({ description: 'BFO class: temporal region' })
)
export type BfoTemporalRegion = typeof BfoTemporalRegion.Type

export const BfoSpatioTemporalRegion = Schema.Literal('spatio_temporal_region').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/SpatioTemporalRegion'),
  Schema.annotations({ description: 'BFO class: spatio-temporal region' })
)
export type BfoSpatioTemporalRegion = typeof BfoSpatioTemporalRegion.Type

export const BfoHistory = Schema.Literal('history').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/History'),
  Schema.annotations({ description: 'BFO class: history' })
)
export type BfoHistory = typeof BfoHistory.Type

export const BfoProcessProfile = Schema.Literal('process_profile').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/ProcessProfile'),
  Schema.annotations({ description: 'BFO class: process profile' })
)
export type BfoProcessProfile = typeof BfoProcessProfile.Type

// ─────────────────────────────────────────────────────────────────────────────
// Unions
// ─────────────────────────────────────────────────────────────────────────────

export const BfoContinuantClasses = Schema.Union(
  BfoContinuant,
  BfoIndependentContinuant,
  BfoGenericallyDependentContinuant,
  BfoSpecificallyDependentContinuant,
  BfoRealizableEntity,
  BfoQuality,
  BfoDisposition,
  BfoRole,
  BfoFunction,
  BfoRelationalQuality,
  BfoImmaterialEntity,
  BfoMaterialEntity,
  BfoContinuantFiatBoundary,
  BfoSpatialRegion,
  BfoSite,
  BfoObject,
  BfoObjectAggregate,
  BfoFiatObjectPart
).pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/unions/ContinuantClasses'),
  Schema.annotations({ description: 'Union of BFO continuant class literals' })
)
export type BfoContinuantClasses = typeof BfoContinuantClasses.Type

export const BfoOccurrentClasses = Schema.Union(
  BfoOccurrent,
  BfoProcess,
  BfoProcessBoundary,
  BfoTemporalRegion,
  BfoSpatioTemporalRegion,
  BfoHistory,
  BfoProcessProfile
).pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/unions/OccurrentClasses'),
  Schema.annotations({ description: 'Union of BFO occurrent class literals' })
)
export type BfoOccurrentClasses = typeof BfoOccurrentClasses.Type

export const BfoBaseClasses = Schema.Union(
  BfoContinuantClasses,
  BfoOccurrentClasses
).pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/unions/BaseClasses'),
  Schema.annotations({ description: 'Union of all BFO base class literals' })
)
export type BfoBaseClasses = typeof BfoBaseClasses.Type
