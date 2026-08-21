/**
 * Catalog tags. Named exports only — no hardcoded schema/RPC/service strings
 * elsewhere. Shape mined from tmnl iiot `tags.ts`. Not ISA-95.
 *
 * @module @tmnl/specimendb/tags
 */

export const CatalogEntityTag = 'CatalogEntity' as const;
export const ComponentTag = 'Component' as const;
export const SpecimenTag = 'Specimen' as const;
export const ActivityTag = 'Activity' as const;

export const IntakeTag = 'Intake' as const;
export const GetTag = 'Get' as const;
export const ListTag = 'List' as const;
export const PromoteTag = 'Promote' as const;
export const AttachTag = 'Attach' as const;
export const MintActivityTag = 'MintActivity' as const;
export const MintEntityTag = 'MintEntity' as const;
export const ExportTag = 'Export' as const;
export const ProjectTag = 'Project' as const;
export const DoctorTag = 'Doctor' as const;
export const AppendActivityTag = 'AppendActivity' as const;
export const GetByRefTag = 'GetByRef' as const;

export const GetEntityTag = 'GetEntity' as const;
export const ListEntitiesTag = 'ListEntities' as const;
export const GetComponentsTag = 'GetComponents' as const;

export const EntityStateTag = '@tmnl/specimendb/EntityState' as const;
export const IntakeAdapterTag = '@tmnl/specimendb/IntakeAdapter' as const;
export const EntityRepoTag = '@tmnl/specimendb/EntityRepo' as const;
export const ComponentRepoTag = '@tmnl/specimendb/ComponentRepo' as const;
export const CatalogConfigTagName = '@tmnl/specimendb/Config' as const;

export type CatalogEntityTag = typeof CatalogEntityTag;
export type IntakeTag = typeof IntakeTag;
export type GetTag = typeof GetTag;
export type ListTag = typeof ListTag;
export type PromoteTag = typeof PromoteTag;
export type AttachTag = typeof AttachTag;
export type MintActivityTag = typeof MintActivityTag;
export type MintEntityTag = typeof MintEntityTag;
export type ExportTag = typeof ExportTag;
export type ProjectTag = typeof ProjectTag;
export type DoctorTag = typeof DoctorTag;
export type AppendActivityTag = typeof AppendActivityTag;
export type GetByRefTag = typeof GetByRefTag;
