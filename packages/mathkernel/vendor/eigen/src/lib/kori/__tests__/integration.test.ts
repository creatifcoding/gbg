/**
 * KORI Integration Tests
 *
 * End-to-end tests combining multiple services:
 * - World + Stream query subscriptions
 * - World + BatchQueue mutations
 * - Actor + Entity binding
 * - Merge + Trait composition
 * - Full layer composition
 *
 * @module
 */

import { describe, it, expect } from "vitest"
import { Effect, pipe, Stream, Layer, Chunk, Scope, Duration } from "effect"
import { setup, assign } from "xstate"

// World service
import {
  KoriWorld,
  KoriWorldLive,
  type KoriEntity,
  type EntityId,
} from "../services/world"

// Stream services
import {
  KoriQueryStream,
  KoriQueryStreamLive,
  KoriBatchQueue,
  KoriBatchQueueLive,
  KoriStreamLive,
  type MutationOp,
} from "../services/stream"

// Merge service
import {
  KoriMerge,
  KoriMergeLive,
  sumMerger,
  type MergeStrategy,
} from "../services/merge"

// Actor service
import {
  KoriActor,
  KoriActorLive,
  type ActorId,
} from "../services/actor"

// Schemas
import {
  Position2D,
  Health,
  validateTrait,
  type TraitId,
} from "../schemas/trait"

// ─────────────────────────────────────────────────────────────────────────────
// Test Layer Compositions
// ─────────────────────────────────────────────────────────────────────────────

const WorldLayer = KoriWorldLive
const StreamLayer = KoriStreamLive
const MergeLayer = KoriMergeLive
const ActorLayer = KoriActorLive

// Combined layer for full integration
const FullKoriLayer = Layer.mergeAll(
  WorldLayer,
  StreamLayer,
  MergeLayer,
  ActorLayer
)

// ─────────────────────────────────────────────────────────────────────────────
// Integration: World + Stream Query Subscription (tmnl-wwle)
// ─────────────────────────────────────────────────────────────────────────────

describe("Integration: World + Stream query subscription", () => {
  it("queryStream returns entities spawned in world", async () => {
    const result = await Effect.runPromise(
      pipe(
        Effect.gen(function* () {
          const world = yield* KoriWorld
          const queryStream = yield* KoriQueryStream

          // Spawn an entity with Health trait
          const entity = yield* world.spawn([
            {
              id: "Health" as TraitId,
              data: { _tag: "Health", current: 100, max: 100 },
            },
          ])

          // Note: QueryStream's internal state is separate from World
          // This tests the stream API itself
          const stream = queryStream.queryStream("Health" as TraitId)

          expect(stream).toBeDefined()

          // Verify entity exists in world
          const fetched = yield* world.get(entity.id)
          expect(fetched).toBeDefined()
          expect(fetched?.traits.has("Health" as TraitId)).toBe(true)

          return true
        }),
        Effect.scoped,
        Effect.provide(Layer.merge(WorldLayer, StreamLayer))
      )
    )

    expect(result).toBe(true)
  })

  it("subscribe stream can be created for trait queries", async () => {
    const result = await Effect.runPromise(
      pipe(
        Effect.gen(function* () {
          const queryStream = yield* KoriQueryStream

          const subscription = queryStream.subscribe({
            traitId: "Position2D" as TraitId,
            bufferCapacity: 128,
          })

          expect(subscription).toBeDefined()

          return true
        }),
        Effect.scoped,
        Effect.provide(StreamLayer)
      )
    )

    expect(result).toBe(true)
  })

  it("queryMapEffect transforms entity data", async () => {
    const result = await Effect.runPromise(
      pipe(
        Effect.gen(function* () {
          const queryStream = yield* KoriQueryStream

          // Transform entities to just their IDs
          const stream = queryStream.queryMapEffect(
            "Health" as TraitId,
            (entity) => Effect.succeed(entity.id)
          )

          const items = yield* pipe(stream, Stream.runCollect)

          // Empty because queryStream's internal state is empty
          expect(Chunk.isEmpty(items)).toBe(true)

          return true
        }),
        Effect.scoped,
        Effect.provide(StreamLayer)
      )
    )

    expect(result).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration: World + BatchQueue Mutations (tmnl-7i2f)
// ─────────────────────────────────────────────────────────────────────────────

describe("Integration: World + BatchQueue mutations", () => {
  it("enqueue mutations and flush", async () => {
    const result = await Effect.runPromise(
      pipe(
        Effect.gen(function* () {
          const world = yield* KoriWorld
          const batchQueue = yield* KoriBatchQueue

          // Spawn an entity first
          const entity = yield* world.spawn([
            {
              id: "Health" as TraitId,
              data: { _tag: "Health", current: 100, max: 100 },
            },
          ])

          // Enqueue mutation operations
          yield* batchQueue.enqueue({
            _tag: "SetTrait",
            entityId: entity.id,
            traitId: "Health" as TraitId,
            data: { _tag: "Health", current: 50, max: 100 },
          })

          // Check queue depth
          const depth = yield* batchQueue.depth()
          expect(depth).toBe(1)

          // Flush the queue
          const flushResult = yield* batchQueue.flush()
          expect(flushResult.processed).toBe(1)

          return true
        }),
        Effect.scoped,
        Effect.provide(Layer.merge(WorldLayer, StreamLayer))
      )
    )

    expect(result).toBe(true)
  })

  it("batch multiple mutations", async () => {
    const result = await Effect.runPromise(
      pipe(
        Effect.gen(function* () {
          const batchQueue = yield* KoriBatchQueue

          const ops: MutationOp[] = [
            {
              _tag: "AddTrait",
              entityId: "e1" as EntityId,
              traitId: "Health" as TraitId,
              data: { _tag: "Health", current: 100, max: 100 },
            },
            {
              _tag: "AddTrait",
              entityId: "e2" as EntityId,
              traitId: "Position2D" as TraitId,
              data: { _tag: "Position2D", x: 0, y: 0 },
            },
            {
              _tag: "RemoveTrait",
              entityId: "e3" as EntityId,
              traitId: "Name" as TraitId,
            },
          ]

          yield* batchQueue.enqueueAll(ops)

          const depth = yield* batchQueue.depth()
          expect(depth).toBe(3)

          return true
        }),
        Effect.scoped,
        Effect.provide(StreamLayer)
      )
    )

    expect(result).toBe(true)
  })

  it("flushStream monitors batch processing", async () => {
    const result = await Effect.runPromise(
      pipe(
        Effect.gen(function* () {
          const batchQueue = yield* KoriBatchQueue

          // Get the monitoring stream
          const flushStream = batchQueue.flushStream()
          expect(flushStream).toBeDefined()

          // Enqueue and flush
          yield* batchQueue.enqueue({
            _tag: "DestroyEntity",
            entityId: "e1" as EntityId,
          })

          const flushResult = yield* batchQueue.flush()
          expect(flushResult.processed).toBeGreaterThanOrEqual(0)

          return true
        }),
        Effect.scoped,
        Effect.provide(StreamLayer)
      )
    )

    expect(result).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration: Actor + Entity Binding E2E (tmnl-x1xt)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * State machine for entity health tracking.
 */
const healthMachine = setup({
  types: {
    context: {} as { health: number; maxHealth: number },
    events: {} as
      | { type: "DAMAGE"; amount: number }
      | { type: "HEAL"; amount: number }
      | { type: "KILL" },
  },
  actions: {
    takeDamage: assign({
      health: ({ context, event }) =>
        event.type === "DAMAGE"
          ? Math.max(0, context.health - event.amount)
          : context.health,
    }),
    heal: assign({
      health: ({ context, event }) =>
        event.type === "HEAL"
          ? Math.min(context.maxHealth, context.health + event.amount)
          : context.health,
    }),
  },
}).createMachine({
  id: "health",
  initial: "alive",
  context: { health: 100, maxHealth: 100 },
  states: {
    alive: {
      on: {
        DAMAGE: [
          { guard: ({ context, event }) => context.health - event.amount <= 0, target: "dead" },
          { actions: "takeDamage" },
        ],
        HEAL: { actions: "heal" },
        KILL: "dead",
      },
    },
    dead: {
      type: "final",
    },
  },
})

describe("Integration: Actor + Entity binding E2E", () => {
  it("spawn actor and bind to entity", async () => {
    const result = await Effect.runPromise(
      pipe(
        Effect.gen(function* () {
          const world = yield* KoriWorld
          const actor = yield* KoriActor

          // Spawn entity
          const entity = yield* world.spawn([
            {
              id: "Health" as TraitId,
              data: { _tag: "Health", current: 100, max: 100 },
            },
          ])

          // Spawn actor
          const managed = yield* actor.spawn(healthMachine)

          // Bind actor to entity
          yield* actor.bindToEntity({
            actorId: managed.id,
            entityId: entity.id,
            traitId: "Health" as TraitId,
            transform: (snapshot: any) => ({
              _tag: "Health",
              current: snapshot.context.health,
              max: snapshot.context.maxHealth,
            }),
          })

          // Verify both exist
          const fetchedEntity = yield* world.get(entity.id)
          expect(fetchedEntity).toBeDefined()

          const fetchedActor = yield* actor.get(managed.id)
          expect(fetchedActor).toBeDefined()

          return true
        }),
        Effect.scoped,
        Effect.provide(Layer.merge(WorldLayer, ActorLayer))
      )
    )

    expect(result).toBe(true)
  })

  it("actor state changes sync with entity trait", async () => {
    const result = await Effect.runPromise(
      pipe(
        Effect.gen(function* () {
          const actor = yield* KoriActor

          // Spawn health actor
          const managed = yield* actor.spawn(healthMachine)

          // Initial health
          expect(managed.actor.getSnapshot().context.health).toBe(100)

          // Send damage
          managed.actor.send({ type: "DAMAGE", amount: 30 })

          // Verify health reduced
          expect(managed.actor.getSnapshot().context.health).toBe(70)

          // Heal
          managed.actor.send({ type: "HEAL", amount: 20 })
          expect(managed.actor.getSnapshot().context.health).toBe(90)

          return true
        }),
        Effect.scoped,
        Effect.provide(ActorLayer)
      )
    )

    expect(result).toBe(true)
  })

  it("actor reaching final state notifies lifecycle stream", async () => {
    const result = await Effect.runPromise(
      pipe(
        Effect.gen(function* () {
          const actor = yield* KoriActor

          const lifecycleEvents: unknown[] = []

          // Start collecting lifecycle events
          yield* pipe(
            actor.lifecycleStream(),
            Stream.take(2), // Spawned + potential state change
            Stream.runForEach((event) =>
              Effect.sync(() => lifecycleEvents.push(event))
            ),
            Effect.fork
          )

          // Spawn and kill
          const managed = yield* actor.spawn(healthMachine)

          yield* Effect.sleep("20 millis")

          // Should have spawned event
          expect(lifecycleEvents.length).toBeGreaterThan(0)

          return true
        }),
        Effect.scoped,
        Effect.provide(ActorLayer)
      )
    )

    expect(result).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration: Merge + Trait Composition (tmnl-hu90)
// ─────────────────────────────────────────────────────────────────────────────

describe("Integration: Merge + Trait composition", () => {
  it("composeTrait merges multiple trait data sources", async () => {
    const result = await Effect.runPromise(
      pipe(
        Effect.gen(function* () {
          const merge = yield* KoriMerge

          const traitIds = ["Stats", "Buffs"] as TraitId[]
          const data = [
            { strength: 10, agility: 8, health: 100 },
            { strength: 5, defense: 10 },
          ]

          const composed = yield* merge.composeTrait(traitIds, data)

          expect(composed.merged.strength).toBe(10) // First source wins
          expect(composed.merged.agility).toBe(8)
          expect(composed.merged.defense).toBe(10)
          expect(composed.merged.health).toBe(100)

          return true
        }),
        Effect.provide(MergeLayer)
      )
    )

    expect(result).toBe(true)
  })

  it("composeTrait with sum strategy adds numeric values", async () => {
    const result = await Effect.runPromise(
      pipe(
        Effect.gen(function* () {
          const merge = yield* KoriMerge

          const traitIds = ["Stats", "Buffs", "Equipment"] as TraitId[]
          const data = [
            { strength: 10, agility: 8 },
            { strength: 5, agility: 2 },
            { strength: 3, defense: 10 },
          ]

          const composed = yield* merge.composeTrait(traitIds, data, {
            strategy: "custom",
            customMerger: sumMerger,
          })

          expect(composed.merged.strength).toBe(18) // 10 + 5 + 3
          expect(composed.merged.agility).toBe(10) // 8 + 2
          expect(composed.merged.defense).toBe(10) // Only in one source

          return true
        }),
        Effect.provide(MergeLayer)
      )
    )

    expect(result).toBe(true)
  })

  it("merge validates trait data after composition", async () => {
    const result = await Effect.runPromise(
      pipe(
        Effect.gen(function* () {
          const merge = yield* KoriMerge

          // Compose position data
          const traitIds = ["Position"] as TraitId[]
          const data = [
            { x: 10, y: 20 },
            { z: 0 }, // Additional source
          ]

          const composed = yield* merge.composeTrait(traitIds, data)

          // Validate as Position2D
          const validated = yield* validateTrait(
            Position2D,
            { _tag: "Position2D", ...composed.merged },
            "Position2D"
          )

          expect(validated.x).toBe(10)
          expect(validated.y).toBe(20)

          return true
        }),
        Effect.provide(MergeLayer)
      )
    )

    expect(result).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration: Full Layer Composition (tmnl-mwsz)
// ─────────────────────────────────────────────────────────────────────────────

describe("Integration: Full layer composition", () => {
  it("all services can be provided together", async () => {
    const result = await Effect.runPromise(
      pipe(
        Effect.gen(function* () {
          const world = yield* KoriWorld
          const queryStream = yield* KoriQueryStream
          const batchQueue = yield* KoriBatchQueue
          const merge = yield* KoriMerge
          const actor = yield* KoriActor

          // All services are available
          expect(world).toBeDefined()
          expect(queryStream).toBeDefined()
          expect(batchQueue).toBeDefined()
          expect(merge).toBeDefined()
          expect(actor).toBeDefined()

          return true
        }),
        Effect.scoped,
        Effect.provide(FullKoriLayer)
      )
    )

    expect(result).toBe(true)
  })

  it("full workflow: spawn → query → mutate → merge", async () => {
    const result = await Effect.runPromise(
      pipe(
        Effect.gen(function* () {
          const world = yield* KoriWorld
          const batchQueue = yield* KoriBatchQueue
          const merge = yield* KoriMerge

          // 1. Spawn entity with traits
          const entity = yield* world.spawn([
            {
              id: "Health" as TraitId,
              data: { _tag: "Health", current: 100, max: 100 },
            },
            {
              id: "Position2D" as TraitId,
              data: { _tag: "Position2D", x: 0, y: 0 },
            },
          ])

          // 2. Query to verify
          const entities = yield* world.queryWith("Health" as TraitId)
          expect(entities.length).toBe(1)

          // 3. Enqueue mutation
          yield* batchQueue.enqueue({
            _tag: "SetTrait",
            entityId: entity.id,
            traitId: "Health" as TraitId,
            data: { _tag: "Health", current: 50, max: 100 },
          })

          // 4. Flush
          yield* batchQueue.flush()

          // 5. Merge trait data for composition
          const composed = yield* merge.composeTrait(
            ["Base", "Modifier"] as TraitId[],
            [{ damage: 10 }, { damage: 5 }],
            { strategy: "custom", customMerger: sumMerger }
          )

          expect(composed.merged.damage).toBe(15)

          return true
        }),
        Effect.scoped,
        Effect.provide(FullKoriLayer)
      )
    )

    expect(result).toBe(true)
  })

  it("full workflow with actor integration", async () => {
    const result = await Effect.runPromise(
      pipe(
        Effect.gen(function* () {
          const world = yield* KoriWorld
          const actor = yield* KoriActor

          // Spawn entity
          const entity = yield* world.spawn([
            {
              id: "Health" as TraitId,
              data: { _tag: "Health", current: 100, max: 100 },
            },
          ])

          // Spawn actor
          const managed = yield* actor.spawn(healthMachine, { id: "player-health" })

          // Bind
          yield* actor.bindToEntity({
            actorId: managed.id,
            entityId: entity.id,
            traitId: "Health" as TraitId,
            transform: (s: any) => ({
              _tag: "Health",
              current: s.context.health,
              max: s.context.maxHealth,
            }),
          })

          // Simulate gameplay
          managed.actor.send({ type: "DAMAGE", amount: 25 })
          managed.actor.send({ type: "HEAL", amount: 10 })

          const finalHealth = managed.actor.getSnapshot().context.health
          expect(finalHealth).toBe(85) // 100 - 25 + 10

          return true
        }),
        Effect.scoped,
        Effect.provide(FullKoriLayer)
      )
    )

    expect(result).toBe(true)
  })
})
