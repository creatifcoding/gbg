import { Effect, Option, Console, Cause } from 'effect'
import { PgClient } from '@effect/sql-pg'
import { Redacted, Layer } from 'effect'
import { PlantRepo, PlantRepoLive } from './src/lib/iiot/repos/PlantRepo'
import type { PlantId, EnterpriseId, SiteId, AreaId } from './src/lib/iiot/schemas/identifiers'

const TestPgClient = PgClient.layer({
  host: 'localhost',
  port: 5433,
  database: 'iiot_mock',
  username: 'iiot',
  password: Redacted.make('iiot_dev'),
  maxConnections: 5,
  transformResultNames: (col: string) => col.replace(/_([a-z])/g, (_, char) => char.toUpperCase()),
})

const testInsert = {
  id: 'TEST-PLANT-003' as PlantId,
  name: 'Test Plant Gamma' as const,
  status: 'active' as const,
  hierarchyPath: '/TEST-ENT-001/TEST-SIT-001/TEST-PLANT-003',
  enterpriseId: 'TEST-ENT-001' as EnterpriseId,
  siteId: Option.some('TEST-SIT-001' as SiteId),
  areaId: Option.none<AreaId>(),
  timezone: 'America/Denver',
  description: Option.none<string>(),
  siteCode: Option.none<string>(),
  location: Option.none<unknown>(),
  metadata: Option.none<Record<string, unknown>>(),
}

const program = Effect.gen(function* () {
  const plantRepo = yield* PlantRepo
  yield* Console.log('Inserting plant...')
  const result = yield* plantRepo.insert(testInsert)
  yield* Console.log('Result:', result)
  return result
}).pipe(
  Effect.tapErrorCause((cause) => Console.log('Error cause:', Cause.pretty(cause)))
)

const layer = PlantRepoLive.pipe(Layer.provide(TestPgClient))

Effect.runPromise(program.pipe(Effect.provide(layer)))
  .then(r => console.log('Success:', r))
  .catch(e => console.error('Failed:', e))
