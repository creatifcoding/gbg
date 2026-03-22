import { Layer, Redacted } from 'effect'
import { PgClient, PgMigrator } from '@effect/sql-pg'
import { geointMigrationLoader } from './_migrations'

/**
 * GEOINT registry migrator layer.
 *
 * Uses a dedicated migration tracking table to avoid collision with
 * IIoT / Genifer migration timelines in the shared tmnl database.
 */
export const GeointMigratorLive = PgMigrator.layer({
  loader: geointMigrationLoader,
  table: 'geoint_migrations',
})

export const createGeointDbLayer = (config: PgClient.PgClientConfig) => {
  const PgClientLive = PgClient.layer(config)
  const MigratorLive = GeointMigratorLive.pipe(Layer.provide(PgClientLive))

  return Layer.merge(PgClientLive, MigratorLive)
}

export const GeointDevDatabaseConfig: PgClient.PgClientConfig = {
  host: 'localhost',
  port: 5432,
  database: 'tmnl',
  username: 'tmnl',
  password: Redacted.make('tmnl_dev_password'),
  maxConnections: 5,
}

export const GeointDevDbLayer = createGeointDbLayer(GeointDevDatabaseConfig)
