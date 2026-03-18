/**
 * @module plugins/metaskill-services
 *
 * Effect v4 ServiceMap.Service decomposition of the metaskill domain.
 *
 * 8 services + 1 layer composition:
 *
 * ```
 * SkillConfig (leaf — no deps)
 *   ├── SkillDiscovery
 *   │     ├── SkillInspector
 *   │     └── FreshnessService
 *   ├── FrontmatterService
 *   ├── ProtocolService
 *   ├── UtilService
 *   └── SkillMutations
 * ```
 *
 * The composed helpers (profile, each, where) are pure functions
 * that yield* multiple services — defined here as standalone Effects.
 */

// ── Services ─────────────────────────────────────────────────────

export { SkillConfig, makeSkillConfigLayer } from "./skill-config.js"
export type { SkillConfigShape } from "./skill-config.js"

export { SkillDiscovery, SkillDiscoveryLive } from "./skill-discovery.js"
export type { SkillDiscoveryShape } from "./skill-discovery.js"

export { SkillInspector, SkillInspectorLive } from "./skill-inspector.js"
export type { SkillInspectorShape } from "./skill-inspector.js"

export { FrontmatterService, FrontmatterServiceLive } from "./frontmatter-service.js"
export type { FrontmatterServiceShape, FrontmatterMap } from "./frontmatter-service.js"

export { ProtocolService, ProtocolServiceLive } from "./protocol-service.js"
export type { ProtocolServiceShape } from "./protocol-service.js"

export { UtilService, UtilServiceLive } from "./util-service.js"
export type { UtilServiceShape } from "./util-service.js"

export { SkillMutations, SkillMutationsLive } from "./skill-mutations.js"
export type { SkillMutationsShape } from "./skill-mutations.js"

export { FreshnessService, FreshnessServiceLive } from "./freshness-service.js"
export type { FreshnessServiceShape } from "./freshness-service.js"

// ── Types ────────────────────────────────────────────────────────

export type {
  SkillInfo, SkillType, HealthCheck, HealthReport, WorkspaceRow,
  ConformanceResult, UtilInfo, UtilResult,
  UpdateStatus, UpdatePolicy, FreshnessReport, ProfileResult,
} from "./types.js"

// ── Errors ───────────────────────────────────────────────────────

export {
  SkillNotFound, FileReadError, ParseError,
  ProtocolNotFound, UtilNotFound, ExecutionError,
  MetaskillError,
} from "./errors.js"
export type {
  SkillNotFound as SkillNotFoundType,
  FileReadError as FileReadErrorType,
  MetaskillError as MetaskillErrorType,
} from "./errors.js"

// ── Layer Composition ────────────────────────────────────────────

import * as Layer from "effect-v4/Layer"
import { FileSystem } from "effect-v4/FileSystem"
import { makeSkillConfigLayer } from "./skill-config.js"
import { SkillDiscoveryLive } from "./skill-discovery.js"
import { SkillInspectorLive } from "./skill-inspector.js"
import { FrontmatterServiceLive } from "./frontmatter-service.js"
import { ProtocolServiceLive } from "./protocol-service.js"
import { UtilServiceLive } from "./util-service.js"
import { SkillMutationsLive } from "./skill-mutations.js"
import { FreshnessServiceLive } from "./freshness-service.js"

/**
 * Build the full metaskill service layer graph for a given cwd.
 *
 * Requires FileSystem in the environment — caller must provide it.
 *
 * @example
 * ```ts
 * import { NodeFileSystem } from "effect-v4/NodeFileSystem"  // or custom
 * const layer = makeMetaskillLayer("/path/to/project")
 * const runtime = ManagedRuntime.make(layer.pipe(Layer.provide(NodeFileSystem.layer)))
 * ```
 */
export function makeMetaskillLayer(cwd: string) {
  const configLayer = makeSkillConfigLayer(cwd)

  // Discovery depends on Config + FileSystem
  const discoveryLayer = SkillDiscoveryLive.pipe(
    Layer.provide(configLayer),
  )

  // Inspector depends on Discovery + Config + FileSystem
  const inspectorLayer = SkillInspectorLive.pipe(
    Layer.provide(discoveryLayer),
    Layer.provide(configLayer),
  )

  // Freshness depends on Discovery + Config + FileSystem
  const freshnessLayer = FreshnessServiceLive.pipe(
    Layer.provide(discoveryLayer),
    Layer.provide(configLayer),
  )

  // These depend on Config + FileSystem
  const frontmatterLayer = FrontmatterServiceLive.pipe(Layer.provide(configLayer))
  const protocolLayer = ProtocolServiceLive.pipe(Layer.provide(configLayer))
  const utilLayer = UtilServiceLive.pipe(Layer.provide(configLayer))
  const mutationsLayer = SkillMutationsLive.pipe(Layer.provide(configLayer))

  // FileSystem requirement flows through — caller provides it.
  return Layer.mergeAll(
    configLayer,
    discoveryLayer,
    inspectorLayer,
    freshnessLayer,
    frontmatterLayer,
    protocolLayer,
    utilLayer,
    mutationsLayer,
  )
}

// ── Composed Helpers ─────────────────────────────────────────────

import * as Effect from "effect-v4/Effect"
import { SkillDiscovery } from "./skill-discovery.js"
import { SkillInspector } from "./skill-inspector.js"
import { FreshnessService } from "./freshness-service.js"
import type { SkillInfo, ProfileResult } from "./types.js"

/** profile — inspect + conformance + freshness in one call */
export const profile = (name: string) => Effect.gen(function*() {
  const inspector = yield* SkillInspector
  const freshSvc = yield* FreshnessService
  const h = yield* inspector.inspect(name)
  const c = yield* inspector.conformance(name)
  const f = yield* freshSvc.freshness(name)
  return {
    name,
    health: h.summary,
    level: c.level,
    label: c.label,
    type: c.type,
    policies: f.total,
    stale: f.stale,
    clean: h.clean,
  } satisfies ProfileResult
})

/** each — map over all skills */
export const each = <T>(fn: (s: SkillInfo) => T) => Effect.gen(function*() {
  const discovery = yield* SkillDiscovery
  const skills = yield* discovery.discover
  return skills.map(fn)
})

/** where — filter + map over skills */
export const where = <T>(pred: (s: SkillInfo) => boolean, fn: (s: SkillInfo) => T) =>
  Effect.gen(function*() {
    const discovery = yield* SkillDiscovery
    const skills = yield* discovery.discover
    return skills.filter(pred).map(fn)
  })
