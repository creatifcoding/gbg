#!/usr/bin/env bun
/**
 * Genifer Service E2E Spike
 *
 * Proves all GeniferService operations work against live postgres.
 * Exercises: save, load, list, rate, subtree, composites, signals.
 *
 * Usage: bun run scripts/spikes/spike-genifer-service.ts
 */

import { Effect, Layer, HashMap, Option, Console, Redacted } from 'effect'
import { PgClient } from '@effect/sql-pg'
import { UITree, UIElement } from '../../src/lib/genifer/core/schemas'
import { GeniferService, GeniferServiceLive } from '../../src/lib/genifer/services'

// =============================================================================
// Test UITree
// =============================================================================

function makeTestTree() {
  const els = [
    new UIElement({ key: 'root', type: 'VStack', props: { gap: 16 }, children: ['h1', 'grid'], parentKey: null, className: 'p-8 bg-gray-900' }),
    new UIElement({ key: 'h1', type: 'Heading', props: { text: 'Dashboard', level: 1 }, children: [], parentKey: 'root' }),
    new UIElement({ key: 'grid', type: 'Grid', props: { template: '1fr 1fr' }, children: ['card-a', 'card-b'], parentKey: 'root', className: 'gap-4' }),
    new UIElement({ key: 'card-a', type: 'Card', props: { title: 'Users' }, children: [], parentKey: 'grid' }),
    new UIElement({ key: 'card-b', type: 'Card', props: { title: 'Revenue' }, children: [], parentKey: 'grid' }),
  ]
  let m = HashMap.empty<string, UIElement>()
  for (const e of els) m = HashMap.set(m, e.key, e)
  return new UITree({ root: 'root', elements: m })
}

// =============================================================================
// Main
// =============================================================================

const program = Effect.gen(function* () {
  const svc = yield* GeniferService

  yield* Console.log('╔═══════════════════════════════════════════════╗')
  yield* Console.log('║   GeniferService E2E Spike                    ║')
  yield* Console.log('╚═══════════════════════════════════════════════╝')
  yield* Console.log('')

  // --- saveTree ---
  yield* Console.log('▸ saveTree (5 elements)')
  const saved = yield* svc.saveTree({
    tree: makeTestTree(),
    prompt: 'dashboard with users and revenue cards',
    qualityScore: 0.88,
    repairCount: 0,
    durationMs: 3500,
    model: 'gpt-5.2',
    threadId: 'service-spike-001',
  })
  yield* Console.log(`  ✓ treeId=${saved.treeId}, ${saved.elementCount} elements`)

  // --- loadTree ---
  yield* Console.log('▸ loadTree')
  const loaded = yield* svc.loadTree(saved.treeId)
  yield* Console.log(`  ✓ ${loaded.tree.size} elements, root="${loaded.tree.root}", model=${loaded.model}`)

  // --- listRecentTrees ---
  yield* Console.log('▸ listRecentTrees')
  const recent = yield* svc.listRecentTrees(10)
  yield* Console.log(`  ✓ ${recent.length} trees`)

  // --- listTreesByQuality ---
  yield* Console.log('▸ listTreesByQuality(0.8)')
  const quality = yield* svc.listTreesByQuality(0.8, 10)
  yield* Console.log(`  ✓ ${quality.length} trees with quality >= 0.8`)

  // --- listTreesByThread ---
  yield* Console.log('▸ listTreesByThread')
  const thread = yield* svc.listTreesByThread('service-spike-001')
  yield* Console.log(`  ✓ ${thread.length} trees in thread`)

  // --- rateTree ---
  yield* Console.log('▸ rateTree (4 stars)')
  yield* svc.rateTree(saved.treeId, 4)
  yield* Console.log(`  ✓ rated`)

  // --- listElementsByTree ---
  yield* Console.log('▸ listElementsByTree')
  const elems = yield* svc.listElementsByTree(saved.treeId)
  yield* Console.log(`  ✓ ${elems.length} elements`)

  // --- getSubtree ---
  yield* Console.log('▸ getSubtree(grid)')
  const subtree = yield* svc.getSubtree(saved.treeId, 'grid')
  yield* Console.log(`  ✓ ${subtree.length} elements in grid subtree (grid + card-a + card-b)`)

  // --- upsertComposite ---
  yield* Console.log('▸ upsertComposite (MetricCard)')
  const comp = yield* svc.upsertComposite({
    name: 'MetricCard',
    description: Option.some('A card showing a metric value with label'),
    template: { root: 'card', elements: { card: { type: 'Card', props: { title: '{{title}}', value: '{{value}}' } } } },
    propsSchema: Option.some({ type: 'object', properties: { title: { type: 'string' }, value: { type: 'number' } } }),
    defaultClass: Option.some('rounded-lg shadow-md p-4'),
    hasChildren: false,
    createdBy: 'agent' as const,
    humanRating: Option.none(),
    qualityScore: 0.75,
    usageCount: 0,
  })
  yield* Console.log(`  ✓ id=${comp.id}, name=${comp.name}`)

  // --- getComposite ---
  yield* Console.log('▸ getComposite(MetricCard)')
  const fetched = yield* svc.getComposite('MetricCard')
  yield* Console.log(`  ✓ found, score=${fetched.qualityScore}`)

  // --- listComposites ---
  yield* Console.log('▸ listComposites')
  const allComps = yield* svc.listComposites()
  yield* Console.log(`  ✓ ${allComps.length} composites`)

  // --- rateComposite ---
  yield* Console.log('▸ rateComposite (5 stars)')
  yield* svc.rateComposite(comp.id, 5)
  yield* Console.log(`  ✓ rated`)

  // --- refreshCompositeRankings ---
  yield* Console.log('▸ refreshCompositeRankings')
  yield* svc.refreshCompositeRankings()
  yield* Console.log(`  ✓ materialized view refreshed`)

  // --- topRankedComposites ---
  yield* Console.log('▸ topRankedComposites')
  const top = yield* svc.topRankedComposites(5)
  yield* Console.log(`  ✓ ${top.length} top composites`)

  // --- emitSignal ---
  yield* Console.log('▸ emitSignal (usage)')
  yield* svc.emitSignal({
    targetType: 'tree',
    targetId: saved.treeId,
    signalType: 'usage',
    value: 1,
    metadata: { source: 'spike' },
  })
  yield* Console.log(`  ✓ emitted`)

  // --- listSignalsByTarget ---
  yield* Console.log('▸ listSignalsByTarget')
  const signals = yield* svc.listSignalsByTarget('tree', saved.treeId)
  yield* Console.log(`  ✓ ${signals.length} signals for tree`)

  // --- listSignalsByType ---
  yield* Console.log('▸ listSignalsByType(human_rating)')
  const ratingSignals = yield* svc.listSignalsByType('human_rating')
  yield* Console.log(`  ✓ ${ratingSignals.length} human_rating signals`)

  // --- Cleanup ---
  yield* Console.log('▸ deleteTree + deleteComposite')
  yield* svc.deleteTree(saved.treeId)
  yield* svc.deleteComposite(comp.id)
  yield* Console.log(`  ✓ cleaned up`)

  yield* Console.log('')
  yield* Console.log('🎉 All 18 operations passed')
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

const AppLive = Layer.merge(
  PgClientLive,
  GeniferServiceLive.pipe(Layer.provide(PgClientLive)),
)

import { NodeRuntime } from '@effect/platform-node'

const runnable = program.pipe(
  Effect.provide(AppLive),
  Effect.scoped,
  Effect.tapErrorCause((cause) => Console.error('Spike failed:', cause)),
)

Effect.runFork(runnable).addObserver((exit) => {
  if (exit._tag === 'Success') process.exit(0)
  else process.exit(1)
})
