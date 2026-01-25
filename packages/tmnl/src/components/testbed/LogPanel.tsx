/**
 * LogPanel
 *
 * Right drawer content for testbed logging.
 * Renders Effect-based log entries with level filtering and clear controls.
 *
 * @module testbed/LogPanel
 */

import { useState, useMemo, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  useTestbedLogs,
  clearLogs,
  type LogLevelType,
  type TestbedLogEntry,
} from "./atoms"

// =============================================================================
// LEVEL CONFIG
// =============================================================================

const LEVEL_CONFIG: Record<
  LogLevelType,
  { icon: string; color: string; bg: string }
> = {
  info: {
    icon: "ℹ",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
  },
  warn: {
    icon: "⚠",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  error: {
    icon: "✕",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
  },
  success: {
    icon: "✓",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  debug: {
    icon: "◌",
    color: "text-neutral-400",
    bg: "bg-neutral-500/10 border-neutral-500/20",
  },
}

// =============================================================================
// LOG ENTRY COMPONENT
// =============================================================================

function LogEntryRow({ entry }: { entry: TestbedLogEntry }) {
  const config = LEVEL_CONFIG[entry.level]
  const [expanded, setExpanded] = useState(false)
  const hasData = entry.data !== undefined

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className={`px-3 py-2 border-b border-neutral-800/50 ${
        hasData ? "cursor-pointer hover:bg-neutral-800/30" : ""
      }`}
      onClick={() => hasData && setExpanded(!expanded)}
    >
      {/* Main Row */}
      <div className="flex items-start gap-2">
        {/* Level Icon */}
        <span
          className={`w-5 h-5 flex items-center justify-center text-xs rounded ${config.bg} ${config.color}`}
        >
          {config.icon}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Source + Time */}
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-mono text-teal-400/70 uppercase tracking-wider">
              {entry.source}
            </span>
            <span className="text-[10px] font-mono text-neutral-600">
              {entry.formattedTime}
            </span>
          </div>

          {/* Message */}
          <div className={`text-xs font-mono ${config.color}`}>
            {entry.message}
          </div>

          {/* Data Preview */}
          {hasData && !expanded && (
            <div className="text-[10px] text-neutral-500 mt-1 truncate">
              {JSON.stringify(entry.data).slice(0, 60)}...
            </div>
          )}

          {/* Expanded Data */}
          <AnimatePresence>
            {hasData && expanded && (
              <motion.pre
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-2 p-2 bg-neutral-900 rounded text-[10px] font-mono text-neutral-300 overflow-x-auto"
              >
                {JSON.stringify(entry.data, null, 2)}
              </motion.pre>
            )}
          </AnimatePresence>
        </div>

        {/* Expand Indicator */}
        {hasData && (
          <span className="text-neutral-600 text-xs">
            {expanded ? "▼" : "▶"}
          </span>
        )}
      </div>
    </motion.div>
  )
}

// =============================================================================
// FILTER BAR
// =============================================================================

interface FilterBarProps {
  activeFilter: LogLevelType | "all"
  onFilterChange: (filter: LogLevelType | "all") => void
  counts: Record<LogLevelType | "all", number>
}

function FilterBar({ activeFilter, onFilterChange, counts }: FilterBarProps) {
  const filters: (LogLevelType | "all")[] = [
    "all",
    "info",
    "success",
    "warn",
    "error",
    "debug",
  ]

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {filters.map((filter) => {
        const count = counts[filter]
        const isActive = activeFilter === filter
        const config = filter === "all" ? null : LEVEL_CONFIG[filter]

        return (
          <button
            key={filter}
            onClick={() => onFilterChange(filter)}
            className={`px-2 py-1 text-[10px] font-mono uppercase rounded transition-colors flex items-center gap-1 ${
              isActive
                ? config
                  ? `${config.bg} ${config.color} border border-current/20`
                  : "bg-teal-500/20 text-teal-400 border border-teal-500/20"
                : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800"
            }`}
          >
            {filter === "all" ? "All" : config?.icon}
            <span className="tabular-nums">{count}</span>
          </button>
        )
      })}
    </div>
  )
}

// =============================================================================
// MAIN PANEL
// =============================================================================

export function LogPanel() {
  const logs = useTestbedLogs()
  const [filter, setFilter] = useState<LogLevelType | "all">("all")
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // Filtered logs
  const filteredLogs = useMemo(
    () =>
      filter === "all" ? logs : logs.filter((log) => log.level === filter),
    [logs, filter]
  )

  // Counts per level
  const counts = useMemo(() => {
    const result: Record<LogLevelType | "all", number> = {
      all: logs.length,
      info: 0,
      warn: 0,
      error: 0,
      success: 0,
      debug: 0,
    }
    for (const log of logs) {
      result[log.level]++
    }
    return result
  }, [logs])

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [filteredLogs, autoScroll])

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    setAutoScroll(isAtBottom)
  }

  return (
    <div className="h-full flex flex-col bg-neutral-950">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">▤</span>
            </div>
            <span className="text-sm font-semibold text-neutral-200">
              Event Log
            </span>
            <span className="text-xs font-mono text-neutral-500">
              ({logs.length})
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-2 py-1 text-[10px] font-mono rounded transition-colors ${
                autoScroll
                  ? "bg-teal-500/20 text-teal-400"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
              title={autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
            >
              {autoScroll ? "⬇ Auto" : "⬇"}
            </button>
            <button
              onClick={() => clearLogs()}
              className="px-2 py-1 text-[10px] font-mono text-neutral-500 hover:text-red-400 transition-colors"
              title="Clear all logs"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <FilterBar
          activeFilter={filter}
          onFilterChange={setFilter}
          counts={counts}
        />
      </div>

      {/* Log List */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-neutral-600 text-sm">
            {logs.length === 0
              ? "No logs yet. Run a test to generate logs."
              : `No ${filter} logs.`}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredLogs.map((log) => (
              <LogEntryRow key={log.id} entry={log} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-2 border-t border-neutral-800 flex items-center justify-between">
        <span className="text-[10px] text-neutral-600 font-mono">
          Effect Schema + Atom-as-State
        </span>
        {!autoScroll && filteredLogs.length > 0 && (
          <button
            onClick={() => {
              setAutoScroll(true)
              if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight
              }
            }}
            className="text-[10px] text-teal-400 hover:text-teal-300 font-mono"
          >
            ↓ Jump to bottom
          </button>
        )}
      </div>
    </div>
  )
}

export default LogPanel
