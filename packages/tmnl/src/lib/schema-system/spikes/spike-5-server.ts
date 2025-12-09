/**
 * SPIKE 5 SERVER: Minimal GraphQL subgraph for introspection testing
 *
 * This server loads the sensor-service SDL and serves it as a live
 * GraphQL endpoint that supports introspection queries.
 *
 * USAGE:
 *   # Start the server:
 *   bunx tsx src/lib/schema-system/spikes/spike-5-server.ts [port]
 *
 *   # Default: http://localhost:4011/graphql
 *
 * @module
 */

import { createServer } from 'http'
import { createYoga, createSchema } from 'graphql-yoga'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load SDL from Spike 3's sensor-service
const SDL_PATH = join(__dirname, '../cosmo/sensor-service/src/graph/schema.graphql')

function loadSDL(): string {
  try {
    return readFileSync(SDL_PATH, 'utf-8')
  } catch (e) {
    console.error(`Failed to load SDL from ${SDL_PATH}`)
    console.error('Hint: Run spike-3 first to generate the SDL')
    process.exit(1)
  }
}

// Mock data for resolvers
const mockSensors = [
  { id: 'temp-01', name: 'Temperature Sensor', unit: 'Cel', lastReading: { n: 'temperature', v: 23.5, u: 'Cel', t: Date.now() / 1000 } },
  { id: 'hum-01', name: 'Humidity Sensor', unit: '%RH', lastReading: { n: 'humidity', v: 65.2, u: '%RH', t: Date.now() / 1000 } },
  { id: 'pres-01', name: 'Pressure Sensor', unit: 'hPa', lastReading: { n: 'pressure', v: 1013.25, u: 'hPa', t: Date.now() / 1000 } },
]

const mockHistory: Record<string, Array<{ n: string; v: number; u: string; t: number }>> = {
  'temp-01': [
    { n: 'temperature', v: 23.5, u: 'Cel', t: Date.now() / 1000 },
    { n: 'temperature', v: 23.2, u: 'Cel', t: Date.now() / 1000 - 60 },
    { n: 'temperature', v: 22.9, u: 'Cel', t: Date.now() / 1000 - 120 },
  ],
  'hum-01': [
    { n: 'humidity', v: 65.2, u: '%RH', t: Date.now() / 1000 },
    { n: 'humidity', v: 64.8, u: '%RH', t: Date.now() / 1000 - 60 },
  ],
}

// Create resolvers
const resolvers = {
  Query: {
    listSensors: () => mockSensors,
    getSensorReading: (_: unknown, args: { sensorId: string }) => {
      const sensor = mockSensors.find((s) => s.id === args.sensorId)
      return sensor?.lastReading ?? null
    },
    getSensorHistory: (_: unknown, args: { sensorId: string; limit?: number }) => {
      const history = mockHistory[args.sensorId] ?? []
      return history.slice(0, args.limit ?? 10)
    },
  },
  Mutation: {
    publishReading: (_: unknown, args: { input: { n: string; v?: number; vs?: string; vb?: boolean; u?: string } }) => ({
      n: args.input.n,
      v: args.input.v,
      vs: args.input.vs,
      vb: args.input.vb,
      u: args.input.u,
      t: Date.now() / 1000,
    }),
  },
  Sensor: {
    lastReading: (parent: { id: string }) => {
      const sensor = mockSensors.find((s) => s.id === parent.id)
      return sensor?.lastReading ?? null
    },
  },
}

// Main
async function main() {
  const port = parseInt(process.argv[2] || '4011', 10)
  const sdl = loadSDL()

  console.log('─'.repeat(60))
  console.log('SPIKE 5 SERVER: GraphQL Subgraph for Introspection Testing')
  console.log('─'.repeat(60))
  console.log(`Loading SDL from: ${SDL_PATH}`)

  const schema = createSchema({
    typeDefs: sdl,
    resolvers,
  })

  const yoga = createYoga({
    schema,
    graphqlEndpoint: '/graphql',
    landingPage: false,
  })

  const server = createServer(yoga)

  server.listen(port, () => {
    console.log(`\n✓ Server running at http://localhost:${port}/graphql`)
    console.log('\nSupported operations:')
    console.log('  - Introspection queries')
    console.log('  - Query.listSensors')
    console.log('  - Query.getSensorReading(sensorId)')
    console.log('  - Query.getSensorHistory(sensorId, limit)')
    console.log('  - Mutation.publishReading(input)')
    console.log('\nPress Ctrl+C to stop')
  })
}

main().catch(console.error)
