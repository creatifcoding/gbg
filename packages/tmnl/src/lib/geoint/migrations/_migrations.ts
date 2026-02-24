import { Effect } from 'effect'
import { Migrator } from '@effect/sql'
import {
  createRegistryInfrastructure,
  seedSourceAliases,
  seedSourceRegistry,
  seedSourceTaxonomy,
  grantRegistryPermissions,
} from './_registry.ddl'

/**
 * GEOINT registry migrations using Effect-SQL Migrator.fromRecord.
 *
 * Focus: persist source taxonomy + STAC-aware source registry contracts
 * into durable PostgreSQL tables under geoint_registry schema.
 */
export const geointMigrations = {
  '0001_registry_infrastructure': createRegistryInfrastructure,
  '0002_source_taxonomy_seed': seedSourceTaxonomy,
  '0003_source_registry_seed': seedSourceRegistry,
  '0004_source_alias_seed': seedSourceAliases,
  '0005_registry_permissions': grantRegistryPermissions,
} as const

export const geointMigrationLoader = Migrator.fromRecord(geointMigrations)

export type GeointMigrationKey = keyof typeof geointMigrations
