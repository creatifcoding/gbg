/**
 * @module plugins/metaskill
 *
 * Metaskill domain plugin — skill governance codemod operations.
 *
 * Backed by 8 Effect v4 Context.Service classes with FileSystem DI.
 * The plugin owns a ManagedRuntime that services resolve through.
 * Methods are async (Effect.runPromise at the boundary).
 *
 * @example
 * ```ts
 * import { createCodemode } from "@tmnl/codemode"
 * import { metaskillPlugin } from "@tmnl/codemode/plugins/metaskill"
 *
 * const codemode = await createCodemode({
 *   sqlLayer: sqliteNodeLayer({ filename: dbPath }),
 *   plugins: [metaskillPlugin(cwd, fsLayer)],
 *   cwd,
 * })
 * ```
 */

import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as ManagedRuntime from "effect-v4/ManagedRuntime"
import type { FileSystem } from "effect-v4/FileSystem"
import type { CodemodeOverlay } from "../overlay.js"
import {
  makeMetaskillLayer,
  SkillDiscovery,
  SkillInspector,
  FrontmatterService,
  ProtocolService,
  UtilService,
  SkillMutations,
  FreshnessService,
  profile as profileEffect,
  each as eachEffect,
  where as whereEffect,
} from "./metaskill-services/index.js"

/**
 * Create the metaskill domain plugin.
 *
 * @param cwd - Working directory (for skill discovery paths)
 * @param fsLayer - FileSystem layer (caller provides — Node, Bun, or mock)
 */
export function metaskillPlugin(cwd: string, fsLayer: Layer.Layer<FileSystem>): CodemodeOverlay {
  const layer = makeMetaskillLayer(cwd).pipe(Layer.provide(fsLayer))
  const runtime = ManagedRuntime.make(layer)

  const run = <A>(effect: Effect.Effect<A, any, any>): Promise<A> => runtime.runPromise(effect)

  return {
    id: "metaskill",
    name: "Skill Governance",

    methods: {
      // ── Discovery (2) ────────────────────────────────
      discover: () => run(Effect.gen(function*() {
        const svc = yield* SkillDiscovery
        return yield* svc.discover
      })),

      info: (name: string) => run(Effect.gen(function*() {
        const svc = yield* SkillDiscovery
        return yield* svc.info(name)
      })),

      // ── Inspection (4) ───────────────────────────────
      inspect: (name: string) => run(Effect.gen(function*() {
        const svc = yield* SkillInspector
        return yield* svc.inspect(name)
      })),

      audit: () => run(Effect.gen(function*() {
        const svc = yield* SkillInspector
        return yield* svc.audit
      })),

      conformance: (name: string) => run(Effect.gen(function*() {
        const svc = yield* SkillInspector
        return yield* svc.conformance(name)
      })),

      conformanceAudit: () => run(Effect.gen(function*() {
        const svc = yield* SkillInspector
        return yield* svc.conformanceAudit
      })),

      // ── Freshness (4) ────────────────────────────────
      freshness: (name: string) => run(Effect.gen(function*() {
        const svc = yield* FreshnessService
        return yield* svc.freshness(name)
      })),

      setUpdateStatus: (path: string, status: string) => run(Effect.gen(function*() {
        const svc = yield* FreshnessService
        return yield* svc.setUpdateStatus(path, status as any)
      })),

      freshnessAll: () => run(Effect.gen(function*() {
        const svc = yield* FreshnessService
        return yield* svc.freshnessAll
      })),

      staleAll: () => run(Effect.gen(function*() {
        const svc = yield* FreshnessService
        return yield* svc.staleAll
      })),

      // ── Composed (3) ─────────────────────────────────
      profile: (name: string) => run(profileEffect(name)),

      each: (fn: Function) => run(eachEffect(fn as any)),

      where: (pred: Function, fn: Function) => run(whereEffect(pred as any, fn as any)),

      // ── Frontmatter (2) ──────────────────────────────
      frontmatter: (name: string) => run(Effect.gen(function*() {
        const svc = yield* FrontmatterService
        return yield* svc.frontmatter(name)
      })),

      setFrontmatter: (path: string, field: string, value: string) => run(Effect.gen(function*() {
        const svc = yield* FrontmatterService
        return yield* svc.setFrontmatter(path, field, value)
      })),

      // ── Protocols (2) ────────────────────────────────
      protocol: (key: string) => run(Effect.gen(function*() {
        const svc = yield* ProtocolService
        return yield* svc.protocol(key)
      })),

      protocols: () => run(Effect.gen(function*() {
        const svc = yield* ProtocolService
        return yield* svc.protocols
      })),

      // ── Utils (2) ────────────────────────────────────
      utils: () => run(Effect.gen(function*() {
        const svc = yield* UtilService
        return yield* svc.utils
      })),

      runUtil: (utilName: string, skillName: string) => run(Effect.gen(function*() {
        const svc = yield* UtilService
        return yield* svc.runUtil(utilName, skillName)
      })),

      // ── Mutations (2) ────────────────────────────────
      adopt: (name: string) => run(Effect.gen(function*() {
        const svc = yield* SkillMutations
        return yield* svc.adopt(name)
      })),

      scaffold: (name: string, opts?: { refs?: boolean }) => run(Effect.gen(function*() {
        const svc = yield* SkillMutations
        return yield* svc.scaffold(name, opts)
      })),
    },

    dispose: () => runtime.dispose(),

    guide: {
      sections: [{
        id: "metaskill-ops",
        slot: "api" as const,
        priority: 20,
        content: () => [
        "### Discovery",
        "  cm.discover()                   → SkillInfo[]  (all skills with metadata)",
        "  cm.info(\"name\")                 → SkillInfo    (single skill)",
        "",
        "### Inspection",
        "  cm.inspect(\"name\")              → HealthReport (governance, frontmatter, orphans, dead links, children sync, cross symmetry, graph, changelog, update-freshness)",
        "  cm.audit()                      → WorkspaceRow[] (one row per skill: governed, fileCount, fmMissing)",
        "",
        "### Frontmatter",
        "  cm.frontmatter(\"name\")          → { \"file.md\": { up: \"...\", prereqs: \"...\" } }",
        "  cm.setFrontmatter(path, field, value)  → void",
        "",
        "### Protocols",
        "  cm.protocol(\"§ skill:inspect\")  → string (protocol body from SKILL.md)",
        "  cm.protocols()                  → string[] (all protocol keys)",
        "",
        "### Utils",
        "  cm.utils()                      → UtilInfo[] (available utils)",
        "  cm.runUtil(\"full-health\", \"nx-workspace\") → { output, exitCode }",
        "",
        "### Mutations",
        "  cm.adopt(\"name\")                → string (adds governance line)",
        "  cm.scaffold(\"name\", { refs })   → string[] (created files)",
        "",
        "### Conformance",
        "  cm.conformance(\"name\")          → { level: 0-3, label, type, detail[] }",
        "  cm.conformanceAudit()           → { name, level, label, type }[]",
        "",
        "### Freshness",
        "  cm.freshness(\"name\")            → FreshnessReport (update-policy status per doc)",
        "  cm.setUpdateStatus(path, \"current\"|\"stale\"|\"pending\")  → void",
        "",
        "### Composed",
        "  cm.profile(\"name\")              → { health, level, label, type, policies, stale, clean }",
        "  cm.each(s => expr)              → T[]  (map over all skills — replaces discover().map())",
        "  cm.where(pred, fn)              → T[]  (filter+map — replaces discover().filter().map())",
        "  cm.staleAll()                   → UpdatePolicy[] (all stale docs workspace-wide)",
        "  cm.freshnessAll()               → { total, current, stale, pending, untracked }",
      ].join("\n"),
      }],
    },
  }
}
