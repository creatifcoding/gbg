import { describe, expect, it } from "vitest"
import { Effect } from "effect"
import {
  adaptersFromProviderRegistry,
  completionToRow,
  makeStaticRowsAdapter,
} from "../laneAdapters"
import type { QueryRow, ResultKind } from "../types"
import {
  createProviderId,
  providerRegistry,
  type CompletionProvider,
} from "../../../../minibuffer/v2/providers"

describe("nu-cmdk lane adapters", () => {
  it("maps generic completion kinds to query rows", () => {
    const row = completionToRow(
      {
        providerId: "workspace-results",
        laneId: "workspace",
      },
      {
        value: "src/lib/minibuffer/v2/providers.ts",
        label: "providers.ts",
        description: "Provider registry",
        kind: "file",
        category: "workspace",
        section: "Workspace",
        badges: [{ text: "GLOBAL", tone: "info" }],
        shortcuts: "g+t",
        score: 0.81,
      },
      0,
    )

    expect(String(row.laneId)).toBe("workspace")
    expect(row.category).toBe("file")
    expect(row.rendererToken).toBe("workspace-results/file/list@v1")
    expect(row.resolverIdentity).toBe("docs:http.fetch@v1")
    expect(row.providerId).toBe("workspace-results")
    expect(row.label).toBe("providers.ts")
    expect(row.description).toBe("Provider registry")
    expect(row.sectionKey).toBe("workspace")
    expect(row.sectionTitle).toBe("Workspace")
    expect(row.shortcuts).toEqual(["g", "t"])
    expect(row.badges?.[0]?.text).toBe("GLOBAL")
  })

  it("supports static adapters returning mixed row categories", async () => {
    const rows: ReadonlyArray<QueryRow> = [
      {
        rowId: "doc-row-1",
        laneId: "docs",
        score: 0.77,
        category: "docs",
        rendererToken: "docs/document/list@v2",
        resolverIdentity: "docs:http.fetch@v1",
      } as unknown as QueryRow,
      {
        rowId: "agent-row-1",
        laneId: "docs",
        score: 0.74,
        category: "agent",
        rendererToken: "agent/workflow/list@v1",
        resolverIdentity: "search:rpc.lookup@v1",
      } as unknown as QueryRow,
    ]

    const adapter = makeStaticRowsAdapter({
      adapterId: "mixed-static",
      laneId: "docs",
      emits: ["docs", "agent"],
      rows,
    })

    const out = await Effect.runPromise(
      adapter.search({ query: "find", scope: "global" }),
    )

    expect(out).toHaveLength(2)
    expect(out.some((row) => row.category === "agent")).toBe(true)
    expect(out.some((row) => row.category === "docs")).toBe(true)
  })

  it("builds adapters from provider registry with typed emits override", () => {
    const providerId = createProviderId("nu-test-registry-provider")
    const provider: CompletionProvider = {
      id: providerId,
      label: "Registry Test Provider",
      complete: () => Effect.succeed([]),
    }

    providerRegistry.register(provider)

    try {
      const adapters = adaptersFromProviderRegistry({
        include: (p) => p.id === providerId,
        emitsByProviderId: {
          [providerId]: ["docs", "file"] as ReadonlyArray<ResultKind>,
        },
      })

      expect(adapters).toHaveLength(1)
      expect(adapters[0]?.emits).toEqual(["docs", "file"])
    } finally {
      providerRegistry.unregister(providerId)
    }
  })
})
