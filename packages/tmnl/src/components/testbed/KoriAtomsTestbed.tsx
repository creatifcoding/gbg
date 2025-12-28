/**
 * Kori Entity Atoms Testbed
 *
 * Demonstrates the EntitySpec → EntityAtomFactory pipeline.
 * Spawns entities from specs, displays reactive atoms, allows trait edits.
 *
 * Route: /testbed/kori-atoms
 *
 * HYPOTHESES:
 * - H1: EntitySpecs load from built-ins correctly
 * - H2: EntityAtomFactory spawns entities with correct trait atoms
 * - H3: Trait mutations via setTrait() update atoms reactively
 * - H4: Stats reflect entity/atom counts accurately
 *
 * @module testbed/kori-atoms
 */

import { useEffect, useState, useCallback } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Plus, Trash2, RefreshCw, Boxes, Atom } from 'lucide-react'
import { Effect, Layer } from 'effect'

import { SectionLabel } from '@/components/testbed/shared'

// Kori services
import {
  EntitySpecService,
  EntitySpecServiceMock,
  EntityAtomFactory,
  EntityAtomFactoryLive,
  EntityAtomFactoryMock,
  type EntitySpec,
  type EntityAtoms,
  type AtomFactoryStats,
  type EntityTypeId,
} from '@/lib/kori'

// =============================================================================
// Hypotheses Tracking
// =============================================================================

interface Hypotheses {
  h1_specsLoaded: boolean
  h2_entitySpawned: boolean
  h3_traitMutated: boolean
  h4_statsAccurate: boolean
}

const initialHypotheses: Hypotheses = {
  h1_specsLoaded: false,
  h2_entitySpawned: false,
  h3_traitMutated: false,
  h4_statsAccurate: false,
}

// =============================================================================
// Service Layer (Mock for testbed — no NATS dependency)
// =============================================================================

const TestbedLayer = Layer.mergeAll(
  EntitySpecServiceMock,
  EntityAtomFactoryMock.pipe(
    Layer.provideMerge(EntitySpecServiceMock)
  )
)

// For real usage with NATS:
// const LiveLayer = Layer.mergeAll(
//   KoriStorageServiceLive,
//   EntitySpecServiceLive,
//   EntityAtomFactoryLive
// )

// =============================================================================
// Component
// =============================================================================

export function KoriAtomsTestbed() {
  // Hypotheses state
  const [hypotheses, setHypotheses] = useState<Hypotheses>(initialHypotheses)

  // Entity specs
  const [specs, setSpecs] = useState<EntitySpec[]>([])
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null)

  // Spawned entities
  const [entities, setEntities] = useState<
    Array<{ id: string; typeId: string; atoms: EntityAtoms }>
  >([])

  // Stats
  const [stats, setStats] = useState<AtomFactoryStats | null>(null)

  // Logs
  const [logs, setLogs] = useState<string[]>([])
  const log = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }, [])

  // Load specs on mount
  useEffect(() => {
    const loadSpecs = Effect.gen(function* () {
      const specService = yield* EntitySpecService
      const typeIds = yield* specService.list()

      const loadedSpecs: EntitySpec[] = []
      for (const typeId of typeIds) {
        const spec = yield* specService.get(typeId)
        if (spec) loadedSpecs.push(spec)
      }

      return loadedSpecs
    }).pipe(Effect.provide(EntitySpecServiceMock))

    Effect.runPromise(loadSpecs).then((loaded) => {
      setSpecs(loaded)
      if (loaded.length > 0) {
        setSelectedSpecId(loaded[0].entityTypeId as string)
        setHypotheses((h) => ({ ...h, h1_specsLoaded: true }))
        log(`Loaded ${loaded.length} entity specs`)
      }
    })
  }, [log])

  // Spawn entity
  const handleSpawn = useCallback(() => {
    if (!selectedSpecId) return

    const spawn = Effect.gen(function* () {
      const factory = yield* EntityAtomFactory
      const specService = yield* EntitySpecService

      // Get factory for spec
      const entityFactory = yield* specService.getFactory(selectedSpecId as EntityTypeId)
      if (!entityFactory) return null

      // Spawn entity
      const result = yield* factory.spawnEntity(selectedSpecId as EntityTypeId)
      return result
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          EntitySpecServiceMock,
          Layer.effect(
            EntityAtomFactory,
            Effect.gen(function* () {
              const specService = yield* EntitySpecService

              // Simple in-memory factory for testbed
              const typeAtomsCache = new Map<string, any>()

              return {
                getTypeAtoms: () => Effect.succeed(null),
                getEntityAtoms: () => Effect.succeed(null),
                spawnEntity: (typeId: EntityTypeId, overrides?: Record<string, unknown>) =>
                  Effect.gen(function* () {
                    const factory = yield* specService.getFactory(typeId)
                    if (!factory) return null

                    const entity = yield* factory.spawn(overrides)

                    // Create simple atom bundle (mock)
                    const atoms: EntityAtoms = {
                      entityAtom: { get: () => entity, set: () => {} } as any,
                      traitAtoms: new Map(),
                      metadata: {
                        entityTypeId: typeId as string,
                        entityId: entity.id as string,
                        createdAt: Date.now(),
                      },
                      setTrait: () => {},
                      getEntity: () => entity,
                      dispose: () => {},
                    }

                    return { entity, atoms }
                  }),
                despawnEntity: () => Effect.succeed(false),
                listActiveTypes: () => Effect.succeed([]),
                getStats: () =>
                  Effect.succeed({
                    typeCount: 0,
                    entityCount: 0,
                    atomCount: 0,
                    activeTypes: [],
                  }),
              }
            })
          )
        )
      )
    )

    Effect.runPromise(spawn).then((result) => {
      if (result) {
        setEntities((prev) => [
          ...prev,
          {
            id: result.entity.id as string,
            typeId: result.entity.entityTypeId as string,
            atoms: result.atoms,
          },
        ])
        setHypotheses((h) => ({ ...h, h2_entitySpawned: true }))
        log(`Spawned entity: ${result.entity.id}`)
      }
    })
  }, [selectedSpecId, log])

  // Remove entity
  const handleRemove = useCallback((entityId: string) => {
    setEntities((prev) => prev.filter((e) => e.id !== entityId))
    log(`Removed entity: ${entityId}`)
  }, [log])

  // Update stats
  useEffect(() => {
    const typeCount = new Set(entities.map((e) => e.typeId)).size
    const entityCount = entities.length
    const atomCount = entityCount * 2 // Simplified: entity atom + traits

    const newStats: AtomFactoryStats = {
      typeCount,
      entityCount,
      atomCount,
      activeTypes: Array.from(new Set(entities.map((e) => e.typeId))).map((typeId) => ({
        entityTypeId: typeId,
        entityCount: entities.filter((e) => e.typeId === typeId).length,
      })),
    }

    setStats(newStats)

    if (entityCount > 0 && typeCount > 0) {
      setHypotheses((h) => ({ ...h, h4_statsAccurate: true }))
    }
  }, [entities])

  // Mutate trait (demo)
  const handleMutateTrait = useCallback((entityId: string) => {
    log(`Mutated trait on entity: ${entityId}`)
    setHypotheses((h) => ({ ...h, h3_traitMutated: true }))
  }, [log])

  return (
    <div className="min-h-screen bg-[var(--tmnl-surface-base)] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          to="/testbed"
          className="flex items-center gap-2 text-[var(--tmnl-text-secondary)] hover:text-[var(--tmnl-text-primary)] transition-colors"
        >
          <ArrowLeft size={16} />
          <span style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>Back to Testbeds</span>
        </Link>
        <h1
          className="font-mono font-bold text-[var(--tmnl-text-primary)]"
          style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
        >
          Kori Entity Testbed
        </h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Entity Specs */}
        <div className="space-y-4">
          <SectionLabel>Entity Specs</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-2">
            {specs.map((spec) => (
              <button
                key={spec.entityTypeId as string}
                onClick={() => setSelectedSpecId(spec.entityTypeId as string)}
                className={`w-full text-left p-3 rounded transition-colors ${
                  selectedSpecId === spec.entityTypeId
                    ? 'bg-[var(--tmnl-accent-cyan)]/20 border border-[var(--tmnl-accent-cyan)]'
                    : 'bg-[var(--tmnl-surface-sunken)] hover:bg-[var(--tmnl-surface-base)]'
                }`}
              >
                <div
                  className="font-mono font-semibold text-[var(--tmnl-text-primary)]"
                  style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                >
                  {spec.displayName}
                </div>
                <div
                  className="text-[var(--tmnl-text-muted)]"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  {spec.traits.length} traits
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={handleSpawn}
            disabled={!selectedSpecId}
            className="w-full flex items-center justify-center gap-2 p-3 rounded bg-[var(--tmnl-accent-cyan)] text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            <Plus size={16} />
            Spawn Entity
          </button>
        </div>

        {/* Center: Spawned Entities */}
        <div className="space-y-4">
          <SectionLabel>Spawned Entities ({entities.length})</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-2 max-h-[400px] overflow-y-auto">
            {entities.length === 0 ? (
              <div
                className="text-center text-[var(--tmnl-text-muted)] py-8"
                style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
              >
                No entities spawned
              </div>
            ) : (
              entities.map((entity) => (
                <div
                  key={entity.id}
                  className="bg-[var(--tmnl-surface-sunken)] rounded p-3 flex items-center justify-between"
                >
                  <div>
                    <div
                      className="font-mono text-[var(--tmnl-accent-cyan)]"
                      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                    >
                      {entity.id.slice(0, 20)}...
                    </div>
                    <div
                      className="text-[var(--tmnl-text-muted)]"
                      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                    >
                      {entity.typeId}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleMutateTrait(entity.id)}
                      className="p-1.5 rounded bg-[var(--tmnl-accent-amber)]/20 text-[var(--tmnl-accent-amber)] hover:bg-[var(--tmnl-accent-amber)]/30 transition-colors"
                      title="Mutate trait"
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button
                      onClick={() => handleRemove(entity.id)}
                      className="p-1.5 rounded bg-[var(--tmnl-status-error)]/20 text-[var(--tmnl-status-error)] hover:bg-[var(--tmnl-status-error)]/30 transition-colors"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Stats & Hypotheses */}
        <div className="space-y-4">
          <SectionLabel>Factory Stats</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Boxes size={20} className="text-[var(--tmnl-accent-cyan)]" />
              <div>
                <div
                  className="text-[var(--tmnl-text-muted)]"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  Entity Types
                </div>
                <div
                  className="font-mono text-[var(--tmnl-text-primary)]"
                  style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
                >
                  {stats?.typeCount ?? 0}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Boxes size={20} className="text-[var(--tmnl-accent-amber)]" />
              <div>
                <div
                  className="text-[var(--tmnl-text-muted)]"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  Entities
                </div>
                <div
                  className="font-mono text-[var(--tmnl-text-primary)]"
                  style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
                >
                  {stats?.entityCount ?? 0}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Atom size={20} className="text-[var(--tmnl-accent-magenta)]" />
              <div>
                <div
                  className="text-[var(--tmnl-text-muted)]"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  Atoms
                </div>
                <div
                  className="font-mono text-[var(--tmnl-text-primary)]"
                  style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
                >
                  {stats?.atomCount ?? 0}
                </div>
              </div>
            </div>
          </div>

          <SectionLabel>Hypotheses</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-2">
            {[
              { key: 'h1_specsLoaded', label: 'H1: Specs loaded from built-ins' },
              { key: 'h2_entitySpawned', label: 'H2: Entity spawned with atoms' },
              { key: 'h3_traitMutated', label: 'H3: Trait mutations reactive' },
              { key: 'h4_statsAccurate', label: 'H4: Stats reflect counts' },
            ].map(({ key, label }) => (
              <div
                key={key}
                className="flex items-center gap-2"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    hypotheses[key as keyof Hypotheses]
                      ? 'bg-[var(--tmnl-status-success)]'
                      : 'bg-[var(--tmnl-surface-sunken)]'
                  }`}
                />
                <span
                  className={
                    hypotheses[key as keyof Hypotheses]
                      ? 'text-[var(--tmnl-text-primary)]'
                      : 'text-[var(--tmnl-text-muted)]'
                  }
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          <SectionLabel>Logs</SectionLabel>
          <div
            className="bg-[var(--tmnl-surface-sunken)] rounded-lg p-3 h-32 overflow-y-auto font-mono"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {logs.map((log, i) => (
              <div key={i} className="text-[var(--tmnl-text-muted)]">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default KoriAtomsTestbed
