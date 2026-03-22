/**
 * OverhaulDocsPage
 *
 * Documentation hub for the TMNL ← AFFiNE integration project.
 *
 * @module docs/overhaul
 */

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { DocViewer } from "./DocViewer"
import {
  DOC_REGISTRY,
  getDocCategoryCounts,
  type DocEntry,
  type DocCategory,
} from "./registry"

// =============================================================================
// Category Metadata
// =============================================================================

const CATEGORY_META: Record<
  DocCategory,
  { label: string; icon: string; description: string; color: string }
> = {
  overview: {
    label: "Overview",
    icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    description: "Introduction and rationale",
    color: "blue",
  },
  architecture: {
    label: "Architecture",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    description: "System design deep dives",
    color: "purple",
  },
  patterns: {
    label: "Patterns",
    icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
    description: "Implementation patterns",
    color: "teal",
  },
  guide: {
    label: "Guides",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
    description: "Step-by-step tutorials",
    color: "amber",
  },
  reference: {
    label: "Reference",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
    description: "API and component docs",
    color: "neutral",
  },
}

// =============================================================================
// Component
// =============================================================================

export function OverhaulDocsPage() {
  const [selectedDoc, setSelectedDoc] = useState<DocEntry | null>(
    DOC_REGISTRY[0] ?? null
  )
  const [categoryFilter, setCategoryFilter] = useState<DocCategory | "all">("all")

  const categoryCounts = useMemo(() => getDocCategoryCounts(), [])

  const filteredDocs = useMemo(
    () =>
      categoryFilter === "all"
        ? DOC_REGISTRY
        : DOC_REGISTRY.filter((d) => d.category === categoryFilter),
    [categoryFilter]
  )

  const getColorClasses = (color: string, isActive: boolean) => {
    const colors: Record<string, { active: string; inactive: string }> = {
      blue: {
        active: "bg-blue-500/20 text-blue-400 border-l-blue-500",
        inactive: "text-blue-400/60",
      },
      purple: {
        active: "bg-purple-500/20 text-purple-400 border-l-purple-500",
        inactive: "text-purple-400/60",
      },
      teal: {
        active: "bg-teal-500/20 text-teal-400 border-l-teal-500",
        inactive: "text-teal-400/60",
      },
      amber: {
        active: "bg-amber-500/20 text-amber-400 border-l-amber-500",
        inactive: "text-amber-400/60",
      },
      neutral: {
        active: "bg-neutral-500/20 text-neutral-400 border-l-neutral-500",
        inactive: "text-neutral-400/60",
      },
    }
    return isActive ? colors[color]?.active : colors[color]?.inactive
  }

  return (
    <div className="h-full flex bg-neutral-950">
      {/* Sidebar - Doc List */}
      <aside className="w-80 border-r border-neutral-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-neutral-100">TMNL Overhaul</h1>
              <p className="text-xs text-neutral-500">Architecture Patterns Reference</p>
            </div>
          </div>
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
              All ({DOC_REGISTRY.length})
            </button>
            {(Object.keys(CATEGORY_META) as DocCategory[]).map((cat) => {
              const count = categoryCounts[cat]
              if (count === 0) return null
              const meta = CATEGORY_META[cat]
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    categoryFilter === cat
                      ? getColorClasses(meta.color, true)
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
                  }`}
                >
                  {meta.label} ({count})
                </button>
              )
            })}
          </div>
        </div>

        {/* Doc List */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {filteredDocs.map((doc, index) => {
              const meta = CATEGORY_META[doc.category]
              const isSelected = selectedDoc?.id === doc.id

              return (
                <motion.button
                  key={doc.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => setSelectedDoc(doc)}
                  className={`w-full p-4 text-left border-b border-neutral-800/50 transition-colors ${
                    isSelected
                      ? `${getColorClasses(meta.color, true)} border-l-2`
                      : "hover:bg-neutral-800/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-neutral-200 truncate">
                        {doc.title}
                      </h3>
                      <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                        {doc.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-mono uppercase rounded ${
                        meta.color === "blue"
                          ? "bg-blue-500/10 text-blue-400"
                          : meta.color === "purple"
                            ? "bg-purple-500/10 text-purple-400"
                            : meta.color === "teal"
                              ? "bg-teal-500/10 text-teal-400"
                              : meta.color === "amber"
                                ? "bg-amber-500/10 text-amber-400"
                                : "bg-neutral-500/10 text-neutral-400"
                      }`}
                    >
                      {doc.category}
                    </span>
                    <span className="text-[10px] text-neutral-600 font-mono">
                      {doc.sections.length} sections
                    </span>
                    {doc.updatedAt && (
                      <span className="text-[10px] text-neutral-600 font-mono">
                        {doc.updatedAt}
                      </span>
                    )}
                  </div>
                </motion.button>
              )
            })}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 text-center">
          <p className="text-xs text-neutral-600">
            Generated for implementing agents
          </p>
        </div>
      </aside>

      {/* Main Content - Doc Viewer */}
      <main className="flex-1 overflow-hidden">
        {selectedDoc ? (
          <DocViewer doc={selectedDoc} />
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
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-neutral-300">
                No Document Selected
              </h3>
              <p className="text-sm text-neutral-500 mt-1">
                Select a document from the sidebar to view
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default OverhaulDocsPage
