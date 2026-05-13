/**
 * Declarative tool registry — defineTool() + collectTools().
 *
 * Tools declare themselves with a typed descriptor:
 *   - name, description, parameters (tool spec)
 *   - requires: { dep: ServiceTag } — auto-resolved
 *   - execute: (params, deps) => result — receives resolved deps
 *   - concurrentFriendly: boolean
 *   - systemPromptSection: optional prompt contribution
 *
 * The registry collects all defined tools and resolves them
 * in parallel, skipping tools whose required deps are unavailable.
 *
 * @module harness/tools/registry
 */

import { Context, Effect, Layer, Option } from 'effect'
import type { HarnessTool, ToolContribution } from './types'

// ── Dep resolution primitives ────────────────────────────────

/**
 * Marker for optional deps. Resolves to the service value or null.
 */
export interface OptionalDep<T> {
  readonly _optional: true
  readonly tag: Context.Tag<any, T>
  readonly layer?: Layer.Layer<any, any, any>
}

/**
 * Marker for required deps. Tool is skipped if unavailable.
 */
export interface RequiredDep<T> {
  readonly _optional: false
  readonly tag: Context.Tag<any, T>
  readonly layer?: Layer.Layer<any, any, any>
}

type Dep<T> = RequiredDep<T> | OptionalDep<T>

/** Mark a service dependency as optional. Resolves to value or null. */
export function optional<I, S>(tag: Context.Tag<I, S>, layer?: Layer.Layer<S, any, any>): OptionalDep<S> {
  return { _optional: true, tag, layer }
}

/** Mark a service dependency as required. Tool skipped if missing. */
export function required<I, S>(tag: Context.Tag<I, S>, layer?: Layer.Layer<S, any, any>): RequiredDep<S> {
  return { _optional: false, tag, layer }
}

/** Shorthand: bare tag → required dep. */
function normalizeDep<T>(dep: Context.Tag<any, T> | Dep<T>): Dep<T> {
  if ('_optional' in dep) return dep
  return { _optional: false, tag: dep } as RequiredDep<T>
}

// ── Dep record types ────────────────────────────────────────

type DepsRecord = Record<string, Context.Tag<any, any> | Dep<any>>

type ResolvedDeps<R extends DepsRecord> = {
  [K in keyof R]: R[K] extends OptionalDep<infer T>
    ? T | null
    : R[K] extends RequiredDep<infer T>
      ? T
      : R[K] extends Context.Tag<any, infer T>
        ? T
        : never
}

// ── Tool definition ─────────────────────────────────────────

export interface ToolPromptSection {
  readonly title: string
  readonly priority: number
  readonly content: string
}

export interface ToolDef<R extends DepsRecord = {}> {
  readonly name: string
  readonly description: string
  readonly parameters: unknown
  readonly concurrentFriendly?: boolean
  readonly systemPromptSection?: ToolPromptSection
  readonly requires?: R
  readonly execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    deps: ResolvedDeps<R>,
    signal?: AbortSignal,
    onUpdate?: (partial: { content: Array<{ type: string; text: string }>; details?: unknown }) => void,
  ) => Promise<{ content: Array<{ type: string; text: string }>; details?: unknown; isError?: boolean }>
}

// ── Global registry ─────────────────────────────────────────

const registered: ToolDef<any>[] = []

/**
 * Define and register a tool. Call at module scope.
 * Returns the def for direct reference if needed.
 */
export function defineTool<R extends DepsRecord = {}>(def: ToolDef<R>): ToolDef<R> {
  registered.push(def)
  return def
}

/** Get all registered tool defs (for testing). */
export function getRegisteredTools(): readonly ToolDef<any>[] {
  return registered
}

/** Clear registry (for testing). */
export function clearRegistry(): void {
  registered.length = 0
}

// ── Collection: resolve deps + build contribution ───────────

function resolveOneDep(dep: Dep<any>): Effect.Effect<{ value: any; available: boolean }> {
  if (dep.layer) {
    // Service with a specific Layer to provide
    return Effect.gen(function* () {
      const svc = yield* dep.tag.pipe(Effect.provide(dep.layer!))
      return { value: svc, available: true }
    }).pipe(
      Effect.catchAll(() =>
        dep._optional
          ? Effect.succeed({ value: null, available: true })
          : Effect.succeed({ value: null, available: false }),
      ),
    )
  }

  // Service from ambient context
  return dep.tag.pipe(
    Effect.option,
    Effect.catchAll(() => Effect.succeed(Option.none())),
    Effect.map((opt) => {
      if (Option.isSome(opt)) return { value: opt.value, available: true }
      if (dep._optional) return { value: null, available: true }
      return { value: null, available: false }
    }),
  )
}

function resolveToolDef(def: ToolDef<any>): Effect.Effect<{
  tool: HarnessTool
  concurrentFriendly: boolean
  promptSection?: ToolPromptSection
} | null> {
  return Effect.gen(function* () {
    const deps: Record<string, any> = {}

    if (def.requires) {
      for (const [key, rawDep] of Object.entries(def.requires)) {
        const dep = normalizeDep(rawDep)
        const result = yield* resolveOneDep(dep)
        if (!result.available) {
          console.warn(`[harness] ${def.name} unavailable (${key} not in context)`)
          return null
        }
        deps[key] = result.value
      }
    }

    const tool: HarnessTool = {
      name: def.name,
      description: def.description,
      parameters: def.parameters,
      execute: (toolCallId, params, signal, onUpdate) =>
        def.execute(toolCallId, params, deps, signal, onUpdate),
    }

    console.info(`[harness] ${def.name} tool registered`)
    return {
      tool,
      concurrentFriendly: def.concurrentFriendly ?? false,
      promptSection: def.systemPromptSection,
    }
  }).pipe(
    Effect.catchAll((error) => {
      console.warn(`[harness] ${def.name} registration failed: ${error}`)
      return Effect.succeed(null)
    }),
  )
}

/**
 * Collect all registered tools: resolve deps, skip unavailable,
 * return unified ToolContribution + prompt sections.
 */
export function collectTools(): Effect.Effect<
  ToolContribution & { promptSections: readonly ToolPromptSection[] }
> {
  return Effect.gen(function* () {
    const results = yield* Effect.all(
      registered.map(resolveToolDef),
      { concurrency: 'unbounded' },
    )

    const tools: HarnessTool[] = []
    const concurrentFriendly: string[] = []
    const promptSections: ToolPromptSection[] = []

    for (const result of results) {
      if (result === null) continue
      tools.push(result.tool)
      if (result.concurrentFriendly) {
        concurrentFriendly.push(result.tool.name)
      }
      if (result.promptSection) {
        promptSections.push(result.promptSection)
      }
    }

    return { tools, concurrentFriendly, promptSections }
  })
}
