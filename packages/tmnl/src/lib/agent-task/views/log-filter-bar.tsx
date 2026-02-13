/**
 * LogFilterBar — Filter controls for the log view.
 *
 * Renders: severity buttons, search input, source input, regex toggle.
 * Reads/writes logFilterAtom directly.
 *
 * @module agent-task/views/log-filter-bar
 */

import React, { useCallback } from 'react'
import { useAtom } from '@effect-atom/atom-react'
import { logFilterAtom, DEFAULT_FILTER, type LogFilterState } from '../atoms'
import type { LogLevel } from '../schemas/log-level'
import './log-view.css'

const SEVERITY_LEVELS: ReadonlyArray<LogLevel> = [
  'DEBUG',
  'INFO',
  'WARN',
  'ERROR',
  'FATAL',
]

export interface LogFilterBarProps {
  /** Compact mode — hide less-used controls */
  readonly compact?: boolean
}

export function LogFilterBar({ compact = false }: LogFilterBarProps) {
  const [filter, setFilter] = useAtom(logFilterAtom)

  const setMinLevel = useCallback(
    (level: LogLevel) => {
      setFilter((prev) => ({ ...prev, minLevel: level }))
    },
    [setFilter],
  )

  const setSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilter((prev) => ({ ...prev, search: e.target.value }))
    },
    [setFilter],
  )

  const setSource = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilter((prev) => ({ ...prev, source: e.target.value }))
    },
    [setFilter],
  )

  const setRegex = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilter((prev) => ({ ...prev, regex: e.target.value }))
    },
    [setFilter],
  )

  const clearAll = useCallback(() => {
    setFilter(DEFAULT_FILTER)
  }, [setFilter])

  const isFiltering =
    filter.minLevel !== 'DEBUG' ||
    filter.search.length > 0 ||
    filter.source.length > 0 ||
    filter.regex.length > 0

  return (
    <div className="at-log-filter-bar">
      {/* Severity buttons */}
      <div className="at-log-filter-bar__severity">
        {SEVERITY_LEVELS.map((level) => (
          <button
            key={level}
            className="at-log-filter-bar__severity-btn"
            data-level={level.toLowerCase()}
            data-active={filter.minLevel === level ? '' : undefined}
            onClick={() => setMinLevel(level)}
            title={`Show ${level} and above`}
          >
            {level.charAt(0)}
          </button>
        ))}
      </div>

      {/* Search input */}
      <input
        className="at-log-filter-bar__input"
        type="text"
        placeholder="Search messages…"
        value={filter.search}
        onChange={setSearch}
        spellCheck={false}
      />

      {!compact && (
        <>
          {/* Source filter */}
          <input
            className="at-log-filter-bar__input at-log-filter-bar__input--narrow"
            type="text"
            placeholder="Source…"
            value={filter.source}
            onChange={setSource}
            spellCheck={false}
          />

          {/* Regex filter */}
          <input
            className="at-log-filter-bar__input at-log-filter-bar__input--narrow"
            type="text"
            placeholder="/regex/"
            value={filter.regex}
            onChange={setRegex}
            spellCheck={false}
          />
        </>
      )}

      {/* Clear filters */}
      {isFiltering && (
        <button
          className="at-log-filter-bar__clear"
          onClick={clearAll}
          title="Clear all filters"
        >
          ✕
        </button>
      )}
    </div>
  )
}
