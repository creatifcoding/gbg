/**
 * KORI Actor Service
 *
 * XState machine ↔ Effect.Stream bridge.
 * Actor spawning via Effect.acquireRelease.
 * Schema-typed events and machine context as trait data.
 *
 * @module
 */

import {
  Context,
  Effect,
  Layer,
  Stream,
  Scope,
  Ref,
  Schema,
  pipe,
  Queue,
} from "effect"
import {
  createActor,
  type AnyActorRef,
  type AnyStateMachine,
  type SnapshotFrom,
  type EventFromLogic,
  type Actor,
} from "xstate"
import { ActorSpawnFailed } from "../errors"
import type { TraitId } from "../schemas/trait"
import type { EntityId } from "./world"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Actor identifier (branded string).
 */
export type ActorId = string & { readonly _brand: unique symbol }

/**
 * Actor snapshot event for streaming.
 */
export interface ActorSnapshotEvent<TSnapshot> {
  readonly actorId: ActorId
  readonly snapshot: TSnapshot
  readonly timestamp: Date
}

/**
 * Actor lifecycle event.
 */
export type ActorLifecycleEvent =
  | { readonly _tag: "Spawned"; readonly actorId: ActorId; readonly machine: string }
  | { readonly _tag: "Started"; readonly actorId: ActorId }
  | { readonly _tag: "Stopped"; readonly actorId: ActorId }
  | { readonly _tag: "Error"; readonly actorId: ActorId; readonly error: unknown }

/**
 * Actor-to-entity binding configuration.
 */
export interface ActorEntityBinding {
  readonly actorId: ActorId
  readonly entityId: EntityId
  readonly traitId: TraitId
  /** Transform snapshot to trait data */
  readonly transform: (snapshot: unknown) => unknown
}

/**
 * Managed actor wrapper with lifecycle.
 */
export interface ManagedActor<
  TMachine extends AnyStateMachine = AnyStateMachine
> {
  readonly id: ActorId
  readonly actor: Actor<TMachine>
  readonly machine: TMachine
  readonly spawnedAt: Date
  readonly isRunning: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema Types for Actor Events
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base actor event schema.
 */
export const ActorEventBase = Schema.Struct({
  actorId: Schema.String.pipe(Schema.brand("ActorId")),
  timestamp: Schema.DateFromSelf,
})

/**
 * Actor spawned event schema.
 */
export const ActorSpawnedEvent = Schema.TaggedStruct("ActorSpawned", {
  ...ActorEventBase.fields,
  machineName: Schema.String,
})
export type ActorSpawnedEvent = typeof ActorSpawnedEvent.Type

/**
 * Actor state changed event schema.
 */
export const ActorStateChangedEvent = Schema.TaggedStruct("ActorStateChanged", {
  ...ActorEventBase.fields,
  previousState: Schema.String,
  currentState: Schema.String,
})
export type ActorStateChangedEvent = typeof ActorStateChangedEvent.Type

/**
 * Actor stopped event schema.
 */
export const ActorStoppedEvent = Schema.TaggedStruct("ActorStopped", {
  ...ActorEventBase.fields,
  finalState: Schema.String,
})
export type ActorStoppedEvent = typeof ActorStoppedEvent.Type

/**
 * Union of all actor lifecycle events (for pattern matching).
 */
export const ActorLifecycleEventSchema = Schema.Union(
  ActorSpawnedEvent,
  ActorStateChangedEvent,
  ActorStoppedEvent
)
export type ActorLifecycleEventSchema = typeof ActorLifecycleEventSchema.Type

// ─────────────────────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KORI Actor operations.
 */
export interface KoriActorOps {
  /**
   * Spawn an XState actor with scoped lifecycle.
   * Actor is automatically stopped on scope close.
   */
  readonly spawn: <TMachine extends AnyStateMachine>(
    machine: TMachine,
    options?: { id?: string }
  ) => Effect.Effect<ManagedActor<TMachine>, ActorSpawnFailed, Scope.Scope>

  /**
   * Get actor by ID.
   */
  readonly get: (
    actorId: ActorId
  ) => Effect.Effect<ManagedActor | undefined>

  /**
   * Send event to actor.
   */
  readonly send: <TMachine extends AnyStateMachine>(
    actorId: ActorId,
    event: EventFromLogic<TMachine>
  ) => Effect.Effect<void>

  /**
   * Subscribe to actor snapshots as stream.
   * Uses Stream.async for reactive updates.
   */
  readonly subscribe: <TMachine extends AnyStateMachine>(
    actorId: ActorId
  ) => Stream.Stream<SnapshotFrom<TMachine>, never>

  /**
   * Stream of all actor lifecycle events.
   */
  readonly lifecycleStream: () => Stream.Stream<ActorLifecycleEventSchema, never>

  /**
   * Bind actor context to entity trait.
   * Syncs actor snapshot to entity trait data.
   */
  readonly bindToEntity: (
    binding: ActorEntityBinding
  ) => Effect.Effect<void, never, Scope.Scope>

  /**
   * Get current snapshot of actor.
   */
  readonly getSnapshot: <TMachine extends AnyStateMachine>(
    actorId: ActorId
  ) => Effect.Effect<SnapshotFrom<TMachine> | undefined>

  /**
   * List all active actors.
   */
  readonly listActors: () => Effect.Effect<ReadonlyArray<ManagedActor>>
}

/**
 * KORI Actor service tag.
 */
export class KoriActor extends Context.Tag("kori/Actor")<
  KoriActor,
  KoriActorOps
>() {}

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Internal actor registry state.
 */
interface ActorRegistryState {
  readonly actors: Map<ActorId, ManagedActor>
  readonly bindings: Map<ActorId, ActorEntityBinding[]>
}

/**
 * Create KORI Actor operations.
 */
export const makeKoriActor: Effect.Effect<KoriActorOps, never, Scope.Scope> =
  Effect.gen(function* () {
    // Internal state
    const stateRef = yield* Ref.make<ActorRegistryState>({
      actors: new Map(),
      bindings: new Map(),
    })

    // Lifecycle event queue
    const lifecycleQueue = yield* Queue.unbounded<ActorLifecycleEventSchema>()

    // Generate unique actor ID
    let actorIdCounter = 0
    const nextActorId = (prefix?: string): ActorId => {
      const id = prefix ?? `actor-${++actorIdCounter}`
      return id as ActorId
    }

    // Get current state name from snapshot
    const getStateName = (snapshot: unknown): string => {
      if (snapshot && typeof snapshot === "object" && "value" in snapshot) {
        const value = (snapshot as { value: unknown }).value
        if (typeof value === "string") return value
        if (typeof value === "object" && value !== null) {
          return JSON.stringify(value)
        }
      }
      return "unknown"
    }

    const ops: KoriActorOps = {
      spawn: <TMachine extends AnyStateMachine>(
        machine: TMachine,
        options?: { id?: string }
      ) =>
        Effect.acquireRelease(
          // Acquire: create and start actor
          Effect.try({
            try: () => {
              const actorId = nextActorId(options?.id)
              const actor = createActor(machine)

              const managedActor: ManagedActor<TMachine> = {
                id: actorId,
                actor,
                machine,
                spawnedAt: new Date(),
                isRunning: true,
              }

              // Start the actor
              actor.start()

              // Register in state
              Effect.runSync(
                Ref.update(stateRef, (state) => ({
                  ...state,
                  actors: new Map([
                    ...state.actors,
                    [actorId, managedActor as ManagedActor],
                  ]),
                }))
              )

              // Emit lifecycle event
              Effect.runSync(
                Queue.offer(lifecycleQueue, {
                  _tag: "ActorSpawned" as const,
                  actorId: actorId as unknown as typeof ActorEventBase.Type["actorId"],
                  timestamp: new Date(),
                  machineName: machine.id ?? "anonymous",
                })
              )

              return managedActor
            },
            catch: (error) =>
              new ActorSpawnFailed({
                machineId: machine.id ?? "anonymous",
                reason: String(error),
              }),
          }),
          // Release: stop actor on scope close
          (managed) =>
            Effect.sync(() => {
              const actor = managed.actor
              if (actor.status === "active") {
                actor.stop()
              }

              // Remove from registry
              Effect.runSync(
                Ref.update(stateRef, (state) => {
                  const actors = new Map(state.actors)
                  actors.delete(managed.id)
                  return { ...state, actors }
                })
              )

              // Emit lifecycle event
              Effect.runSync(
                Queue.offer(lifecycleQueue, {
                  _tag: "ActorStopped" as const,
                  actorId: managed.id as unknown as typeof ActorEventBase.Type["actorId"],
                  timestamp: new Date(),
                  finalState: getStateName(actor.getSnapshot()),
                })
              )
            })
        ),

      get: (actorId) =>
        pipe(
          Ref.get(stateRef),
          Effect.map((state) => state.actors.get(actorId))
        ),

      send: <TMachine extends AnyStateMachine>(
        actorId: ActorId,
        event: EventFromLogic<TMachine>
      ) =>
        pipe(
          Ref.get(stateRef),
          Effect.flatMap((state) => {
            const managed = state.actors.get(actorId)
            if (managed && managed.actor.status === "active") {
              managed.actor.send(event)
            }
            return Effect.void
          })
        ),

      subscribe: <TMachine extends AnyStateMachine>(actorId: ActorId) =>
        Stream.async<SnapshotFrom<TMachine>, never>((emit) => {
          const state = Effect.runSync(Ref.get(stateRef))
          const managed = state.actors.get(actorId)

          if (!managed || managed.actor.status !== "active") {
            emit.end()
            return Effect.void
          }

          const actor = managed.actor

          // Subscribe to actor snapshots
          const subscription = actor.subscribe((snapshot) => {
            emit.single(snapshot as SnapshotFrom<TMachine>)
          })

          // Return cleanup
          return Effect.sync(() => {
            subscription.unsubscribe()
          })
        }),

      lifecycleStream: () => Stream.fromQueue(lifecycleQueue),

      bindToEntity: (binding) =>
        Effect.gen(function* () {
          // Register binding
          yield* Ref.update(stateRef, (state) => {
            const bindings = new Map(state.bindings)
            const existing = bindings.get(binding.actorId) ?? []
            bindings.set(binding.actorId, [...existing, binding])
            return { ...state, bindings }
          })

          // Subscribe to actor and sync to entity
          const state = yield* Ref.get(stateRef)
          const managed = state.actors.get(binding.actorId)

          if (managed && managed.actor.status === "active") {
            // Fork a fiber to sync snapshots to entity trait
            yield* pipe(
              ops.subscribe(binding.actorId),
              Stream.tap((snapshot) =>
                Effect.sync(() => {
                  const traitData = binding.transform(snapshot)
                  // Here we would call world.setTrait(binding.entityId, binding.traitId, traitData)
                  // This is a hook point for KoriWorld integration
                  void traitData
                })
              ),
              Stream.runDrain,
              Effect.forkScoped
            )
          }

          // Cleanup on scope close
          yield* Effect.addFinalizer(() =>
            Ref.update(stateRef, (state) => {
              const bindings = new Map(state.bindings)
              const existing = bindings.get(binding.actorId) ?? []
              bindings.set(
                binding.actorId,
                existing.filter((b) => b.entityId !== binding.entityId)
              )
              return { ...state, bindings }
            })
          )
        }),

      getSnapshot: <TMachine extends AnyStateMachine>(actorId: ActorId) =>
        pipe(
          Ref.get(stateRef),
          Effect.map((state) => {
            const managed = state.actors.get(actorId)
            if (managed && managed.actor.status === "active") {
              return managed.actor.getSnapshot() as SnapshotFrom<TMachine>
            }
            return undefined
          })
        ),

      listActors: () =>
        pipe(
          Ref.get(stateRef),
          Effect.map((state) => Array.from(state.actors.values()))
        ),
    }

    // Cleanup queue on scope close
    yield* Effect.addFinalizer(() => Queue.shutdown(lifecycleQueue))

    return ops
  })

/**
 * Default KORI Actor layer.
 */
export const KoriActorLive = Layer.scoped(KoriActor, makeKoriActor)

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Create typed actor stream
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a typed stream from machine definition.
 * Helper for strongly-typed actor subscriptions.
 */
export function typedActorStream<TMachine extends AnyStateMachine>(
  machine: TMachine
): {
  spawn: Effect.Effect<{
    actor: ManagedActor<TMachine>
    stream: Stream.Stream<SnapshotFrom<TMachine>, never>
  }, ActorSpawnFailed, Scope.Scope | KoriActor>
} {
  return {
    spawn: Effect.gen(function* () {
      const ops = yield* KoriActor
      const actor = yield* ops.spawn(machine)
      const stream = ops.subscribe<TMachine>(actor.id)
      return { actor, stream }
    }),
  }
}

/**
 * Run an actor to completion (until it reaches a final state).
 * Returns the final snapshot.
 */
export function runActorToCompletion<TMachine extends AnyStateMachine>(
  machine: TMachine
): Effect.Effect<SnapshotFrom<TMachine>, ActorSpawnFailed, Scope.Scope | KoriActor> {
  return Effect.gen(function* () {
    const ops = yield* KoriActor
    const managed = yield* ops.spawn(machine)

    // Stream until actor stops or reaches final state
    const finalSnapshot = yield* pipe(
      ops.subscribe<TMachine>(managed.id),
      Stream.takeUntil((snapshot) => {
        // Check if in final state (done/error)
        const status = (snapshot as { status?: string }).status
        return status === "done" || status === "error"
      }),
      Stream.runLast,
      Effect.map((opt) => opt ?? managed.actor.getSnapshot() as SnapshotFrom<TMachine>)
    )

    return finalSnapshot
  })
}
