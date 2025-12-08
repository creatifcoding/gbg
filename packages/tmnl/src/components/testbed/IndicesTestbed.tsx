/**
 * Indices Testbed
 *
 * Demonstrates the indices builder system in isolation.
 * Shows multi-source composition, narrowing, and stream collection.
 *
 * Route: /testbed/indices
 */

import { useState, useEffect, useCallback } from "react"
import { Effect, Stream } from "effect"
import {
  createIndicesBuilder,
  createNarrowedStream,
  collectAllItems,
  getNarrowingHelp,
  testbedSource,
  dataTestbedSource,
  uiTestbedSource,
  animationTestbedSource,
  type MergedItem,
  type SearchItem,
  type SearchSource,
} from "@/lib/indices"
import {
  TestbedHeader,
  SectionLabel,
  TestCard,
  Button,
  ValueDisplay,
  VersionBadge,
  CodeBlock,
} from "@/components/testbed/shared"

// ─────────────────────────────────────────────────────────────────────────────
// Mock Commands Source (demonstrates multi-source)
// ─────────────────────────────────────────────────────────────────────────────

interface CommandItem extends SearchItem {
  readonly id: string
  readonly name: string
  readonly shortcut?: string
  readonly category: "action" | "navigation" | "tool"
}

const MOCK_COMMANDS: readonly CommandItem[] = [
  { id: "cmd:save", name: "Save File", shortcut: "Ctrl+S", category: "action" },
  { id: "cmd:open", name: "Open File", shortcut: "Ctrl+O", category: "action" },
  { id: "cmd:search", name: "Search", shortcut: "Ctrl+F", category: "tool" },
  { id: "cmd:palette", name: "Command Palette", shortcut: "Ctrl+Shift+P", category: "tool" },
  { id: "cmd:settings", name: "Open Settings", shortcut: "Ctrl+,", category: "navigation" },
  { id: "cmd:terminal", name: "Toggle Terminal", shortcut: "Ctrl+`", category: "tool" },
  { id: "cmd:sidebar", name: "Toggle Sidebar", shortcut: "Ctrl+B", category: "navigation" },
  { id: "cmd:explorer", name: "Focus Explorer", shortcut: "Ctrl+Shift+E", category: "navigation" },
]

const commandSource: SearchSource<CommandItem> = {
  id: "commands",
  name: "Commands",
  narrowKey: "c",
  category: "actions",
  icon: "⌘",
  accent: "amber",
  hidden: false,
  enabled: () => true,
  items: () => Effect.succeed(MOCK_COMMANDS),
  action: (item) =>
    Effect.sync(() => {
      console.log(`[indices] Execute command: ${item.name}`)
    }),
  preview: (item) =>
    Effect.succeed({
      type: "content" as const,
      content: `Command: ${item.name}\nShortcut: ${item.shortcut ?? "None"}`,
    }),
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function IndicesTestbed() {
  // State
  const [allItems, setAllItems] = useState<readonly MergedItem<SearchItem>[]>([])
  const [narrowedItems, setNarrowedItems] = useState<readonly MergedItem<SearchItem>[]>([])
  const [activeNarrow, setActiveNarrow] = useState<string | null>(null)
  const [narrowHelp, setNarrowHelp] = useState("")
  const [collectMs, setCollectMs] = useState(0)
  const [narrowMs, setNarrowMs] = useState(0)
  const [sources, setSources] = useState<readonly SearchSource<SearchItem>[]>([])
  const [log, setLog] = useState<string[]>([])

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev.slice(-9), `[${new Date().toISOString().slice(11, 19)}] ${msg}`])
  }, [])

  // All sources for the builder
  const allSources: readonly SearchSource<SearchItem>[] = [
    testbedSource as SearchSource<SearchItem>,
    commandSource as SearchSource<SearchItem>,
  ]

  // Category-filtered sources (for narrowing demo)
  const categorySources: readonly SearchSource<SearchItem>[] = [
    dataTestbedSource as SearchSource<SearchItem>,
    uiTestbedSource as SearchSource<SearchItem>,
    animationTestbedSource as SearchSource<SearchItem>,
  ]

  // Initialize
  useEffect(() => {
    const program = Effect.gen(function* () {
      const start = performance.now()

      // Build indices
      const indices = yield* createIndicesBuilder(allSources)
      setSources(indices.sources)

      // Collect all items
      const items = yield* Stream.runCollect(indices.stream)
      const itemArray = [...items]
      setAllItems(itemArray)

      // Get narrowing help
      const help = getNarrowingHelp(indices.sources)
      setNarrowHelp(help)

      const elapsed = performance.now() - start
      setCollectMs(elapsed)

      return { count: itemArray.length, elapsed }
    })

    Effect.runPromise(program).then(({ count, elapsed }) => {
      addLog(`Collected ${count} items in ${elapsed.toFixed(1)}ms`)
    })
  }, [addLog])

  // Collect all items
  const handleCollectAll = useCallback(() => {
    const program = Effect.gen(function* () {
      const start = performance.now()
      const items = yield* collectAllItems(allSources)
      const elapsed = performance.now() - start
      setAllItems(items)
      setCollectMs(elapsed)
      setActiveNarrow(null)
      setNarrowedItems([])
      return { count: items.length, elapsed }
    })

    Effect.runPromise(program).then(({ count, elapsed }) => {
      addLog(`Collected ${count} items in ${elapsed.toFixed(1)}ms`)
    })
  }, [addLog])

  // Narrow to a source
  const handleNarrow = useCallback(
    (key: string) => {
      const program = Effect.gen(function* () {
        const start = performance.now()
        const stream = createNarrowedStream(allSources, key)
        const items = yield* Stream.runCollect(stream)
        const elapsed = performance.now() - start
        setNarrowedItems([...items])
        setNarrowMs(elapsed)
        setActiveNarrow(key)
        return { key, count: items.length, elapsed }
      })

      Effect.runPromise(program).then(({ key, count, elapsed }) => {
        const source = allSources.find((s) => s.narrowKey === key)
        addLog(`Narrowed to "${source?.name ?? key}": ${count} items in ${elapsed.toFixed(1)}ms`)
      })
    },
    [addLog]
  )

  // Widen (clear narrow)
  const handleWiden = useCallback(() => {
    setActiveNarrow(null)
    setNarrowedItems([])
    setNarrowMs(0)
    addLog("Widened to all sources")
  }, [addLog])

  // Current display items
  const displayItems = activeNarrow ? narrowedItems : allItems

  return (
    <div className="min-h-screen bg-neutral-950 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <TestbedHeader
          title="Indices Builder"
          description="Multi-source search composition inspired by Emacs Consult"
        >
          <VersionBadge version="v1" status="experimental" />
        </TestbedHeader>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4">
          <TestCard>
            <ValueDisplay
              label="Total Items"
              value={allItems.length}
              unit="items"
            />
          </TestCard>
          <TestCard>
            <ValueDisplay
              label="Sources"
              value={sources.length}
              unit="active"
            />
          </TestCard>
          <TestCard>
            <ValueDisplay
              label="Collect Time"
              value={collectMs.toFixed(1)}
              unit="ms"
            />
          </TestCard>
          <TestCard>
            <ValueDisplay
              label="Narrow Time"
              value={narrowMs.toFixed(1)}
              unit="ms"
            />
          </TestCard>
        </div>

        {/* Controls */}
        <TestCard>
          <SectionLabel>Narrowing Controls</SectionLabel>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={handleCollectAll} variant="secondary">
              Collect All
            </Button>
            <Button
              onClick={() => handleNarrow("t")}
              variant={activeNarrow === "t" ? "primary" : "secondary"}
            >
              t: Testbeds
            </Button>
            <Button
              onClick={() => handleNarrow("c")}
              variant={activeNarrow === "c" ? "primary" : "secondary"}
            >
              c: Commands
            </Button>
            <Button onClick={handleWiden} variant="secondary" disabled={!activeNarrow}>
              Widen
            </Button>
          </div>
          <p
            className="mt-3 font-mono text-neutral-500"
            style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
          >
            Narrowing: {narrowHelp || "No sources"}
          </p>
        </TestCard>

        {/* Two Column Layout */}
        <div className="grid grid-cols-2 gap-6">
          {/* Items List */}
          <TestCard>
            <SectionLabel>
              {activeNarrow
                ? `Narrowed: ${sources.find((s) => s.narrowKey === activeNarrow)?.name ?? activeNarrow}`
                : "All Items"}
              <span className="ml-2 text-neutral-500">({displayItems.length})</span>
            </SectionLabel>
            <div className="mt-3 max-h-96 space-y-1 overflow-y-auto">
              {displayItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded border border-neutral-800 bg-neutral-900 px-3 py-2"
                >
                  <span
                    className="font-mono"
                    style={{
                      fontSize: "var(--tmnl-text-sm, 14px)",
                      color:
                        item._sourceAccent === "cyan"
                          ? "#67e8f9"
                          : item._sourceAccent === "amber"
                            ? "#fcd34d"
                            : item._sourceAccent === "rose"
                              ? "#fb7185"
                              : "#a3a3a3",
                    }}
                  >
                    {item._sourceIcon ?? "◇"}
                  </span>
                  <span
                    className="flex-1 truncate font-mono text-neutral-200"
                    style={{ fontSize: "var(--tmnl-text-sm, 14px)" }}
                  >
                    {"name" in item ? (item as { name: string }).name : item.id}
                  </span>
                  <span
                    className="font-mono text-neutral-600"
                    style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
                  >
                    {item._source}
                  </span>
                </div>
              ))}
              {displayItems.length === 0 && (
                <p className="py-4 text-center text-neutral-600">No items</p>
              )}
            </div>
          </TestCard>

          {/* Log & Info */}
          <div className="space-y-4">
            {/* Sources */}
            <TestCard>
              <SectionLabel>Registered Sources</SectionLabel>
              <div className="mt-3 space-y-2">
                {sources.map((source) => (
                  <div
                    key={source.id}
                    className="flex items-center gap-3 rounded border border-neutral-800 bg-neutral-900 px-3 py-2"
                  >
                    <span
                      className="font-mono"
                      style={{
                        fontSize: "var(--tmnl-text-sm, 14px)",
                        color:
                          source.accent === "cyan"
                            ? "#67e8f9"
                            : source.accent === "amber"
                              ? "#fcd34d"
                              : "#a3a3a3",
                      }}
                    >
                      {source.icon ?? "◇"}
                    </span>
                    <span
                      className="flex-1 font-mono text-neutral-200"
                      style={{ fontSize: "var(--tmnl-text-sm, 14px)" }}
                    >
                      {source.name}
                    </span>
                    {source.narrowKey && (
                      <span
                        className="rounded bg-neutral-800 px-2 py-0.5 font-mono text-neutral-400"
                        style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
                      >
                        {source.narrowKey}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </TestCard>

            {/* Log */}
            <TestCard>
              <SectionLabel>Activity Log</SectionLabel>
              <div
                className="mt-3 max-h-40 space-y-1 overflow-y-auto font-mono text-neutral-500"
                style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
              >
                {log.map((entry, i) => (
                  <div key={i}>{entry}</div>
                ))}
                {log.length === 0 && <div className="text-neutral-700">No activity yet</div>}
              </div>
            </TestCard>

            {/* Code Example */}
            <TestCard>
              <SectionLabel>Usage</SectionLabel>
              <CodeBlock
                language="typescript"
                code={`import { createIndicesBuilder, testbedSource } from '@/lib/indices'
import { Effect, Stream } from 'effect'

const program = Effect.gen(function*() {
  const indices = yield* createIndicesBuilder([
    testbedSource,
    commandSource,
  ])

  // Collect all
  const items = yield* Stream.runCollect(indices.stream)

  // Or narrow to testbeds only
  yield* indices.narrow('t')
})`}
              />
            </TestCard>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IndicesTestbed
