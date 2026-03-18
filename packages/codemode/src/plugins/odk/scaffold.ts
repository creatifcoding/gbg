/**
 * @module odk/scaffold
 *
 * Scaffold engine — generates CodemodeOverlay-compliant objects
 * and test harnesses from templates.
 *
 * `scaffold()` returns an in-memory overlay ready for validate/inspect.
 * `buildManifest()` generates a guide section manifest.
 * `testHarness()` generates test skeleton code.
 *
 * File I/O is intentionally NOT here — that's the ODK overlay's job
 * (Phase I3). This module is pure computation.
 */

import type { CodemodeOverlay } from "../../overlay.js"
import type { SectionConfig, Slot } from "../../manifest.js"
import type {
  TemplateName,
  TemplateConfig,
  ScaffoldResult,
} from "./types.js"
import { TEMPLATES } from "./templates.js"

// ── Types ────────────────────────────────────────────────────────

export interface ScaffoldOptions {
  /** Overlay name (human-readable) */
  readonly name: string
  /** Template to use */
  readonly template: TemplateName
  /** Override id (default: kebab-case of name) */
  readonly id?: string
  /** Override version */
  readonly version?: string
  /** Custom seed method names (overrides template defaults) */
  readonly methods?: ReadonlyArray<{ name: string; arity?: number; description?: string }>
  /** Guide section slot (default: "api") */
  readonly guideSlot?: Slot
  /** Guide section priority (default: 50) */
  readonly guidePriority?: number
}

// ── Helpers ──────────────────────────────────────────────────────

function toKebab(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase()
}

/**
 * Create a stub function with the correct .name and .length.
 *
 * Uses Object.defineProperty to set .name, and new Function()
 * with dummy params to set .length.
 */
function createStub(methodName: string, arity: number, description?: string): Function {
  // Build param list: _0, _1, _2, ...
  const params = Array.from({ length: arity }, (_, i) => `_${i}`)
  const body = description
    ? `throw new Error("${methodName}: not implemented — ${description}")`
    : `throw new Error("${methodName}: not implemented")`

  // new Function(...params, body) gives correct .length
  const fn = new Function(...params, body)
  Object.defineProperty(fn, "name", { value: methodName, configurable: true })
  return fn
}

// ── Scaffold ─────────────────────────────────────────────────────

/**
 * Generate a CodemodeOverlay-compliant object from a template.
 *
 * Returns a live overlay that passes structural contract validation.
 * Methods are stubs (throw "not implemented") with correct .name/.length.
 */
export function scaffold(opts: ScaffoldOptions): CodemodeOverlay {
  const template = TEMPLATES[opts.template]
  const id = opts.id ?? toKebab(opts.name)
  const version = opts.version ?? "0.1.0"

  // ── Methods ──
  const seedMethods = opts.methods
    ? opts.methods.map((m) => ({ name: m.name, arity: m.arity ?? 0, description: m.description }))
    : template.seedMethods ?? []

  const methods: Record<string, Function> = {}
  for (const m of seedMethods) {
    methods[m.name] = createStub(m.name, m.arity, m.description)
  }

  // ── Build overlay ──
  const overlay: CodemodeOverlay = {
    id,
    name: opts.name,
    version,
    methods,
  }

  // ── Guide ──
  if (template.includeGuide) {
    const guideSlot = opts.guideSlot ?? "api"
    const guidePriority = opts.guidePriority ?? 50
    const methodLines = seedMethods
      .map((m) => `  cm.${m.name}(${paramPlaceholders(m.arity)})${m.description ? `  — ${m.description}` : ""}`)
      .join("\n")

    const content = [
      `### ${opts.name}`,
      methodLines,
    ].join("\n")

    const section: SectionConfig = {
      id: `${id}-ops`,
      slot: guideSlot,
      priority: guidePriority,
      content,
    }

    ;(overlay as any).guide = { sections: [section] }
  }

  // ── Steer ──
  if (template.includeSteer) {
    ;(overlay as any).steer = {
      fragments: [
        {
          id: `${id}-persona`,
          content: `You are the ${opts.name} overlay. Help users with ${id}-related tasks.`,
          priority: 50,
        },
      ],
    }
  }

  // ── Lifecycle ──
  if (template.includeLifecycle) {
    ;(overlay as any).lifecycle = {
      onLoad(_core: unknown) { /* hook: overlay activated */ },
      onUnload() { /* hook: overlay deactivated */ },
    }
  }

  // ── Procedures ──
  if (template.facets.includes("procedures")) {
    ;(overlay as any).procedures = {
      seeds: [],
    }
  }

  // ── Context ──
  if (template.facets.includes("context")) {
    ;(overlay as any).context = {
      provider: () => ({ overlay: id }),
    }
  }

  // ── Rendering ──
  if (template.facets.includes("rendering")) {
    ;(overlay as any).rendering = {
      formatResult: undefined,
      formatCall: undefined,
    }
  }

  // ── Errors ──
  if (template.facets.includes("errors")) {
    ;(overlay as any).errors = {
      handler: undefined,
    }
  }

  // ── Dispose ──
  if (template.facets.includes("dispose")) {
    ;(overlay as any).dispose = () => { /* cleanup */ }
  }

  return overlay
}

// ── Guide Manifest Builder ───────────────────────────────────────

/**
 * Build a guide section manifest for a given overlay name and methods.
 * Useful for generating guide content independently of scaffold().
 */
export function buildManifest(
  overlayName: string,
  overlayId: string,
  methods: ReadonlyArray<{ name: string; arity: number; description?: string }>,
  slot?: Slot,
  priority?: number,
): SectionConfig {
  const methodLines = methods
    .map((m) => `  cm.${m.name}(${paramPlaceholders(m.arity)})${m.description ? `  — ${m.description}` : ""}`)
    .join("\n")

  return {
    id: `${overlayId}-ops`,
    slot: slot ?? "api",
    priority: priority ?? 50,
    content: `### ${overlayName}\n${methodLines}`,
  }
}

// ── Test Harness Generator ───────────────────────────────────────

/**
 * Generate a test harness string for a scaffolded overlay.
 *
 * Returns a string of TypeScript test code (vitest format)
 * that validates the overlay passes ODK contract/conformance.
 */
export function testHarness(
  overlayId: string,
  overlayName: string,
  template: TemplateName,
  methods: ReadonlyArray<{ name: string; arity: number }>,
): string {
  const tpl = TEMPLATES[template]
  const methodAssertions = methods
    .map((m) => `    expect(typeof overlay.methods.${m.name}).toBe("function")\n    expect(overlay.methods.${m.name}.name).toBe("${m.name}")\n    expect(overlay.methods.${m.name}.length).toBe(${m.arity})`)
    .join("\n\n")

  const lines = [
    `import { describe, it, expect } from "vitest"`,
    `import { validate, conformance, inspect } from "@tmnl/codemode/plugins/odk"`,
    `// TODO: import your overlay`,
    `// import { overlay } from "./${overlayId}"`,
    ``,
    `// Scaffold stub for testing — replace with real overlay`,
    `import { scaffold } from "@tmnl/codemode/plugins/odk"`,
    `const overlay = scaffold({ name: "${overlayName}", template: "${template}" })`,
    ``,
    `describe("${overlayName} overlay", () => {`,
    `  it("has correct identity", () => {`,
    `    expect(overlay.id).toBe("${overlayId}")`,
    `    expect(overlay.name).toBe("${overlayName}")`,
    `  })`,
    ``,
    `  it("methods have correct shape", () => {`,
    methodAssertions,
    `  })`,
    ``,
    `  it("passes contract validation", () => {`,
    `    const report = validate(overlay)`,
    `    expect(report.valid).toBe(true)`,
    `    expect(report.errors).toHaveLength(0)`,
    `  })`,
    ``,
    `  it("reaches conformance level >= 1", () => {`,
    `    const result = conformance(overlay)`,
    `    expect(result.level).toBeGreaterThanOrEqual(1)`,
    `  })`,
    ``,
    `  it("full inspection report", () => {`,
    `    const report = inspect(overlay)`,
    `    expect(report.contract.valid).toBe(true)`,
    `    expect(report.facets.methods).toBe(true)`,
    tpl.includeGuide ? `    expect(report.facets.guide).toBe(true)` : "",
    tpl.includeSteer ? `    expect(report.facets.steer).toBe(true)` : "",
    tpl.includeLifecycle ? `    expect(report.facets.lifecycle).toBe(true)` : "",
    `  })`,
    `})`,
  ].filter(Boolean)

  return lines.join("\n")
}

// ── Internal Helpers ─────────────────────────────────────────────

function paramPlaceholders(arity: number): string {
  if (arity === 0) return ""
  return Array.from({ length: arity }, (_, i) => {
    const names = ["name", "config", "opts", "target", "value"]
    return names[i] ?? `arg${i}`
  }).join(", ")
}
