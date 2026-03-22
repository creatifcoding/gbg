"use client"

import { useCallback, type KeyboardEvent } from "react"
import { cn } from "@/lib/utils"
import { DORK_OPERATORS } from "@/lib/dorks"
import { useDorkQuery } from "./context"

interface DorkInputProps {
  placeholder?: string
  className?: string
}

export function DorkInput({
  placeholder = "Search... press / for operators, or type site: directly",
  className,
}: DorkInputProps) {
  const ctx = useDorkQuery()
  const compact = ctx.variant === "compact"

  const displayValue =
    ctx.mode === "operator"
      ? ctx.operatorQuery
      : ctx.mode === "value" && ctx.showValueRolodex
        ? ctx.valueQuery
        : ctx.inputValue

  const displayPlaceholder =
    ctx.mode === "value" && ctx.pendingOperator
      ? ctx.pendingOperator.values && ctx.pendingOperator.values.length > 0
        ? `Search ${ctx.pendingOperator.label.toLowerCase()} values... or type custom`
        : `Enter ${ctx.pendingOperator.label.toLowerCase()} value... (${ctx.pendingOperator.placeholder})`
      : ctx.mode === "operator"
        ? "Type to filter operators..."
        : placeholder

  // ── Input change handler ──
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value

      if (ctx.mode === "operator") {
        ctx.setOperatorQuery(val)
        ctx.setOperatorActiveIndex(0)
        return
      }

      if (ctx.mode === "value") {
        if (ctx.showValueRolodex) {
          ctx.setValueQuery(val)
          ctx.setValueActiveIndex(0)
        } else {
          ctx.setInputValue(val)
        }
        return
      }

      // idle mode
      ctx.setInputValue(val)
      ctx.setFocusedChipIndex(-1)

      // Auto-detect operator patterns like "site:"
      const matchingOp = DORK_OPERATORS.find(
        (op) => val.toLowerCase().endsWith(op.key.toLowerCase())
      )
      if (matchingOp) {
        const beforeOp = val.slice(0, val.length - matchingOp.key.length).trim()
        ctx.setInputValue(beforeOp)
        ctx.selectOperator(matchingOp)
      }
    },
    [ctx]
  )

  // ── Keyboard handler ──
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      const key = e.key

      // ── CHIP NAVIGATION ──
      if (ctx.mode === "idle" && ctx.inputValue === "" && ctx.filters.length > 0) {
        if (key === "Backspace" && ctx.focusedChipIndex === -1) {
          ctx.setFocusedChipIndex(ctx.filters.length - 1)
          e.preventDefault()
          return
        }
        if (ctx.focusedChipIndex >= 0) {
          if (key === "Backspace" || key === "Delete") {
            ctx.removeFilter(ctx.focusedChipIndex)
            e.preventDefault()
            return
          }
          if (key === "ArrowLeft" || key === "h") {
            ctx.setFocusedChipIndex(Math.max(0, ctx.focusedChipIndex - 1))
            e.preventDefault()
            return
          }
          if (key === "ArrowRight" || key === "l") {
            if (ctx.focusedChipIndex < ctx.filters.length - 1) {
              ctx.setFocusedChipIndex(ctx.focusedChipIndex + 1)
            } else {
              ctx.setFocusedChipIndex(-1)
            }
            e.preventDefault()
            return
          }
          if (key === "Escape") {
            ctx.setFocusedChipIndex(-1)
            e.preventDefault()
            return
          }
        }
      }

      // ── OPERATOR TRIGGERS ──
      if (ctx.mode === "idle" && key === ctx.trigger) {
        // Avoid false triggers: e.g. "//" in URLs or ":\" in paths
        if (ctx.trigger === "/" && ctx.inputValue.endsWith("/")) return
        if (ctx.trigger === ":" && ctx.inputValue.endsWith(":\\")) return
        e.preventDefault()
        ctx.setMode("operator")
        ctx.setOperatorQuery("")
        ctx.setOperatorActiveIndex(0)
        ctx.setFocusedChipIndex(-1)
        return
      }

      // ── OPERATOR ROLODEX NAV ──
      if (ctx.mode === "operator") {
        if (key === "ArrowDown" || key === "j") {
          e.preventDefault()
          ctx.navigateOperator(1)
          return
        }
        if (key === "ArrowUp" || key === "k") {
          e.preventDefault()
          ctx.navigateOperator(-1)
          return
        }
        if (key === "Tab") {
          e.preventDefault()
          if (e.shiftKey || e.ctrlKey) {
            ctx.navigateOperator(-1)
          } else if (ctx.filteredOperators.length > 0) {
            ctx.selectOperator(ctx.filteredOperators[ctx.operatorActiveIndex])
          }
          return
        }
        if (key === "Enter") {
          e.preventDefault()
          if (ctx.filteredOperators.length > 0) {
            ctx.selectOperator(ctx.filteredOperators[ctx.operatorActiveIndex])
          }
          return
        }
        if (key === "Escape") {
          e.preventDefault()
          ctx.resetMode()
          return
        }
        if (key === "Backspace" && ctx.operatorQuery.length === 0) {
          ctx.resetMode()
          e.preventDefault()
          return
        }
        return
      }

      // ── VALUE ROLODEX NAV ──
      if (ctx.mode === "value") {
        if (ctx.showValueRolodex) {
          if (key === "ArrowDown" || key === "j") {
            e.preventDefault()
            ctx.navigateValue(1)
            return
          }
          if (key === "ArrowUp" || key === "k") {
            e.preventDefault()
            ctx.navigateValue(-1)
            return
          }
          if (key === "Tab") {
            e.preventDefault()
            if (e.shiftKey || e.ctrlKey) {
              ctx.navigateValue(-1)
            } else if (ctx.filteredValues.length > 0) {
              ctx.selectValue(ctx.filteredValues[ctx.valueActiveIndex])
            }
            return
          }
          if (key === "Enter") {
            e.preventDefault()
            if (ctx.filteredValues.length > 0) {
              ctx.selectValue(ctx.filteredValues[ctx.valueActiveIndex])
            } else if (ctx.pendingOperator?.freeform !== false) {
              ctx.commitFreeformValue()
            }
            return
          }
        } else {
          // No value rolodex, just freeform
          if (key === "Enter" || key === "Tab") {
            e.preventDefault()
            ctx.commitFreeformValue()
            return
          }
        }
        if (key === "Escape") {
          e.preventDefault()
          ctx.setInputValue("")
          ctx.setValueQuery("")
          ctx.resetMode()
          return
        }
        return
      }

      // ── IDLE ──
      if (key === "Enter") {
        e.preventDefault()
        ctx.handleSearch()
        return
      }
      if (key === "Escape") {
        e.preventDefault()
        ctx.inputRef.current?.blur()
        return
      }
    },
    [ctx]
  )

  return (
    <input
      ref={ctx.inputRef}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={() => ctx.setIsFocused(true)}
      onBlur={() => {
        setTimeout(() => {
          if (!ctx.rootRef.current?.contains(document.activeElement)) {
            ctx.setIsFocused(false)
          }
        }, 150)
      }}
      placeholder={displayPlaceholder}
      className={cn(
        "flex-1 bg-transparent font-sans outline-none",
        "placeholder:text-muted-foreground/40",
        compact ? "min-w-[80px] text-xs" : "min-w-[120px] text-sm",
        ctx.mode === "value" && "text-accent",
        className
      )}
      role="combobox"
      aria-expanded={ctx.showOperatorRolodex || ctx.showValueRolodex}
      aria-haspopup="listbox"
      aria-controls={
        ctx.showOperatorRolodex
          ? "dork-operator-rolodex"
          : ctx.showValueRolodex
            ? "dork-value-rolodex"
            : undefined
      }
      aria-activedescendant={
        ctx.showOperatorRolodex && ctx.filteredOperators[ctx.operatorActiveIndex]
          ? `dork-op-${ctx.filteredOperators[ctx.operatorActiveIndex].key}`
          : ctx.showValueRolodex && ctx.filteredValues[ctx.valueActiveIndex]
            ? `dork-val-${ctx.filteredValues[ctx.valueActiveIndex].value}`
            : undefined
      }
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      suppressHydrationWarning
    />
  )
}
