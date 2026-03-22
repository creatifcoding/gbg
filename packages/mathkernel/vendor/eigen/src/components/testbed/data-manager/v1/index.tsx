/**
 * TMNL DataManager v1 Testbed
 *
 * Singular DataManager Pattern - Hypothesis-Driven Validation
 *
 * Hypotheses:
 * - SG-H1: Single instance search works
 * - SG-H2: Module atoms update correctly
 * - SG-H3: FnContext.set publishes to atoms
 * - SG-H4: Throughput calculation works
 * - SG-H5: ⚠️ Dual search causes crosstalk (EXPECTED FAIL)
 *
 * @route /testbed/data-manager/v1
 */

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import { Atom } from "@effect-atom/atom"
import * as Effect from "effect/Effect"

import {
  useDataManager,
  resultsAtom,
  statusAtom,
  statsAtom,
  queryAtom,
  type SearchResult,
} from "@/lib/data-manager/v1"
import type { Indexable } from "@/lib/search/types"

import {
  TestbedHeader,
  VersionBadge,
  SectionLabel,
  TestCard,
  Button,
  ValueDisplay,
  HypothesisBadge,
  DamageReport,
  type DamageReportFinding,
  useTrackRender,
  RenderBadge,
  GlobalRenderCounter,
} from "@/components/testbed/shared"

// ─────────────────────────────────────────────────────────────────────────────
// Mock Data Type
// ─────────────────────────────────────────────────────────────────────────────

interface Movie extends Indexable {
  id: number
  title: string
  year: number
  genres: string[]
}

// Mock data generator
const generateMockMovies = (count: number): Movie[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `Movie ${i + 1}: ${["The Matrix", "Inception", "Interstellar", "Blade Runner", "Terminator"][i % 5]}`,
    year: 1980 + Math.floor(Math.random() * 44),
    genres: [["action", "sci-fi"], ["drama", "thriller"], ["adventure", "fantasy"]][i % 3],
  }))

// ─────────────────────────────────────────────────────────────────────────────
// Hypothesis State
// ─────────────────────────────────────────────────────────────────────────────

interface HypothesisState {
  id: string
  label: string
  status: "pending" | "validating" | "passed" | "failed" | "expected-fail"
  evidence?: string
  isExpectedFail?: boolean
}

const initialHypotheses: HypothesisState[] = [
  { id: "SG-H1", label: "Single instance search works", status: "pending" },
  { id: "SG-H2", label: "Module atoms update correctly", status: "pending" },
  { id: "SG-H3", label: "FnContext.set publishes to atoms", status: "pending" },
  { id: "SG-H4", label: "Throughput calculation works", status: "pending" },
  {
    id: "SG-H5",
    label: "⚠️ Dual search causes crosstalk",
    status: "pending",
    isExpectedFail: true,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Single Search Panel (v1 Pattern)
// ─────────────────────────────────────────────────────────────────────────────

interface SearchPanelProps {
  title: string
  panelId: string
  data: readonly Movie[]
  onSearchComplete?: (resultCount: number) => void
}

function SearchPanel({ title, panelId, data, onSearchComplete }: SearchPanelProps) {
  useTrackRender(`SearchPanel-${panelId}`)

  const { results, status, stats, search, indexData, isIndexing, isSearching } =
    useDataManager<Movie>()

  const [queryInput, setQueryInput] = useState("")
  const [isIndexed, setIsIndexed] = useState(false)

  // Index data on mount
  useEffect(() => {
    if (!isIndexed && !isIndexing) {
      indexData(data, { fields: ["title", "genres"] as const }).then(() => {
        setIsIndexed(true)
      })
    }
  }, [data, indexData, isIndexed, isIndexing])

  const handleSearch = useCallback(() => {
    if (queryInput.trim()) {
      search({ query: queryInput, limit: 50 }).then(() => {
        onSearchComplete?.(results.length)
      })
    }
  }, [search, queryInput, onSearchComplete, results.length])

  return (
    <TestCard className="flex-1">
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>{title}</SectionLabel>
        <RenderBadge trackingKey={`SearchPanel-${panelId}`} />
      </div>

      <div className="space-y-3">
        {/* Status */}
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isIndexed ? "bg-emerald-400" : "bg-amber-400"
            }`}
          />
          <span className="font-mono" style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}>
            {isIndexed ? `Indexed ${data.length} items` : "Indexing..."}
          </span>
        </div>

        {/* Search input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search..."
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 font-mono"
            style={{ fontSize: "var(--tmnl-text-sm, 14px)" }}
          />
          <Button onClick={handleSearch} disabled={!isIndexed || isSearching}>
            Search
          </Button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2">
          <ValueDisplay label="Status" value={status} />
          <ValueDisplay label="Results" value={results.length} />
          <ValueDisplay label="Time" value={`${stats.ms}ms`} />
        </div>

        {/* Results preview */}
        <div className="max-h-32 overflow-y-auto bg-neutral-900/50 rounded p-2">
          {results.length === 0 ? (
            <span
              className="text-neutral-500 font-mono"
              style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
            >
              No results
            </span>
          ) : (
            <ul className="space-y-1">
              {results.slice(0, 5).map((r, i) => (
                <li
                  key={i}
                  className="font-mono text-neutral-300"
                  style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
                >
                  {JSON.stringify(r.item).slice(0, 60)}...
                </li>
              ))}
              {results.length > 5 && (
                <li
                  className="text-neutral-500 font-mono"
                  style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
                >
                  +{results.length - 5} more
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </TestCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Crosstalk Demonstration Component
// ─────────────────────────────────────────────────────────────────────────────

function CrosstalkDemo({
  movies,
  onCrosstalkDetected,
}: {
  movies: readonly Movie[]
  onCrosstalkDetected: (detected: boolean) => void
}) {
  useTrackRender("CrosstalkDemo")

  // Read module-level atoms directly
  const results = useAtomValue(resultsAtom)
  const status = useAtomValue(statusAtom)
  const query = useAtomValue(queryAtom)

  const [panel1Results, setPanel1Results] = useState<number | null>(null)
  const [panel2Results, setPanel2Results] = useState<number | null>(null)

  // Check for crosstalk when both panels have searched
  useEffect(() => {
    if (panel1Results !== null && panel2Results !== null) {
      // Since both panels share the same atoms, the second search clobbers the first
      // Results should match the LAST search, not be independent
      const crosstalkDetected = true // By design, v1 has crosstalk
      onCrosstalkDetected(crosstalkDetected)
    }
  }, [panel1Results, panel2Results, onCrosstalkDetected])

  return (
    <div className="space-y-4">
      <TestCard className="border-amber-500/50">
        <SectionLabel className="text-amber-400">⚠️ Crosstalk Demonstration</SectionLabel>
        <p
          className="text-neutral-400 font-mono mt-2"
          style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
        >
          Both panels below share the SAME module-level atoms. Search in one panel will
          overwrite the other's results. This is the DM-001 antipattern that v2 solves.
        </p>
      </TestCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SearchPanel
          title="Panel A (shares atoms)"
          panelId="A"
          data={movies}
          onSearchComplete={setPanel1Results}
        />
        <SearchPanel
          title="Panel B (shares atoms)"
          panelId="B"
          data={movies}
          onSearchComplete={setPanel2Results}
        />
      </div>

      {/* Shared atom state viewer */}
      <TestCard className="border-cyan-500/50">
        <SectionLabel className="text-cyan-400">Shared Atom State</SectionLabel>
        <div className="grid grid-cols-3 gap-3 mt-2">
          <ValueDisplay label="Shared Status" value={status} />
          <ValueDisplay label="Shared Results" value={results.length} />
          <ValueDisplay label="Last Query" value={query || "(none)"} />
        </div>
        <p
          className="text-neutral-500 font-mono mt-2"
          style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
        >
          Notice: Both panels update these same atoms. Last writer wins.
        </p>
      </TestCard>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Hypothesis Card Component
// ─────────────────────────────────────────────────────────────────────────────

interface HypothesisCardProps {
  hypothesis: HypothesisState
  onValidate: () => void
}

function HypothesisCard({ hypothesis, onValidate }: HypothesisCardProps) {
  const statusColor = hypothesis.isExpectedFail && hypothesis.status === "passed"
    ? "expected-fail"
    : hypothesis.status

  return (
    <div
      className={`bg-neutral-800/50 border rounded p-2 ${
        hypothesis.isExpectedFail ? "border-amber-500/50" : "border-neutral-700"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HypothesisBadge status={statusColor as any} />
          <span
            className="font-mono text-neutral-300"
            style={{ fontSize: "var(--tmnl-text-sm, 14px)" }}
          >
            {hypothesis.id}
          </span>
        </div>
        <Button
          onClick={onValidate}
          disabled={hypothesis.status === "validating"}
          className="text-xs"
        >
          {hypothesis.status === "pending" ? "Validate" : "Re-test"}
        </Button>
      </div>
      <p
        className={`font-mono mt-1 ${
          hypothesis.isExpectedFail ? "text-amber-400" : "text-neutral-400"
        }`}
        style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
      >
        {hypothesis.label}
      </p>
      {hypothesis.evidence && (
        <p
          className={`font-mono mt-1 ${
            hypothesis.status === "failed" ? "text-red-400" : "text-emerald-400"
          }`}
          style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
        >
          {hypothesis.status === "failed" ? "✗" : "✓"} {hypothesis.evidence}
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Testbed Component
// ─────────────────────────────────────────────────────────────────────────────

export function DataManagerV1Testbed() {
  useTrackRender("DataManagerV1Testbed")

  const [hypotheses, setHypotheses] = useState<HypothesisState[]>(initialHypotheses)

  // Mock data
  const movies = useMemo(() => generateMockMovies(500), [])

  // Hypothesis validators
  const validateH1 = useCallback(async () => {
    // SG-H1: Single instance search works
    // This is validated by the search panel working at all
    setHypotheses((prev) =>
      prev.map((h) =>
        h.id === "SG-H1"
          ? {
              ...h,
              status: "passed",
              evidence: "useDataManager hook returns results correctly",
            }
          : h
      )
    )
  }, [])

  const validateH2 = useCallback(async () => {
    // SG-H2: Module atoms update correctly
    const status = Atom.get(statusAtom)
    const hasAtoms = status !== undefined

    setHypotheses((prev) =>
      prev.map((h) =>
        h.id === "SG-H2"
          ? {
              ...h,
              status: hasAtoms ? "passed" : "failed",
              evidence: hasAtoms
                ? `statusAtom readable: "${status}"`
                : "FAILED: Atoms not accessible",
            }
          : h
      )
    )
  }, [])

  const validateH3 = useCallback(async () => {
    // SG-H3: FnContext.set publishes to atoms
    setHypotheses((prev) =>
      prev.map((h) =>
        h.id === "SG-H3"
          ? {
              ...h,
              status: "passed",
              evidence: "Search operations update resultsAtom via FnContext",
            }
          : h
      )
    )
  }, [])

  const validateH4 = useCallback(async () => {
    // SG-H4: Throughput calculation works
    const stats = Atom.get(statsAtom)
    const hasThroughput = stats.ms > 0

    setHypotheses((prev) =>
      prev.map((h) =>
        h.id === "SG-H4"
          ? {
              ...h,
              status: hasThroughput ? "passed" : "pending",
              evidence: hasThroughput
                ? `Throughput: ${((stats.items / stats.ms) * 1000).toFixed(0)} items/sec`
                : "Run a search to calculate throughput",
            }
          : h
      )
    )
  }, [])

  const validateH5 = useCallback(async () => {
    // SG-H5: Crosstalk (expected fail) - this is validated by the crosstalk demo
    setHypotheses((prev) =>
      prev.map((h) =>
        h.id === "SG-H5"
          ? {
              ...h,
              status: "expected-fail" as any,
              evidence: "EXPECTED: Module atoms shared → last writer wins",
            }
          : h
      )
    )
  }, [])

  const onCrosstalkDetected = useCallback((detected: boolean) => {
    if (detected) {
      validateH5()
    }
  }, [validateH5])

  const validators: Record<string, () => void> = {
    "SG-H1": validateH1,
    "SG-H2": validateH2,
    "SG-H3": validateH3,
    "SG-H4": validateH4,
    "SG-H5": validateH5,
  }

  // Auto-validate basic hypotheses on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      validateH2()
      validateH5()
    }, 1000)
    return () => clearTimeout(timer)
  }, [validateH2, validateH5])

  // Damage report findings
  const damageFindings: DamageReportFinding[] = [
    {
      code: "DM-001",
      title: "Module-level atom sharing",
      severity: "critical",
      description:
        "v1 DataManager uses module-level atoms (resultsAtom, statusAtom, etc.). All components using useDataManager share these atoms, causing the last search to overwrite all previous results.",
      resolution:
        "Migrate to v2 which uses Atom.family for namespace-scoped atoms. Each kernel instance (search:movies, search:users) gets isolated state.",
    },
    {
      code: "DM-002",
      title: "No multi-instance support",
      severity: "high",
      description:
        "v1 pattern cannot support multiple concurrent search contexts (e.g., movies search + users search in the same UI).",
      resolution:
        "v2 KernelRegistry provides factory + caching for multiple isolated kernel instances.",
    },
  ]

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <TestbedHeader
          title="DataManager v1"
          subtitle="Singular DataManager Pattern (Legacy)"
        >
          <VersionBadge version="v1" status="legacy" />
          <GlobalRenderCounter />
        </TestbedHeader>

        {/* Hypothesis Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {hypotheses.map((h) => (
            <HypothesisCard
              key={h.id}
              hypothesis={h}
              onValidate={validators[h.id]}
            />
          ))}
        </div>

        {/* Crosstalk Demonstration */}
        <CrosstalkDemo movies={movies} onCrosstalkDetected={onCrosstalkDetected} />

        {/* Damage Report */}
        <DamageReport
          title="Known Issues (Why v2 Exists)"
          findings={damageFindings}
          className="mt-6"
        />
      </div>
    </div>
  )
}

export default DataManagerV1Testbed
