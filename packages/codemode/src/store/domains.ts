/**
 * @module domains
 *
 * Self-bootstrapping domain registration for RLM Store v2.
 * Domain configs are stored in the `_system.domains` collection.
 * Each domain declares collections, meta requirements, and description.
 * Persists across sessions.
 */
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Context from "effect/Context"
import { RlmStore } from "./service.js"
import { validateDomainConfig, type DomainConfig } from "./schemas.js"

// ── Service Shape ────────────────────────────────────────────────

export interface DomainRegistryShape {
  /**
   * Register a domain config.
   * Stored in `_system.domains` with key = domain name.
   */
  readonly register: (name: string, config: DomainConfig) => Effect.Effect<void, any>

  /**
   * List all registered domains.
   */
  readonly list: () => Effect.Effect<readonly { name: string; config: DomainConfig }[], any>

  /**
   * Get domain config for a namespace.
   * Strips sub-segments to find the matching domain.
   * e.g. "osint.scans.mil" → checks "osint.scans.mil", then "osint.scans", then "osint"
   */
  readonly getConfig: (ns: string) => Effect.Effect<DomainConfig | null, any>
}

// ── Service Tag ──────────────────────────────────────────────────

export class DomainRegistry extends Context.Service<DomainRegistry, DomainRegistryShape>()(
  "@tmnl/rlm/DomainRegistry"
) {}

// ── Layer ────────────────────────────────────────────────────────

export const DomainRegistryLive = Layer.effect(
  DomainRegistry,
  Effect.gen(function*() {
    const store = yield* RlmStore

    return DomainRegistry.of({
      register: (name, config) =>
        Effect.gen(function*() {
          // Validate config via Schema
          const validConfig = validateDomainConfig(config)
          yield* store.put("_system.domains", name, {
            _meta: {
              summary: `Domain config: ${name}`,
              schema: "domain-config-v1",
            },
            ...validConfig,
          })
        }).pipe(Effect.withSpan("DomainRegistry.register", { attributes: { name } })),

      list: () =>
        Effect.gen(function*() {
          const objects = yield* store.query("_system.domains")
          return objects.map((obj) => {
            const { _meta, ...config } = obj.data as Record<string, unknown>
            return {
              name: obj.key,
              config: config as unknown as DomainConfig,
            }
          })
        }).pipe(Effect.withSpan("DomainRegistry.list")),

      getConfig: (ns) =>
        Effect.gen(function*() {
          // Walk up the namespace hierarchy
          const segments = ns.split(".")
          for (let i = segments.length; i > 0; i--) {
            const candidate = segments.slice(0, i).join(".")
            const data = yield* store.get("_system.domains", candidate)
            if (data) return data as unknown as DomainConfig
          }
          return null
        }).pipe(Effect.withSpan("DomainRegistry.getConfig", { attributes: { ns } })),
    })
  })
)
