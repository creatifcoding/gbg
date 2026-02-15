import { Effect } from "effect"
import type { Completion } from "../../../minibuffer/v2/machine"
import { providerRegistry, type CompletionProvider } from "../../../minibuffer/v2/providers"
import type { QueryRow, ResultKind, Scope as QueryScope } from "./types"

export type AdapterCostClass = "fast" | "medium" | "heavy"

export interface QueryDispatchPlan {
  readonly rawQuery: string
  readonly normalizedQuery: string
  readonly terms: ReadonlyArray<string>
}

export const makeQueryDispatchPlan = (rawQuery: string): QueryDispatchPlan => {
  const normalizedQuery = rawQuery.trim().toLowerCase()
  const terms = normalizedQuery.length === 0
    ? []
    : normalizedQuery.split(/\s+/).filter((term) => term.length > 0)

  return {
    rawQuery,
    normalizedQuery,
    terms,
  }
}

export interface LaneAdapterInput {
  readonly query: string
  readonly scope: QueryScope
  readonly dispatchPlan?: QueryDispatchPlan
}

export interface LaneAdapter {
  readonly adapterId: string
  readonly laneId: string
  readonly emits: ReadonlyArray<ResultKind>
  readonly costClass: AdapterCostClass
  readonly search: (input: LaneAdapterInput) => Effect.Effect<ReadonlyArray<QueryRow>, unknown, never>
}

export const ALL_RESULT_KINDS = [
  "command",
  "entity",
  "action",
  "navigation",
  "docs",
  "terminal",
  "workflow",
  "agent",
  "history",
  "file",
  "generic",
] as const satisfies ReadonlyArray<ResultKind>

const slug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item"

const toResultKind = (value?: string): ResultKind => {
  const raw = value?.trim().toLowerCase() ?? ""

  switch (raw) {
    case "command":
    case "commands":
      return "command"
    case "entity":
    case "entities":
      return "entity"
    case "action":
    case "actions":
      return "action"
    case "navigation":
    case "nav":
      return "navigation"
    case "doc":
    case "docs":
    case "document":
      return "docs"
    case "terminal":
      return "terminal"
    case "workflow":
      return "workflow"
    case "agent":
      return "agent"
    case "history":
      return "history"
    case "file":
    case "files":
      return "file"
    default:
      return "generic"
  }
}

const inferResolverIdentity = (_providerId: string, completion: Completion): string => {
  const metadata =
    completion.metadata && typeof completion.metadata === "object"
      ? (completion.metadata as Record<string, unknown>)
      : undefined

  const fromMetadata = metadata?.resolverIdentity
  if (typeof fromMetadata === "string" && fromMetadata.length > 0) {
    return fromMetadata
  }

  const kind = completion.kind?.toLowerCase()
  const category = completion.category?.toLowerCase()

  if (kind === "command" || typeof metadata?.commandId === "string") {
    return "commands:open@v1"
  }

  if (kind === "doc" || kind === "file" || category?.includes("doc") || category?.includes("file")) {
    return "docs:http.fetch@v1"
  }

  return "search:rpc.lookup@v1"
}

export const completionToRow = (
  params: {
    providerId: string
    laneId: string
  },
  completion: Completion,
  index: number,
): QueryRow => {
  const kind = toResultKind(completion.kind ?? completion.category)
  const provider = slug(params.providerId)
  const rendererToken = `${provider}/${kind}/list@v1`

  const shortcuts =
    typeof completion.shortcuts === "string"
      ? completion.shortcuts.split("+").map((part) => part.trim()).filter((part) => part.length > 0)
      : completion.shortcuts
        ? [...completion.shortcuts]
        : undefined

  const stableRowId = completion.value.trim().length > 0
    ? completion.value
    : `${provider}:${kind}:${index}`

  return {
    rowId: stableRowId as QueryRow["rowId"],
    laneId: params.laneId as QueryRow["laneId"],
    score: completion.score ?? 0.5,
    category: kind,
    rendererToken,
    resolverIdentity: inferResolverIdentity(params.providerId, completion),
    providerId: params.providerId,
    label: completion.label,
    description: completion.description ?? null,
    badges: completion.badges
      ? completion.badges.map((badge) => ({ text: badge.text, tone: badge.tone }))
      : undefined,
    shortcuts,
    sectionKey: completion.section ? slug(completion.section) : undefined,
    sectionTitle: completion.section,
  }
}

export const makeProviderAdapter = (
  provider: CompletionProvider,
  options?: {
    readonly emits?: ReadonlyArray<ResultKind>
    readonly costClass?: AdapterCostClass
  },
): LaneAdapter => {
  const laneId = `provider-${slug(provider.id)}`
  return {
    adapterId: `provider:${provider.id}`,
    laneId,
    emits: options?.emits ?? ALL_RESULT_KINDS,
    costClass: options?.costClass ?? "medium",
    search: ({ query }) =>
      (provider.complete(query) as Effect.Effect<readonly Completion[], unknown, unknown>).pipe(
        Effect.map((completions) =>
          completions.map((completion, index) =>
            completionToRow({ providerId: provider.id, laneId }, completion, index),
          ),
        ),
        Effect.map((rows) => rows as ReadonlyArray<QueryRow>),
      ) as Effect.Effect<ReadonlyArray<QueryRow>, unknown, never>,
  }
}

export const adaptersFromProviderRegistry = (options?: {
  readonly include?: (provider: CompletionProvider) => boolean
  readonly emitsByProviderId?: Readonly<Record<string, ReadonlyArray<ResultKind>>>
  readonly costClassByProviderId?: Readonly<Record<string, AdapterCostClass>>
}): ReadonlyArray<LaneAdapter> =>
  providerRegistry
    .getAll()
    .filter((provider) => (options?.include ? options.include(provider) : true))
    .map((provider) =>
      makeProviderAdapter(provider, {
        emits: options?.emitsByProviderId?.[provider.id],
        costClass: options?.costClassByProviderId?.[provider.id],
      }),
    )

export const makeStaticRowsAdapter = (params: {
  adapterId: string
  laneId: string
  emits: ReadonlyArray<ResultKind>
  costClass?: AdapterCostClass
  rows: ReadonlyArray<QueryRow> | ((input: LaneAdapterInput) => ReadonlyArray<QueryRow>)
}): LaneAdapter => ({
  adapterId: params.adapterId,
  laneId: params.laneId,
  emits: params.emits,
  costClass: params.costClass ?? "medium",
  search: (input) =>
    Effect.sync(() =>
      typeof params.rows === "function" ? params.rows(input) : params.rows,
    ),
})

export const makeFailingAdapter = (params: {
  adapterId: string
  laneId: string
  emits: ReadonlyArray<ResultKind>
  costClass?: AdapterCostClass
  message: string
}): LaneAdapter => ({
  adapterId: params.adapterId,
  laneId: params.laneId,
  emits: params.emits,
  costClass: params.costClass ?? "medium",
  search: () => Effect.fail(new Error(params.message)),
})
