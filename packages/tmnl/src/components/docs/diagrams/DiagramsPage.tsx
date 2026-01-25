/**
 * DiagramsPage
 *
 * Living documentation page for architectural diagrams.
 * Lists all registered diagrams with category filtering.
 *
 * @module docs/diagrams
 */

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { DiagramViewer } from "./DiagramViewer"
import {
  DIAGRAM_REGISTRY,
  getCategoryCounts,
  type DiagramEntry,
  type DiagramCategory,
} from "./registry"

// =============================================================================
// Category Metadata
// =============================================================================

const CATEGORY_META: Record<
  DiagramCategory,
  { label: string; icon: string; description: string }
> = {
  architecture: {
    label: "Architecture",
    icon: "M3 21h18M3 7v1a3 3 0 003 3h12a3 3 0 003-3V7M12 3v4",
    description: "High-level system structure",
  },
  flow: {
    label: "Flow",
    icon: "M9 5l7 7-7 7",
    description: "Data and control flow",
  },
  sequence: {
    label: "Sequence",
    icon: "M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01",
    description: "Message sequences",
  },
  state: {
    label: "State",
    icon: "M12 3v18M3 12h18",
    description: "State machines",
  },
  class: {
    label: "Class",
    icon: "M4 4h16v4H4zM4 12h8v8H4zM16 12h4v8h-4z",
    description: "Class relationships",
  },
  er: {
    label: "ER",
    icon: "M4 6h16M4 10h16M4 14h16M4 18h16",
    description: "Entity relationships",
  },
  integration: {
    label: "Integration",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    description: "Integration patterns & migration",
  },
}

// =============================================================================
// Component
// =============================================================================

export function DiagramsPage() {
  const [selectedDiagram, setSelectedDiagram] = useState<DiagramEntry | null>(
    DIAGRAM_REGISTRY[0] ?? null
  )
  const [categoryFilter, setCategoryFilter] = useState<DiagramCategory | "all">(
    "all"
  )

  const categoryCounts = useMemo(() => getCategoryCounts(), [])

  const filteredDiagrams = useMemo(
    () =>
      categoryFilter === "all"
        ? DIAGRAM_REGISTRY
        : DIAGRAM_REGISTRY.filter((d) => d.category === categoryFilter),
    [categoryFilter]
  )

  return (
    <div className="h-full flex bg-neutral-950">
      {/* Sidebar - Diagram List */}
      <aside className="w-72 border-r border-neutral-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800">
          <h1 className="text-lg font-medium text-neutral-100">Diagrams</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Living documentation for TMNL architecture
          </p>
        </div>

        {/* Category Filter */}
        <div className="p-4 border-b border-neutral-800">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategoryFilter("all")}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                categoryFilter === "all"
                  ? "bg-teal-500/20 text-teal-400"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
              }`}
            >
              All ({DIAGRAM_REGISTRY.length})
            </button>
            {(Object.keys(CATEGORY_META) as DiagramCategory[]).map((cat) => {
              const count = categoryCounts[cat]
              if (count === 0) return null
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    categoryFilter === cat
                      ? "bg-teal-500/20 text-teal-400"
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
                  }`}
                >
                  {CATEGORY_META[cat].label} ({count})
                </button>
              )
            })}
          </div>
        </div>

        {/* Diagram List */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {filteredDiagrams.map((diagram, index) => (
              <motion.button
                key={diagram.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => setSelectedDiagram(diagram)}
                className={`w-full p-4 text-left border-b border-neutral-800/50 transition-colors ${
                  selectedDiagram?.id === diagram.id
                    ? "bg-teal-500/10 border-l-2 border-l-teal-500"
                    : "hover:bg-neutral-800/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-neutral-200 truncate">
                      {diagram.title}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                      {diagram.description}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 text-[10px] font-mono uppercase rounded ${
                      diagram.category === "sequence"
                        ? "bg-blue-500/10 text-blue-400"
                        : diagram.category === "state"
                          ? "bg-purple-500/10 text-purple-400"
                          : diagram.category === "er"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-neutral-500/10 text-neutral-400"
                    }`}
                  >
                    {diagram.category}
                  </span>
                </div>
                {diagram.updatedAt && (
                  <div className="text-[10px] text-neutral-600 mt-2 font-mono">
                    Updated: {diagram.updatedAt}
                  </div>
                )}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </aside>

      {/* Main Content - Diagram Viewer */}
      <main className="flex-1 p-6 overflow-auto">
        {selectedDiagram ? (
          <DiagramViewer diagram={selectedDiagram} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-800/50 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-neutral-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path d="M9 17H7A5 5 0 017 7h2M15 17h2a5 5 0 000-10h-2M8 12h8" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-neutral-300">
                No Diagram Selected
              </h3>
              <p className="text-sm text-neutral-500 mt-1">
                Select a diagram from the sidebar to view
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default DiagramsPage
