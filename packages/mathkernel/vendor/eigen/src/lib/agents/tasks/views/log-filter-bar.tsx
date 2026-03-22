/**
 * LogFilterBar — compound filter controls for the log view.
 *
 * Default layout:
 * Severity → Query(Search + DorkChips) → Source → Regex → Clear
 *
 * @module agent-task/views/log-filter-bar
 */

import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type PropsWithChildren,
} from 'react'
import { Effect } from 'effect'
import { useAtom } from '@effect-atom/atom-react'
import {
  logFilterAtom,
  DEFAULT_FILTER,
  type AgentTaskLogAtomSurfaceAtoms,
  type LogFilterState,
} from '../atoms'
import { parseQuery, type ParsedQuery } from '../../../search/query'
import type { LogLevel } from '../schemas/log-level'
import { LogDorkChips } from './log-dork-chips'
import './log-view.css'

const SEVERITY_LEVELS: ReadonlyArray<LogLevel> = [
  'DEBUG',
  'INFO',
  'WARN',
  'ERROR',
  'FATAL',
]

const dedupeBy = <T,>(
  values: ReadonlyArray<T>,
  identity: (value: T) => string,
): Array<T> => {
  const seen = new Set<string>()
  const merged: Array<T> = []
  for (const value of values) {
    const key = identity(value)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(value)
  }
  return merged
}

const hasDorkPayload = (parsed: ParsedQuery): boolean =>
  parsed.fieldOperators.length > 0 ||
  parsed.regexOperators.length > 0 ||
  parsed.phraseOperators.length > 0 ||
  parsed.matchMode !== undefined ||
  parsed.caseSensitive !== undefined ||
  parsed.limit !== undefined ||
  parsed.sort !== undefined

const mergeParsedIntoQuery = (current: ParsedQuery, parsed: ParsedQuery): ParsedQuery => ({
  ...current,
  text: parsed.text,
  fieldOperators: dedupeBy(
    [...current.fieldOperators, ...parsed.fieldOperators],
    (op) => `${op.exclude ? '-' : ''}${op.field}:${op.value}`,
  ),
  regexOperators: dedupeBy(
    [...current.regexOperators, ...parsed.regexOperators],
    (op) => op.pattern,
  ),
  phraseOperators: dedupeBy(
    [...current.phraseOperators, ...parsed.phraseOperators],
    (op) => op.phrase,
  ),
  matchMode: parsed.matchMode ?? current.matchMode,
  caseSensitive: parsed.caseSensitive ?? current.caseSensitive,
  limit: parsed.limit ?? current.limit,
  sort: parsed.sort ?? current.sort,
})

interface LogFilterBarContextValue {
  readonly compact: boolean
  readonly filter: LogFilterState
  readonly setQuery: (nextQuery: ParsedQuery) => void
  readonly visibleSearchText: string
  readonly setVisibleSearchText: (typedInput: string) => void
  readonly commitDorksFromVisibleInput: () => void
  readonly setMinLevel: (level: LogLevel) => void
  readonly setSource: (source: string) => void
  readonly setRegex: (regex: string) => void
  readonly clearAll: () => void
  readonly isFiltering: boolean
}

const LogFilterBarContext = createContext<LogFilterBarContextValue | null>(null)

const useLogFilterBarContext = (): LogFilterBarContextValue => {
  const ctx = useContext(LogFilterBarContext)
  if (ctx) return ctx
  throw new Error('LogFilterBar subcomponents must be rendered within <LogFilterBar>')
}

export interface LogFilterBarProps
  extends PropsWithChildren,
    HTMLAttributes<HTMLDivElement> {
  /** Compact mode — hide less-used controls */
  readonly compact?: boolean
  /** Optional injected atom surface. */
  readonly atoms?: AgentTaskLogAtomSurfaceAtoms
}

export interface LogFilterBarSeverityProps extends HTMLAttributes<HTMLDivElement> {
  readonly levels?: ReadonlyArray<LogLevel>
}

export interface LogFilterBarSeverityButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly level: LogLevel
}

export interface LogFilterBarQueryProps extends HTMLAttributes<HTMLDivElement> {}

export interface LogFilterBarSearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {}

export interface LogFilterBarDorkChipsProps {
  readonly query?: ParsedQuery
  readonly onQueryChange?: (next: ParsedQuery) => void
}

export interface LogFilterBarSourceInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  readonly showWhenCompact?: boolean
}

export interface LogFilterBarRegexInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  readonly showWhenCompact?: boolean
}

export interface LogFilterBarClearButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly children?: React.ReactNode
}

function LogFilterBarRoot({
  compact = false,
  atoms,
  children,
  className,
  ...rest
}: LogFilterBarProps) {
  const [filter, setFilter] = useAtom(atoms?.logFilterAtom ?? logFilterAtom)

  const visibleSearchText = filter.query.text

  const setQuery = useCallback(
    (nextQuery: ParsedQuery) => {
      setFilter((prev) => ({ ...prev, query: nextQuery }))
    },
    [setFilter],
  )

  const setVisibleSearchText = useCallback(
    (typedInput: string) => {
      if (!typedInput.includes(',')) {
        setFilter((prev) => ({
          ...prev,
          query: {
            ...prev.query,
            text: typedInput,
          },
        }))
        return
      }

      setFilter((prev) => {
        const segments = typedInput.split(',')
        const commitSegments = segments.slice(0, -1)
        const tailSegment = segments[segments.length - 1] ?? ''

        let nextQuery = prev.query
        const carryTextSegments: Array<string> = []

        for (const segment of commitSegments) {
          const trimmed = segment.trim()
          if (trimmed.length === 0) continue

          const parsed = Effect.runSync(parseQuery(trimmed))
          if (hasDorkPayload(parsed)) {
            nextQuery = mergeParsedIntoQuery(nextQuery, parsed)
          } else if (parsed.text.trim().length > 0) {
            carryTextSegments.push(parsed.text.trim())
          }
        }

        const nextVisibleText = [...carryTextSegments, tailSegment.trimStart()]
          .filter((value) => value.length > 0)
          .join(', ')

        return {
          ...prev,
          query: {
            ...nextQuery,
            text: nextVisibleText,
          },
        }
      })
    },
    [setFilter],
  )

  const commitDorksFromVisibleInput = useCallback(() => {
    setFilter((prev) => {
      const parsed = Effect.runSync(parseQuery(prev.query.text))

      if (!hasDorkPayload(parsed)) {
        return prev
      }

      return {
        ...prev,
        query: mergeParsedIntoQuery(prev.query, parsed),
      }
    })
  }, [setFilter])

  const setMinLevel = useCallback(
    (level: LogLevel) => {
      setFilter((prev) => ({ ...prev, minLevel: level }))
    },
    [setFilter],
  )

  const setSource = useCallback(
    (source: string) => {
      setFilter((prev) => ({ ...prev, source }))
    },
    [setFilter],
  )

  const setRegex = useCallback(
    (regex: string) => {
      setFilter((prev) => ({ ...prev, regex }))
    },
    [setFilter],
  )

  const clearAll = useCallback(() => {
    setFilter(DEFAULT_FILTER)
  }, [setFilter])

  const hasQueryFilters =
    filter.query.text.trim().length > 0 ||
    filter.query.fieldOperators.length > 0 ||
    filter.query.regexOperators.length > 0 ||
    filter.query.phraseOperators.length > 0 ||
    filter.query.matchMode !== undefined ||
    filter.query.caseSensitive !== undefined ||
    filter.query.limit !== undefined ||
    filter.query.sort !== undefined

  const isFiltering =
    filter.minLevel !== 'DEBUG' ||
    hasQueryFilters ||
    filter.source.length > 0 ||
    filter.regex.length > 0

  const ctxValue = useMemo<LogFilterBarContextValue>(
    () => ({
      compact,
      filter,
      setQuery,
      visibleSearchText,
      setVisibleSearchText,
      commitDorksFromVisibleInput,
      setMinLevel,
      setSource,
      setRegex,
      clearAll,
      isFiltering,
    }),
    [
      compact,
      filter,
      setQuery,
      visibleSearchText,
      setVisibleSearchText,
      commitDorksFromVisibleInput,
      setMinLevel,
      setSource,
      setRegex,
      clearAll,
      isFiltering,
    ],
  )

  return (
    <LogFilterBarContext.Provider value={ctxValue}>
      <div
        {...rest}
        className={className ? `at-log-filter-bar ${className}` : 'at-log-filter-bar'}
        data-slot="log-filter-root"
      >
        {children ?? <DefaultLogFilterBarLayout />}
      </div>
    </LogFilterBarContext.Provider>
  )
}

const DefaultLogFilterBarLayout = () => (
  <>
    <LogFilterBar.Severity />
    <LogFilterBar.Query>
      <LogFilterBar.SearchInput />
      <LogFilterBar.DorkChips />
    </LogFilterBar.Query>
    <LogFilterBar.SourceInput />
    <LogFilterBar.RegexInput />
    <LogFilterBar.ClearButton />
  </>
)

function LogFilterBarSeverity({
  levels = SEVERITY_LEVELS,
  className,
  children,
  ...rest
}: LogFilterBarSeverityProps) {
  return (
    <div
      {...rest}
      className={className ? `at-log-filter-bar__severity ${className}` : 'at-log-filter-bar__severity'}
      data-slot="log-filter-severity"
    >
      {children ?? levels.map((level) => <LogFilterBar.SeverityButton key={level} level={level} />)}
    </div>
  )
}

function LogFilterBarSeverityButton({
  level,
  className,
  title,
  onClick,
  ...rest
}: LogFilterBarSeverityButtonProps) {
  const ctx = useLogFilterBarContext()
  const active = ctx.filter.minLevel === level

  return (
    <button
      {...rest}
      type="button"
      className={className ? `at-log-filter-bar__severity-btn ${className}` : 'at-log-filter-bar__severity-btn'}
      data-level={level.toLowerCase()}
      data-active={active ? '' : undefined}
      data-slot="log-filter-severity-button"
      aria-pressed={active}
      title={title ?? `Show ${level} and above`}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) {
          ctx.setMinLevel(level)
        }
      }}
    >
      {level.charAt(0)}
    </button>
  )
}

function LogFilterBarQuery({ className, children, ...rest }: LogFilterBarQueryProps) {
  return (
    <div
      {...rest}
      className={className ? `at-log-filter-bar__query-stack ${className}` : 'at-log-filter-bar__query-stack'}
      data-slot="log-filter-query"
    >
      {children ?? (
        <>
          <LogFilterBar.SearchInput />
          <LogFilterBar.DorkChips />
        </>
      )}
    </div>
  )
}

function LogFilterBarSearchInput({
  className,
  placeholder,
  onChange,
  onKeyDown,
  onBlur,
  ...rest
}: LogFilterBarSearchInputProps) {
  const ctx = useLogFilterBarContext()

  return (
    <input
      {...rest}
      className={className ? `at-log-filter-bar__input ${className}` : 'at-log-filter-bar__input'}
      type="text"
      placeholder={placeholder ?? 'Search or dork (scope:runtime -category:debug "exact phrase")'}
      value={ctx.visibleSearchText}
      onChange={(event) => {
        onChange?.(event)
        ctx.setVisibleSearchText(event.target.value)
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!event.defaultPrevented && event.key === 'Enter') {
          event.preventDefault()
          ctx.commitDorksFromVisibleInput()
        }
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!event.defaultPrevented) {
          ctx.commitDorksFromVisibleInput()
        }
      }}
      spellCheck={false}
      data-slot="log-filter-search-input"
      aria-label="Log search and dork query"
    />
  )
}

function LogFilterBarDorkChips({ query, onQueryChange }: LogFilterBarDorkChipsProps) {
  const ctx = useLogFilterBarContext()
  return (
    <LogDorkChips
      query={query ?? ctx.filter.query}
      onQueryChange={onQueryChange ?? ctx.setQuery}
    />
  )
}

function LogFilterBarSourceInput({
  showWhenCompact = false,
  className,
  onChange,
  ...rest
}: LogFilterBarSourceInputProps) {
  const ctx = useLogFilterBarContext()
  if (ctx.compact && !showWhenCompact) return null

  return (
    <input
      {...rest}
      className={
        className
          ? `at-log-filter-bar__input at-log-filter-bar__input--narrow ${className}`
          : 'at-log-filter-bar__input at-log-filter-bar__input--narrow'
      }
      type="text"
      placeholder="Source…"
      value={ctx.filter.source}
      onChange={(event) => {
        onChange?.(event)
        ctx.setSource(event.target.value)
      }}
      spellCheck={false}
      data-slot="log-filter-source-input"
    />
  )
}

function LogFilterBarRegexInput({
  showWhenCompact = false,
  className,
  onChange,
  ...rest
}: LogFilterBarRegexInputProps) {
  const ctx = useLogFilterBarContext()
  if (ctx.compact && !showWhenCompact) return null

  return (
    <input
      {...rest}
      className={
        className
          ? `at-log-filter-bar__input at-log-filter-bar__input--narrow ${className}`
          : 'at-log-filter-bar__input at-log-filter-bar__input--narrow'
      }
      type="text"
      placeholder="/regex/"
      value={ctx.filter.regex}
      onChange={(event) => {
        onChange?.(event)
        ctx.setRegex(event.target.value)
      }}
      spellCheck={false}
      data-slot="log-filter-regex-input"
    />
  )
}

function LogFilterBarClearButton({
  className,
  title,
  onClick,
  children,
  ...rest
}: LogFilterBarClearButtonProps) {
  const ctx = useLogFilterBarContext()
  if (!ctx.isFiltering) return null

  return (
    <button
      {...rest}
      type="button"
      className={className ? `at-log-filter-bar__clear ${className}` : 'at-log-filter-bar__clear'}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) {
          ctx.clearAll()
        }
      }}
      title={title ?? 'Clear all filters'}
      aria-label={title ?? 'Clear all filters'}
      data-slot="log-filter-clear"
    >
      {children ?? '✕'}
    </button>
  )
}

const LogFilterBarBase = memo(LogFilterBarRoot)

export const LogFilterBar = Object.assign(LogFilterBarBase, {
  Severity: LogFilterBarSeverity,
  SeverityButton: LogFilterBarSeverityButton,
  Query: LogFilterBarQuery,
  SearchInput: LogFilterBarSearchInput,
  DorkChips: LogFilterBarDorkChips,
  SourceInput: LogFilterBarSourceInput,
  RegexInput: LogFilterBarRegexInput,
  ClearButton: LogFilterBarClearButton,
})
