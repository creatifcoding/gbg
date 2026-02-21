#!/usr/bin/env bun
/**
 * Genifer Persistence E2E Spike
 *
 * Proves save → load round-trip against live tmnl_postgres.
 *
 * Usage: bun run scripts/spikes/spike-genifer-persistence.ts
 */

import { Effect, Layer, HashMap, Option, Console, Redacted } from 'effect'
import { PgClient } from '@effect/sql-pg'
import { UITree, UIElement } from '../../src/lib/genifer/core/schemas'
import {
  GeniferTreeRepoLive,
  GeniferElementRepoLive,
  GeniferSignalRepoLive,
  GeniferPersistenceLive,
  GeniferPersistence,
} from '../../src/lib/genifer/repos'

// =============================================================================
// Build a test UITree
// =============================================================================

const testTree = (() => {
  const root = new UIElement({
    key: 'dashboard-root',
    type: 'VStack',
    props: { gap: 16 },
    children: ['heading', 'search-bar', 'grid'],
    parentKey: null,
    className: 'min-h-screen bg-gray-900 p-8',
  })

  const heading = new UIElement({
    key: 'heading',
    type: 'Heading',
    props: { text: 'Mission Control', level: 1 },
    children: [],
    parentKey: 'dashboard-root',
    className: 'text-3xl font-bold text-white',
  })

  const searchBar = new UIElement({
    key: 'search-bar',
    type: 'TextInput',
    props: { placeholder: 'Search...', variant: 'outlined' },
    children: [],
    parentKey: 'dashboard-root',
    role: 'search',
    ariaLabel: 'Search dashboard',
  })

  const grid = new UIElement({
    key: 'grid',
    type: 'Grid',
    props: { template: '1fr 1fr 1fr', gap: 12 },
    children: ['card-1', 'card-2', 'card-3'],
    parentKey: 'dashboard-root',
    className: 'mt-4',
  })

  const card1 = new UIElement({
    key: 'card-1',
    type: 'Card',
    props: { title: 'Users', value: 1234 },
    children: [],
    parentKey: 'grid',
  })

  const card2 = new UIElement({
    key: 'card-2',
    type: 'Card',
    props: { title: 'Revenue', value: 56789 },
    children: [],
    parentKey: 'grid',
  })

  const card3 = new UIElement({
    key: 'card-3',
    type: 'Card',
    props: { title: 'Growth', value: 12.5 },
    children: [],
    parentKey: 'grid',
  })

  let elements = HashMap.empty<string, UIElement>()
  for (const elem of [root, heading, searchBar, grid, card1, card2, card3]) {
    elements = HashMap.set(elements, elem.key, elem)
  }

  return new UITree({ root: 'dashboard-root', elements })
})()

// =============================================================================
// Main
// =============================================================================

const program = Effect.gen(function* () {
  const persistence = yield* GeniferPersistence

  yield* Console.log('╔══════════════════════════════════════════════╗')
  yield* Console.log('║   Genifer Persistence E2E Spike              ║')
  yield* Console.log('╚══════════════════════════════════════════════╝')
  yield* Console.log('')

  // --- SAVE ---
  yield* Console.log('▸ Saving UITree (7 elements)...')
  const start = Date.now()

  const result = yield* persistence.saveTree({
    tree: testTree,
    prompt: 'project status dashboard with search',
    qualityScore: 0.92,
    repairCount: 1,
    durationMs: 4200,
    model: 'claude-sonnet-4',
    threadId: 'spike-thread-001',
  })

  const saveMs = Date.now() - start
  yield* Console.log(`  ✓ Saved: treeId=${result.treeId}, ${result.elementCount} elements (${saveMs}ms)`)
  yield* Console.log('')

  // --- LOAD ---
  yield* Console.log('▸ Loading UITree back...')
  const loadStart = Date.now()

  const loaded = yield* persistence.loadTree(result.treeId)
  const loadMs = Date.now() - loadStart

  if (Option.isNone(loaded)) {
    yield* Console.log('  ✗ Tree not found!')
    return
  }

  const { tree, prompt, qualityScore, model, threadId } = loaded.value
  yield* Console.log(`  ✓ Loaded: ${tree.size} elements (${loadMs}ms)`)
  yield* Console.log(`    prompt: "${prompt}"`)
  yield* Console.log(`    quality: ${qualityScore}`)
  yield* Console.log(`    model: ${model}`)
  yield* Console.log(`    threadId: ${threadId}`)
  yield* Console.log('')

  // --- VERIFY ---
  yield* Console.log('▸ Verifying round-trip integrity...')

  // Check element count
  const sameCount = tree.size === testTree.size
  yield* Console.log(`  ${sameCount ? '✓' : '✗'} Element count: ${tree.size} === ${testTree.size}`)

  // Check root key
  const sameRoot = tree.root === testTree.root
  yield* Console.log(`  ${sameRoot ? '✓' : '✗'} Root key: "${tree.root}" === "${testTree.root}"`)

  // Check each element exists and has correct type
  let allMatch = true
  for (const [key, original] of testTree.elements) {
    const loaded = tree.getElementUnsafe(key)
    if (!loaded) {
      yield* Console.log(`  ✗ Missing element: ${key}`)
      allMatch = false
      continue
    }
    if (loaded.type !== original.type) {
      yield* Console.log(`  ✗ Type mismatch for ${key}: ${loaded.type} !== ${original.type}`)
      allMatch = false
    }
    if (loaded.className !== original.className) {
      yield* Console.log(`  ✗ className mismatch for ${key}: "${loaded.className}" !== "${original.className}"`)
      allMatch = false
    }
    if (loaded.parentKey !== original.parentKey) {
      yield* Console.log(`  ✗ parentKey mismatch for ${key}: "${loaded.parentKey}" !== "${original.parentKey}"`)
      allMatch = false
    }
  }
  yield* Console.log(`  ${allMatch ? '✓' : '✗'} All elements match`)

  // Check specific props
  const headingElem = tree.getElementUnsafe('heading')
  const headingText = headingElem?.props?.text
  yield* Console.log(`  ${headingText === 'Mission Control' ? '✓' : '✗'} Heading text: "${headingText}"`)

  const searchElem = tree.getElementUnsafe('search-bar')
  yield* Console.log(`  ${searchElem?.role === 'search' ? '✓' : '✗'} ARIA role preserved: "${searchElem?.role}"`)
  yield* Console.log(`  ${searchElem?.ariaLabel === 'Search dashboard' ? '✓' : '✗'} ARIA label preserved: "${searchElem?.ariaLabel}"`)

  yield* Console.log('')
  yield* Console.log(sameCount && sameRoot && allMatch ? '🎉 Round-trip SUCCESS' : '❌ Round-trip FAILED')
})

// =============================================================================
// Layer composition
// =============================================================================

const PgClientLive = PgClient.layer({
  host: 'localhost',
  port: 5432,
  database: 'tmnl',
  username: 'tmnl',
  password: Redacted.make('tmnl_dev_password'),
  maxConnections: 5,
})

const RepoLayer = Layer.mergeAll(
  GeniferTreeRepoLive,
  GeniferElementRepoLive,
  GeniferSignalRepoLive,
).pipe(Layer.provide(PgClientLive))

const PersistenceLayer = GeniferPersistenceLive.pipe(Layer.provide(RepoLayer))

const AppLive = Layer.merge(PgClientLive, PersistenceLayer)

Effect.runPromise(
  program.pipe(Effect.provide(AppLive))
).then(
  () => process.exit(0),
  (err) => {
    console.error('Spike failed:', err)
    process.exit(1)
  }
)
