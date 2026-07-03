/**
 * ProjectionRegistry — multiple FrameProjectionSpec records.
 *
 * The registry is deliberately small: it tracks projection contracts and their
 * compiled plans. Worker scheduling, migration application, and runtime status
 * are separate surfaces. This keeps contract discovery from becoming an
 * execution daemon in a nice hat.
 *
 * @module @tmnl/pct/frames/ProjectionRegistry
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import * as Schema from "effect/Schema"

import {
  FrameProjectionSpec,
  ProjectionPlan,
  type FrameProjectionSpec as FrameProjectionSpecType,
} from "./FrameProjectionSpec.js"
import {
  FrameProjectionCompileError,
  compileTimescaleProjection,
} from "./TimescaleProjectionCompiler.js"

// ─── Schemas ────────────────────────────────────────────────────────────────

export const ProjectionRegistryStatus = Schema.Literals([
  "draft",
  "active",
  "paused",
  "deprecated",
])
export type ProjectionRegistryStatus = typeof ProjectionRegistryStatus.Type

export const ProjectionRegistryEntry = Schema.Struct({
  projectionId: Schema.String,
  spec: FrameProjectionSpec,
  plan: ProjectionPlan,
  status: ProjectionRegistryStatus,
  tags: Schema.Array(Schema.String),
  registeredAt: Schema.Number,
  updatedAt: Schema.Number,
})
export type ProjectionRegistryEntry = typeof ProjectionRegistryEntry.Type

export const ProjectionRegistryFilter = Schema.Struct({
  projectionId: Schema.optional(Schema.String),
  status: Schema.optional(ProjectionRegistryStatus),
  tag: Schema.optional(Schema.String),
})
export type ProjectionRegistryFilter = typeof ProjectionRegistryFilter.Type

export class ProjectionNotFound extends Schema.TaggedErrorClass<ProjectionNotFound>()(
  "ProjectionNotFound",
  {
    projectionId: Schema.String,
  },
) {}

// ─── Service ────────────────────────────────────────────────────────────────

export interface RegisterProjectionOptions {
  readonly status?: ProjectionRegistryStatus
  readonly tags?: ReadonlyArray<string>
  readonly now?: number
}

export interface ProjectionRegistryShape {
  readonly register: (
    spec: FrameProjectionSpecType,
    options?: RegisterProjectionOptions,
  ) => Effect.Effect<ProjectionRegistryEntry, FrameProjectionCompileError>
  readonly get: (
    projectionId: string,
  ) => Effect.Effect<ProjectionRegistryEntry, ProjectionNotFound>
  readonly getOption: (
    projectionId: string,
  ) => Effect.Effect<ProjectionRegistryEntry | undefined>
  readonly list: (
    filter?: ProjectionRegistryFilter,
  ) => Effect.Effect<ReadonlyArray<ProjectionRegistryEntry>>
  readonly setStatus: (
    projectionId: string,
    status: ProjectionRegistryStatus,
    now?: number,
  ) => Effect.Effect<ProjectionRegistryEntry, ProjectionNotFound>
  readonly remove: (
    projectionId: string,
  ) => Effect.Effect<boolean>
}

export class ProjectionRegistry extends Context.Service<
  ProjectionRegistry,
  ProjectionRegistryShape
>()("@tmnl/pct/frames/ProjectionRegistry") {}

// ─── Implementation ─────────────────────────────────────────────────────────

const matchesFilter = (
  entry: ProjectionRegistryEntry,
  filter: ProjectionRegistryFilter | undefined,
): boolean => {
  if (filter?.projectionId !== undefined && entry.projectionId !== filter.projectionId) return false
  if (filter?.status !== undefined && entry.status !== filter.status) return false
  if (filter?.tag !== undefined && !entry.tags.includes(filter.tag)) return false
  return true
}

const makeImpl = (
  stateRef: Ref.Ref<ReadonlyMap<string, ProjectionRegistryEntry>>,
): ProjectionRegistryShape => ({
  register: (spec, options = {}) =>
    Effect.gen(function* () {
      const plan = yield* compileTimescaleProjection(spec)
      const now = options.now ?? Date.now()
      const existing = (yield* Ref.get(stateRef)).get(spec.id)
      const entry: ProjectionRegistryEntry = {
        projectionId: spec.id,
        spec,
        plan,
        status: options.status ?? existing?.status ?? "draft",
        tags: [...(options.tags ?? existing?.tags ?? [])],
        registeredAt: existing?.registeredAt ?? now,
        updatedAt: now,
      }
      yield* Ref.update(stateRef, (state) => new Map(state).set(spec.id, entry))
      return entry
    }),

  get: (projectionId) =>
    Effect.gen(function* () {
      const entry = (yield* Ref.get(stateRef)).get(projectionId)
      if (entry === undefined) return yield* Effect.fail(new ProjectionNotFound({ projectionId }))
      return entry
    }),

  getOption: (projectionId) =>
    Effect.map(Ref.get(stateRef), (state) => state.get(projectionId)),

  list: (filter) =>
    Effect.map(Ref.get(stateRef), (state) =>
      Array.from(state.values())
        .filter((entry) => matchesFilter(entry, filter))
        .sort((a, b) => a.projectionId.localeCompare(b.projectionId)),
    ),

  setStatus: (projectionId, status, now = Date.now()) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const entry = state.get(projectionId)
      if (entry === undefined) return yield* Effect.fail(new ProjectionNotFound({ projectionId }))
      const next: ProjectionRegistryEntry = {
        ...entry,
        status,
        updatedAt: now,
      }
      yield* Ref.update(stateRef, (current) => new Map(current).set(projectionId, next))
      return next
    }),

  remove: (projectionId) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const existed = state.has(projectionId)
      if (!existed) return false
      yield* Ref.update(stateRef, (current) => {
        const next = new Map(current)
        next.delete(projectionId)
        return next
      })
      return true
    }),
})

export const projectionRegistryLayerMemory: Layer.Layer<ProjectionRegistry> = Layer.effect(
  ProjectionRegistry,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<ReadonlyMap<string, ProjectionRegistryEntry>>(new Map())
    return ProjectionRegistry.of(makeImpl(stateRef))
  }),
)
