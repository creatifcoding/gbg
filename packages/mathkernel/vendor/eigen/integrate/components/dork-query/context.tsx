"use client"

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
  type RefObject,
  type Dispatch,
  type SetStateAction,
} from "react"
import { DORK_OPERATORS, type DorkOperator, type DorkValue, DEFAULT_TRIGGER, isAllowedTrigger, type AllowedTrigger } from "@/lib/dorks"
import { fuzzyFilter } from "@/lib/fuzzy"

// ────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────

export interface ActiveFilter {
  operator: DorkOperator
  value: string
}

export type InputMode = "idle" | "operator" | "value"
export type DorkVariant = "default" | "compact"

// ────────────────────────────────────────────────
// Context shape
// ────────────────────────────────────────────────

interface DorkQueryContext {
  // Variant
  variant: DorkVariant

  // Trigger character
  trigger: AllowedTrigger

  // Refs
  inputRef: RefObject<HTMLInputElement | null>
  rootRef: RefObject<HTMLDivElement | null>

  // Core state
  inputValue: string
  setInputValue: Dispatch<SetStateAction<string>>
  filters: ActiveFilter[]
  setFilters: Dispatch<SetStateAction<ActiveFilter[]>>
  focusedChipIndex: number
  setFocusedChipIndex: Dispatch<SetStateAction<number>>

  // Mode state
  mode: InputMode
  setMode: Dispatch<SetStateAction<InputMode>>
  operatorQuery: string
  setOperatorQuery: Dispatch<SetStateAction<string>>
  valueQuery: string
  setValueQuery: Dispatch<SetStateAction<string>>
  operatorActiveIndex: number
  setOperatorActiveIndex: Dispatch<SetStateAction<number>>
  valueActiveIndex: number
  setValueActiveIndex: Dispatch<SetStateAction<number>>
  pendingOperator: DorkOperator | null
  setPendingOperator: Dispatch<SetStateAction<DorkOperator | null>>
  isFocused: boolean
  setIsFocused: Dispatch<SetStateAction<boolean>>

  // Derived
  filteredOperators: (DorkOperator & { _fuzzyScore: number; _fuzzyIndices: number[] })[]
  filteredValues: (DorkValue & { _fuzzyScore: number; _fuzzyIndices: number[] })[]
  showOperatorRolodex: boolean
  showValueRolodex: boolean

  // Actions
  resetMode: () => void
  selectOperator: (operator: DorkOperator) => void
  selectValue: (value: DorkValue) => void
  commitFreeformValue: () => void
  commitSingleValue: (val: string) => void
  removeFilter: (index: number) => void
  handleSearch: () => void
  navigateOperator: (direction: 1 | -1) => void
  navigateValue: (direction: 1 | -1) => void
}

const Ctx = createContext<DorkQueryContext | null>(null)

export function useDorkQuery(): DorkQueryContext {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useDorkQuery must be used within <DorkQuery.Root>")
  return ctx
}

// ────────────────────────────────────────────────
// Provider
// ────────────────────────────────────────────────

interface DorkQueryProviderProps {
  children: ReactNode
  onSearch?: (query: string, filters: ActiveFilter[]) => void
  className?: string
  variant?: DorkVariant
  trigger?: AllowedTrigger
}

export function DorkQueryProvider({
  children,
  onSearch,
  className,
  variant = "default",
  trigger: triggerProp,
}: DorkQueryProviderProps) {
  // Validate trigger at runtime, fallback to default
  const trigger: AllowedTrigger =
    triggerProp && isAllowedTrigger(triggerProp) ? triggerProp : DEFAULT_TRIGGER
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // Core state
  const [inputValue, setInputValue] = useState("")
  const [filters, setFilters] = useState<ActiveFilter[]>([])
  const [focusedChipIndex, setFocusedChipIndex] = useState(-1)

  // Mode
  const [mode, setMode] = useState<InputMode>("idle")
  const [operatorQuery, setOperatorQuery] = useState("")
  const [valueQuery, setValueQuery] = useState("")
  const [operatorActiveIndex, setOperatorActiveIndex] = useState(0)
  const [valueActiveIndex, setValueActiveIndex] = useState(0)
  const [pendingOperator, setPendingOperator] = useState<DorkOperator | null>(null)
  const [isFocused, setIsFocused] = useState(false)

  // ── Derived: fuzzy-filtered operators ──
  const filteredOperators = fuzzyFilter(
    operatorQuery,
    DORK_OPERATORS,
    (op) => op.key + " " + op.label
  )

  // ── Derived: fuzzy-filtered values for the pending operator ──
  const filteredValues = pendingOperator?.values
    ? fuzzyFilter(valueQuery, pendingOperator.values, (v) => v.value + " " + v.label)
    : []

  const showOperatorRolodex = mode === "operator" && isFocused
  const showValueRolodex =
    mode === "value" &&
    isFocused &&
    pendingOperator !== null &&
    (pendingOperator.values?.length ?? 0) > 0

  // Clamp indices
  useEffect(() => {
    if (operatorActiveIndex >= filteredOperators.length) {
      setOperatorActiveIndex(Math.max(0, filteredOperators.length - 1))
    }
  }, [filteredOperators.length, operatorActiveIndex])

  useEffect(() => {
    if (valueActiveIndex >= filteredValues.length) {
      setValueActiveIndex(Math.max(0, filteredValues.length - 1))
    }
  }, [filteredValues.length, valueActiveIndex])

  // ── Actions ──

  const resetMode = useCallback(() => {
    setMode("idle")
    setOperatorQuery("")
    setValueQuery("")
    setOperatorActiveIndex(0)
    setValueActiveIndex(0)
    setPendingOperator(null)
    setFocusedChipIndex(-1)
  }, [])

  const selectOperator = useCallback((operator: DorkOperator) => {
    setMode("value")
    setPendingOperator(operator)
    setInputValue("")
    setValueQuery("")
    setOperatorQuery("")
    setOperatorActiveIndex(0)
    setValueActiveIndex(0)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const selectValue = useCallback(
    (dv: DorkValue) => {
      if (!pendingOperator) return
      setFilters((prev) => [...prev, { operator: pendingOperator, value: dv.value }])
      setInputValue("")
      setValueQuery("")
      resetMode()
      requestAnimationFrame(() => inputRef.current?.focus())
    },
    [pendingOperator, resetMode]
  )

  const commitFreeformValue = useCallback(() => {
    const raw = (inputValue || valueQuery).trim()
    if (!pendingOperator || !raw) return
    const segments = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (segments.length === 0) return
    setFilters((prev) => [
      ...prev,
      ...segments.map((seg) => ({ operator: pendingOperator, value: seg })),
    ])
    setInputValue("")
    setValueQuery("")
    resetMode()
  }, [pendingOperator, inputValue, valueQuery, resetMode])

  // Commit a single value and stay in value mode for the same operator
  const commitSingleValue = useCallback(
    (val: string) => {
      const trimmed = val.trim()
      if (!pendingOperator || !trimmed) return
      setFilters((prev) => [...prev, { operator: pendingOperator, value: trimmed }])
      setInputValue("")
      setValueQuery("")
      setValueActiveIndex(0)
    },
    [pendingOperator]
  )

  const removeFilter = useCallback((index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index))
    setFocusedChipIndex(-1)
    inputRef.current?.focus()
  }, [])

  const handleSearch = useCallback(() => {
    onSearch?.(inputValue, filters)
  }, [onSearch, inputValue, filters])

  const navigateOperator = useCallback(
    (direction: 1 | -1) => {
      setOperatorActiveIndex((prev) => {
        const len = filteredOperators.length
        if (len === 0) return 0
        return (prev + direction + len) % len
      })
    },
    [filteredOperators.length]
  )

  const navigateValue = useCallback(
    (direction: 1 | -1) => {
      setValueActiveIndex((prev) => {
        const len = filteredValues.length
        if (len === 0) return 0
        return (prev + direction + len) % len
      })
    },
    [filteredValues.length]
  )

  // Outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        if (mode === "operator" || mode === "value") resetMode()
        setIsFocused(false)
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [mode, resetMode])

  const ctx: DorkQueryContext = {
    variant,
    trigger,
    inputRef,
    rootRef,
    inputValue,
    setInputValue,
    filters,
    setFilters,
    focusedChipIndex,
    setFocusedChipIndex,
    mode,
    setMode,
    operatorQuery,
    setOperatorQuery,
    valueQuery,
    setValueQuery,
    operatorActiveIndex,
    setOperatorActiveIndex,
    valueActiveIndex,
    setValueActiveIndex,
    pendingOperator,
    setPendingOperator,
    isFocused,
    setIsFocused,
    filteredOperators,
    filteredValues,
    showOperatorRolodex,
    showValueRolodex,
    resetMode,
    selectOperator,
    selectValue,
    commitFreeformValue,
    commitSingleValue,
    removeFilter,
    handleSearch,
    navigateOperator,
    navigateValue,
  }

  return (
    <Ctx value={ctx}>
      <div ref={rootRef} className={className}>
        {children}
      </div>
    </Ctx>
  )
}
