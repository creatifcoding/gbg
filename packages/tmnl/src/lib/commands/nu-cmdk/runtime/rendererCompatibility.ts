import { Schema } from "effect"

export const RendererCompatibilityEntry = Schema.Struct({
  tokenFamily: Schema.String,
  supportedMajors: Schema.Array(Schema.Int),
})

export const RendererCompatibilityMap = Schema.Struct({
  entries: Schema.Array(RendererCompatibilityEntry),
})

export type RendererCompatibilityMap = typeof RendererCompatibilityMap.Type

const tokenFamily = (token: string): string => token.split("@v")[0] ?? token

export const resolveRendererToken = (
  token: string,
  rendererRegistry: ReadonlySet<string>,
  compatibility: RendererCompatibilityMap,
): { token: string | null; outcome: "exact" | "compatible" | "fallback" | "drop" } => {
  if (rendererRegistry.has(token)) return { token, outcome: "exact" }

  const family = tokenFamily(token)
  const mapEntry = compatibility.entries.find((e) => e.tokenFamily === family)
  if (mapEntry) {
    for (const major of mapEntry.supportedMajors) {
      const candidate = `${family}@v${major}`
      if (rendererRegistry.has(candidate)) return { token: candidate, outcome: "compatible" }
    }
  }

  const fallback = "global/fallback/list@v1"
  if (rendererRegistry.has(fallback)) return { token: fallback, outcome: "fallback" }

  return { token: null, outcome: "drop" }
}

export const makeDefaultRendererCompatibilityMap = (): RendererCompatibilityMap => ({
  entries: [
    { tokenFamily: "commands/command/list", supportedMajors: [2, 1] },
    { tokenFamily: "docs/document/list", supportedMajors: [2, 1] },
    { tokenFamily: "agent/workflow/list", supportedMajors: [1] },
  ],
})

export const defaultRendererRegistry = (): ReadonlySet<string> =>
  new Set<string>([
    "commands/command/list@v1",
    "docs/document/list@v2",
    "agent/workflow/list@v1",
    "global/fallback/list@v1",
  ])
