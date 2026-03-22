"use client"

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  type KeyboardEvent,
  type ChangeEvent,
} from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { DORK_OPERATORS, type DorkOperator } from "@/lib/dorks"
import { useDorkQuery, type ActiveFilter } from "./context"
import { OperatorRolodex } from "./operator-rolodex"
import { ValueRolodex } from "./value-rolodex"
import { PendingBadge } from "./pending-badge"

// ────────────────────────────────────────────────
// Token model: text segments + chip placeholders
// ────────────────────────────────────────────────

/** Unique sentinel character used as a chip placeholder in the raw text.
 *  We use the Object Replacement Character U+FFFC -- invisible, single char,
 *  so caret math (selectionStart) stays simple. */
const CHIP_SENTINEL = "\uFFFC"

interface InlineFilter {
  operator: DorkOperator
  value: string
}

// ────────────────────────────────────────────────
// Caret pixel position helper
// ────────────────────────────────────────────────

function getCaretCoords(
  textarea: HTMLTextAreaElement,
  position: number
): { top: number; left: number } {
  // Create an off-screen mirror of the textarea
  const mirror = document.createElement("div")
  const style = getComputedStyle(textarea)

  // Copy relevant styles
  const props = [
    "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing",
    "textTransform", "wordSpacing", "textIndent", "paddingTop", "paddingRight",
    "paddingBottom", "paddingLeft", "borderTopWidth", "borderRightWidth",
    "borderBottomWidth", "borderLeftWidth", "boxSizing", "lineHeight", "whiteSpace",
    "wordWrap", "overflowWrap", "tabSize", "width",
  ] as const

  mirror.style.position = "absolute"
  mirror.style.visibility = "hidden"
  mirror.style.overflow = "hidden"

  for (const prop of props) {
    ;(mirror.style as unknown as Record<string, string>)[prop] = style[prop]
  }

  // Text up to caret
  const text = textarea.value.substring(0, position)
  mirror.textContent = text

  // Add a span to mark the caret
  const caret = document.createElement("span")
  caret.textContent = "|"
  mirror.appendChild(caret)

  // Append remaining text
  const rest = document.createTextNode(textarea.value.substring(position) || ".")
  mirror.appendChild(rest)

  document.body.appendChild(mirror)

  const caretRect = caret.getBoundingClientRect()
  const mirrorRect = mirror.getBoundingClientRect()

  const coords = {
    top: caretRect.top - mirrorRect.top + textarea.offsetTop - textarea.scrollTop,
    left: caretRect.left - mirrorRect.left + textarea.offsetLeft - textarea.scrollLeft,
  }

  document.body.removeChild(mirror)
  return coords
}

// ────────────────────────────────────────────────
// Main DorkInline component
// ────────────────────────────────────────────────

interface DorkInlineProps {
  placeholder?: string
  className?: string
  onSubmit?: (text: string, filters: ActiveFilter[]) => void
  rows?: number
}

export function DorkInline({
  placeholder = "Type here...",
  className,
  onSubmit,
  rows = 1,
}: DorkInlineProps) {
  const ctx = useDorkQuery()
  const compact = ctx.variant === "compact"
  const trigger = ctx.trigger

  // ── Raw text state: includes CHIP_SENTINEL chars where chips sit ──
  const [rawText, setRawText] = useState("")
  // Parallel array of inline filters, indexed by order of CHIP_SENTINEL in rawText
  const [inlineFilters, setInlineFilters] = useState<InlineFilter[]>([])
  // Caret position where the trigger was typed (for popover positioning)
  const [triggerOffset, setTriggerOffset] = useState<number | null>(null)
  // Popover pixel position
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)

  // ── Sync textarea ref into context ──
  useEffect(() => {
    // The context expects an input ref; we'll point it at a hidden input for rolodex key capture
    // But the textarea is the real source of truth
  }, [])

  // ── Sync context filters with our inline filters ──
  const prevCtxFilterCount = useRef(0)
  useEffect(() => {
    const newCount = ctx.filters.length
    if (newCount > prevCtxFilterCount.current && ctx.mode === "idle") {
      // Context just committed a new filter -- insert a chip sentinel at the trigger offset
      const newFilter = ctx.filters[newCount - 1]
      setInlineFilters((prev) => [...prev, { operator: newFilter.operator, value: newFilter.value }])

      setRawText((prev) => {
        if (triggerOffset !== null) {
          // Insert sentinel at the trigger position, replacing any trigger char residue
          const before = prev.substring(0, triggerOffset)
          const after = prev.substring(textareaRef.current?.selectionStart ?? triggerOffset)
          return before + CHIP_SENTINEL + " " + after
        }
        return prev + CHIP_SENTINEL + " "
      })

      setTriggerOffset(null)
      setPopoverPos(null)

      // Refocus textarea
      requestAnimationFrame(() => {
        const ta = textareaRef.current
        if (ta) {
          ta.focus()
          const newPos = (triggerOffset ?? rawText.length) + 2 // after sentinel + space
          ta.selectionStart = ta.selectionEnd = Math.min(newPos, ta.value.length)
        }
      })
    }
    prevCtxFilterCount.current = newCount
  }, [ctx.filters.length, ctx.mode, triggerOffset, rawText.length])

  // ── Compute popover position when trigger fires ──
  const updatePopoverPos = useCallback((caretPos: number) => {
    const ta = textareaRef.current
    const container = containerRef.current
    if (!ta || !container) return

    const coords = getCaretCoords(ta, caretPos)
    setPopoverPos({
      top: coords.top + parseInt(getComputedStyle(ta).lineHeight || "20") + 4,
      left: Math.max(0, Math.min(coords.left, container.clientWidth - 280)),
    })
  }, [])

  // ── Get clean text (sentinels replaced with chip display text) ──
  const getDisplayText = useCallback(() => {
    let chipIdx = 0
    let result = ""
    for (const char of rawText) {
      if (char === CHIP_SENTINEL && chipIdx < inlineFilters.length) {
        const f = inlineFilters[chipIdx]
        result += `${f.operator.key}${f.value}`
        chipIdx++
      } else {
        result += char
      }
    }
    return result
  }, [rawText, inlineFilters])

  // ── Get plain text only (no chips) ──
  const getPlainText = useCallback(() => {
    return rawText.replace(new RegExp(CHIP_SENTINEL, "g"), "").replace(/\s+/g, " ").trim()
  }, [rawText])

  // ── Handle text change ──
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const newVal = e.target.value
      const caret = e.target.selectionStart ?? 0

      // If we're in operator/value mode, route to context
      if (ctx.mode === "operator") {
        // Extract the query text after the trigger
        const afterTrigger = newVal.substring(triggerOffset ?? 0)
        // The operator query is what's between trigger position and caret
        const query = afterTrigger.substring(0, caret - (triggerOffset ?? 0))
        ctx.setOperatorQuery(query)
        ctx.setOperatorActiveIndex(0)
        // Don't update rawText -- keep the pre-trigger text stable
        return
      }

      if (ctx.mode === "value") {
        // Route to context value state
        const query = newVal.substring(triggerOffset ?? 0, caret)
        if (ctx.showValueRolodex) {
          ctx.setValueQuery(query)
          ctx.setValueActiveIndex(0)
        } else {
          ctx.setInputValue(query)
        }
        return
      }

      // ── Idle mode ──

      // Check if a chip sentinel was deleted (user backspaced over it)
      const oldSentinelCount = (rawText.match(new RegExp(CHIP_SENTINEL, "g")) || []).length
      const newSentinelCount = (newVal.match(new RegExp(CHIP_SENTINEL, "g")) || []).length
      if (newSentinelCount < oldSentinelCount) {
        // Find which sentinel was removed
        let removed = 0
        let oldIdx = 0
        let newIdx = 0
        const removedIndices: number[] = []
        while (oldIdx < rawText.length) {
          if (rawText[oldIdx] === CHIP_SENTINEL) {
            if (newIdx >= newVal.length || newVal[newIdx] !== CHIP_SENTINEL) {
              removedIndices.push(removed)
              oldIdx++
              removed++
              continue
            }
            removed++
          }
          oldIdx++
          newIdx++
        }
        // Remove corresponding inline filters
        if (removedIndices.length > 0) {
          setInlineFilters((prev) => prev.filter((_, i) => !removedIndices.includes(i)))
          // Also remove from context
          const removedSet = new Set(removedIndices)
          ctx.setFilters((prev) => prev.filter((_, i) => !removedSet.has(i)))
        }
      }

      setRawText(newVal)

      // Check for auto-detect operator pattern (e.g. "site:")
      const textUpToCaret = newVal.substring(0, caret)
      const matchingOp = DORK_OPERATORS.find((op) =>
        textUpToCaret.toLowerCase().endsWith(op.key.toLowerCase())
      )
      if (matchingOp) {
        const opStart = caret - matchingOp.key.length
        setRawText(newVal.substring(0, opStart) + newVal.substring(caret))
        setTriggerOffset(opStart)
        updatePopoverPos(opStart)
        ctx.selectOperator(matchingOp)
        return
      }
    },
    [ctx, rawText, triggerOffset, updatePopoverPos]
  )

  // ── Key handler ──
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      const key = e.key
      const caret = textareaRef.current?.selectionStart ?? 0

      // ── Trigger operator mode ──
      if (ctx.mode === "idle" && key === trigger) {
        // Guard: don't trigger on doubles like "//" or ":\"
        if (trigger === "/" && caret > 0 && rawText[caret - 1] === "/") return
        if (trigger === ":" && caret > 0 && rawText[caret - 1] === "\\") return

        e.preventDefault()
        setTriggerOffset(caret)
        updatePopoverPos(caret)
        ctx.setMode("operator")
        ctx.setOperatorQuery("")
        ctx.setOperatorActiveIndex(0)
        return
      }

      // ── Operator rolodex navigation ──
      if (ctx.mode === "operator") {
        if (key === "ArrowDown" || key === "j") { e.preventDefault(); ctx.navigateOperator(1); return }
        if (key === "ArrowUp" || key === "k") { e.preventDefault(); ctx.navigateOperator(-1); return }
        if (key === "Tab") {
          e.preventDefault()
          if (e.shiftKey || e.ctrlKey) ctx.navigateOperator(-1)
          else if (ctx.filteredOperators.length > 0)
            ctx.selectOperator(ctx.filteredOperators[ctx.operatorActiveIndex])
          return
        }
        if (key === "Enter") {
          e.preventDefault()
          if (ctx.filteredOperators.length > 0)
            ctx.selectOperator(ctx.filteredOperators[ctx.operatorActiveIndex])
          return
        }
        if (key === "Escape") {
          e.preventDefault()
          ctx.resetMode()
          setTriggerOffset(null)
          setPopoverPos(null)
          textareaRef.current?.focus()
          return
        }
        if (key === "Backspace" && ctx.operatorQuery.length === 0) {
          e.preventDefault()
          ctx.resetMode()
          setTriggerOffset(null)
          setPopoverPos(null)
          textareaRef.current?.focus()
          return
        }
        // Allow typing to filter
        if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault()
          ctx.setOperatorQuery((prev) => prev + key)
          ctx.setOperatorActiveIndex(0)
          return
        }
        return
      }

      // ── Value rolodex navigation ──
      if (ctx.mode === "value") {
        if (ctx.showValueRolodex) {
          if (key === "ArrowDown" || key === "j") { e.preventDefault(); ctx.navigateValue(1); return }
          if (key === "ArrowUp" || key === "k") { e.preventDefault(); ctx.navigateValue(-1); return }
          if (key === "Tab") {
            e.preventDefault()
            if (e.shiftKey || e.ctrlKey) ctx.navigateValue(-1)
            else if (ctx.filteredValues.length > 0)
              ctx.selectValue(ctx.filteredValues[ctx.valueActiveIndex])
            return
          }
          if (key === "Enter") {
            e.preventDefault()
            if (ctx.filteredValues.length > 0) ctx.selectValue(ctx.filteredValues[ctx.valueActiveIndex])
            else if (ctx.pendingOperator?.freeform !== false) ctx.commitFreeformValue()
            return
          }
        } else {
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
          setTriggerOffset(null)
          setPopoverPos(null)
          textareaRef.current?.focus()
          return
        }
        // Allow typing to filter values
        if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault()
          if (ctx.showValueRolodex) {
            ctx.setValueQuery((prev) => prev + key)
            ctx.setValueActiveIndex(0)
          } else {
            ctx.setInputValue((prev) => prev + key)
          }
          return
        }
        if (key === "Backspace") {
          e.preventDefault()
          if (ctx.showValueRolodex) {
            ctx.setValueQuery((prev) => prev.slice(0, -1))
          } else {
            ctx.setInputValue((prev) => prev.slice(0, -1))
          }
          return
        }
        return
      }

      // ── Idle: submit ──
      if (key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        const text = getPlainText()
        // Build ActiveFilter array from inline filters
        const activeFilters: ActiveFilter[] = inlineFilters.map((f) => ({
          operator: f.operator,
          value: f.value,
        }))
        onSubmit?.(text, activeFilters)
        ctx.handleSearch()
        return
      }

      if (key === "Escape") {
        e.preventDefault()
        textareaRef.current?.blur()
        return
      }
    },
    [ctx, trigger, rawText, getPlainText, inlineFilters, onSubmit, updatePopoverPos]
  )

  // ── Remove an inline chip ──
  const removeInlineFilter = useCallback(
    (chipIndex: number) => {
      // Remove the nth CHIP_SENTINEL from rawText
      let count = 0
      let newRaw = ""
      for (const char of rawText) {
        if (char === CHIP_SENTINEL) {
          if (count === chipIndex) {
            count++
            continue // skip this sentinel
          }
          count++
        }
        newRaw += char
      }
      setRawText(newRaw)
      setInlineFilters((prev) => prev.filter((_, i) => i !== chipIndex))
      ctx.removeFilter(chipIndex)
      requestAnimationFrame(() => textareaRef.current?.focus())
    },
    [rawText, ctx]
  )

  // ── Build the visual mirror ──
  const renderMirror = useCallback(() => {
    const parts: React.ReactNode[] = []
    let chipIdx = 0

    for (let i = 0; i < rawText.length; i++) {
      if (rawText[i] === CHIP_SENTINEL && chipIdx < inlineFilters.length) {
        const f = inlineFilters[chipIdx]
        const idx = chipIdx
        const Icon = f.operator.icon
        parts.push(
          <span
            key={`chip-${idx}`}
            className={cn(
              "group/inline-chip inline-flex items-center align-baseline rounded border",
              "mx-0.5 font-mono transition-all duration-100",
              compact
                ? "px-1 py-px text-[10px] leading-tight"
                : "px-1.5 py-0.5 text-[11px] leading-tight",
              f.operator.colorClass
            )}
          >
            <Icon className={cn("shrink-0 opacity-60", compact ? "mr-0.5 size-2" : "mr-1 size-2.5")} />
            <span className="font-semibold opacity-70">{f.operator.key}</span>
            <span className={cn("truncate", compact ? "max-w-20" : "max-w-28")}>{f.value}</span>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                removeInlineFilter(idx)
              }}
              className={cn(
                "w-0 overflow-hidden opacity-0 transition-all duration-100 cursor-pointer shrink-0",
                "group-hover/inline-chip:w-2.5 group-hover/inline-chip:ml-0.5 group-hover/inline-chip:opacity-60",
                "hover:!opacity-100"
              )}
              tabIndex={-1}
              aria-label={`Remove ${f.operator.label} filter`}
            >
              <X className="size-2.5 shrink-0" />
            </button>
          </span>
        )
        chipIdx++
      } else {
        // Accumulate text characters
        let text = rawText[i]
        while (i + 1 < rawText.length && rawText[i + 1] !== CHIP_SENTINEL) {
          i++
          text += rawText[i]
        }
        parts.push(
          <span key={`text-${i}`} className="whitespace-pre-wrap">{text}</span>
        )
      }
    }

    return parts
  }, [rawText, inlineFilters, compact, removeInlineFilter])

  // ── Auto-resize textarea height ──
  useLayoutEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = "auto"
      ta.style.height = `${ta.scrollHeight}px`
    }
  }, [rawText])

  // ── Mode query text for display ──
  const modeQueryText =
    ctx.mode === "operator"
      ? ctx.operatorQuery
      : ctx.mode === "value" && ctx.showValueRolodex
        ? ctx.valueQuery
        : ctx.mode === "value"
          ? ctx.inputValue
          : null

  const isActive = ctx.mode !== "idle" || ctx.isFocused
  const hasChips = inlineFilters.length > 0

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Layered container: mirror (visual) on top, textarea (interactive) behind */}
      <div
        className={cn(
          "relative rounded-lg border transition-all duration-200 cursor-text",
          compact ? "px-2 py-1.5 min-h-[32px]" : "px-3 py-2 min-h-[40px]",
          isActive ? "border-primary/40 bg-card" : "border-border/60 bg-card/50 hover:border-border",
          ctx.mode === "value" && "border-accent/40"
        )}
        onClick={() => textareaRef.current?.focus()}
      >
        {/* Visual mirror layer -- renders chips inline */}
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className={cn(
            "pointer-events-auto relative z-10 font-sans",
            compact ? "text-xs leading-relaxed" : "text-sm leading-relaxed",
            "text-foreground",
            // Only show if we have chips to render, otherwise let textarea show through
            !hasChips && ctx.mode === "idle" && "sr-only"
          )}
        >
          {renderMirror()}
          {/* Show inline mode query when in operator/value selection */}
          {ctx.mode !== "idle" && (
            <span className="inline-flex items-center align-baseline">
              <span className="inline-flex mx-0.5"><PendingBadge /></span>
              {modeQueryText && (
                <span className={cn(
                  "font-sans",
                  ctx.mode === "value" ? "text-accent" : "text-primary"
                )}>
                  {modeQueryText}
                </span>
              )}
              <span className="inline-block w-px h-4 bg-foreground animate-pulse ml-px" />
            </span>
          )}
          {/* Placeholder when empty and idle */}
          {rawText.length === 0 && ctx.mode === "idle" && (
            <span className="text-muted-foreground/30 pointer-events-none">{placeholder}</span>
          )}
        </div>

        {/* Real textarea -- hidden when mirror is showing, but always captures input */}
        <textarea
          ref={textareaRef}
          value={rawText}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => ctx.setIsFocused(true)}
          onBlur={() => {
            setTimeout(() => {
              if (!ctx.rootRef.current?.contains(document.activeElement) &&
                  !containerRef.current?.contains(document.activeElement)) {
                ctx.setIsFocused(false)
              }
            }, 150)
          }}
          placeholder={!hasChips && ctx.mode === "idle" ? placeholder : undefined}
          className={cn(
            "font-sans outline-none resize-none bg-transparent w-full",
            compact ? "text-xs leading-relaxed" : "text-sm leading-relaxed",
            "text-foreground placeholder:text-muted-foreground/30",
            // Position: when mirror is visible, make textarea transparent but still interactive
            hasChips || ctx.mode !== "idle"
              ? "absolute inset-0 z-20 opacity-0 px-3 py-2"
              : "relative z-20"
          )}
          rows={rows}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          suppressHydrationWarning
        />
      </div>

      {/* Floating popover for rolodex -- positioned at caret */}
      {(ctx.showOperatorRolodex || ctx.showValueRolodex) && (
        <div
          className="absolute z-50"
          style={{
            top: popoverPos
              ? `${popoverPos.top + (compact ? 32 : 40)}px`
              : "100%",
            left: popoverPos
              ? `${Math.max(0, popoverPos.left)}px`
              : "0",
            width: compact ? "260px" : "320px",
            maxWidth: "calc(100vw - 2rem)",
          }}
        >
          <OperatorRolodexFloating />
          <ValueRolodexFloating />
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────
// Floating variants of rolodex (self-contained positioning)
// ────────────────────────────────────────────────

function OperatorRolodexFloating() {
  const ctx = useDorkQuery()
  if (!ctx.showOperatorRolodex) return null

  // Re-use the same OperatorRolodex but override positioning
  return (
    <div className="relative">
      <div className={cn(
        "rounded-lg border border-border/60 bg-popover shadow-xl shadow-background/40",
        "animate-in fade-in-0 slide-in-from-top-1 duration-150",
        "backdrop-blur-sm"
      )}>
        <OperatorRolodexContent />
      </div>
    </div>
  )
}

function ValueRolodexFloating() {
  const ctx = useDorkQuery()
  if (!ctx.showValueRolodex) return null

  return (
    <div className="relative">
      <div className={cn(
        "rounded-lg border border-border/60 bg-popover shadow-xl shadow-background/40",
        "animate-in fade-in-0 slide-in-from-top-1 duration-150",
        "backdrop-blur-sm"
      )}>
        <ValueRolodexContent />
      </div>
    </div>
  )
}

// ── Extracted rolodex content (reuses operator-rolodex/value-rolodex internals) ──
// These just render OperatorRolodex/ValueRolodex without the absolute positioning wrapper

import { useRef as useRef2, useEffect as useEffect2, forwardRef } from "react"
import { CATEGORIES } from "@/lib/dorks"
import { FuzzyHighlight } from "@/components/fuzzy-highlight"
import { Kbd } from "@/components/ui/kbd"
import { Check } from "lucide-react"
import type { DorkValue } from "@/lib/dorks"

function OperatorRolodexContent() {
  const {
    filteredOperators: operators,
    operatorActiveIndex: activeIndex,
    selectOperator,
    setOperatorActiveIndex: onHover,
    variant,
  } = useDorkQuery()

  const activeRef = useRef2<HTMLButtonElement>(null)
  const compact = variant === "compact"

  useEffect2(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [activeIndex])

  if (operators.length === 0) {
    return (
      <div className={cn("text-center text-muted-foreground font-mono", compact ? "p-2 text-[10px]" : "p-4 text-sm")}>
        {"No matching operators"}
      </div>
    )
  }

  return (
    <>
      <div role="listbox" aria-label="Search operators" className={cn("overflow-y-auto overscroll-contain", compact ? "max-h-48 py-0.5" : "max-h-64 py-1")}>
        {operators.map((op, idx) => {
          const Icon = op.icon
          return (
            <button
              key={op.key}
              ref={idx === activeIndex ? activeRef : undefined}
              role="option"
              aria-selected={idx === activeIndex}
              className={cn(
                "flex w-full items-center text-left transition-colors duration-75 cursor-pointer focus:outline-none",
                compact ? "gap-2 px-2 py-1 text-xs" : "gap-3 px-3 py-1.5 text-sm",
                idx === activeIndex
                  ? "bg-secondary/80 text-foreground"
                  : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
              )}
              onMouseDown={(e) => {
                e.preventDefault()
                selectOperator(op)
              }}
              onMouseEnter={() => onHover(idx)}
              tabIndex={-1}
            >
              <div className={cn(
                "flex shrink-0 items-center justify-center rounded-md border transition-colors",
                compact ? "size-5" : "size-6",
                idx === activeIndex ? op.colorClass : "border-border/60 text-muted-foreground"
              )}>
                <Icon className={compact ? "size-2.5" : "size-3"} />
              </div>
              <div className="flex flex-1 flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <FuzzyHighlight
                    text={op.key}
                    indices={op._fuzzyIndices}
                    className={cn("font-mono font-semibold", compact ? "text-[11px]" : "text-xs")}
                    highlightClassName="text-primary"
                  />
                  <span className={cn("truncate text-muted-foreground/50", compact ? "text-[10px]" : "text-xs")}>
                    {op.description}
                  </span>
                </div>
              </div>
              {idx === activeIndex && (
                <Kbd className={cn(compact ? "text-[9px] px-1 py-0 h-3.5" : "text-[10px]")}>{"Tab"}</Kbd>
              )}
            </button>
          )
        })}
      </div>
      <div className={cn(
        "flex items-center justify-between border-t border-border/40",
        compact ? "px-2 py-1" : "px-3 py-1.5"
      )}>
        <div className={cn("flex items-center gap-2 text-muted-foreground/40", compact ? "text-[9px]" : "text-[10px]")}>
          <span className="flex items-center gap-0.5">
            <Kbd className="text-[8px] px-0.5 py-0 h-3.5 min-w-3.5">{"j"}</Kbd>
            <Kbd className="text-[8px] px-0.5 py-0 h-3.5 min-w-3.5">{"k"}</Kbd>
          </span>
          <span className="flex items-center gap-0.5">
            <Kbd className="text-[8px] px-0.5 py-0 h-3.5 min-w-3.5">{"Tab"}</Kbd>
          </span>
          <span className="flex items-center gap-0.5">
            <Kbd className="text-[8px] px-0.5 py-0 h-3.5 min-w-3.5">{"Esc"}</Kbd>
          </span>
        </div>
        <span className={cn("font-mono text-muted-foreground/30", compact ? "text-[9px]" : "text-[10px]")}>
          {operators.length}
        </span>
      </div>
    </>
  )
}

function ValueRolodexContent() {
  const {
    filteredValues: values,
    valueActiveIndex: activeIndex,
    selectValue,
    setValueActiveIndex: onHover,
    pendingOperator,
    filters,
    valueQuery,
    variant,
  } = useDorkQuery()

  const activeRef = useRef2<HTMLButtonElement>(null)
  const compact = variant === "compact"

  useEffect2(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [activeIndex])

  if (!pendingOperator) return null

  const selectedValues = new Set(
    filters.filter((f) => f.operator.key === pendingOperator.key).map((f) => f.value)
  )
  const Icon = pendingOperator.icon

  return (
    <>
      {/* Header */}
      <div className={cn("flex items-center border-b border-border/40", compact ? "gap-1.5 px-2 py-1" : "gap-2 px-3 py-1.5")}>
        <div className={cn("flex items-center justify-center rounded-md border", compact ? "size-5" : "size-6", pendingOperator.colorClass)}>
          <Icon className={compact ? "size-2.5" : "size-3"} />
        </div>
        <span className={cn("font-mono font-semibold text-foreground", compact ? "text-[10px]" : "text-xs")}>{pendingOperator.key}</span>
        <span className={cn("text-muted-foreground/60", compact ? "text-[10px]" : "text-xs")}>{"Select a value"}</span>
      </div>

      {/* List */}
      <div role="listbox" className={cn("overflow-y-auto overscroll-contain", compact ? "max-h-40 py-0.5" : "max-h-56 py-1")}>
        {values.length === 0 ? (
          <div className={cn("flex flex-col items-center gap-1 text-center", compact ? "p-2" : "p-3")}>
            <span className={cn("text-muted-foreground font-mono", compact ? "text-[10px]" : "text-sm")}>{"No matching values"}</span>
            {pendingOperator.freeform !== false && valueQuery.trim() && (
              <span className={cn("text-muted-foreground/50", compact ? "text-[9px]" : "text-xs")}>
                {"Press "}<Kbd className="text-[9px] px-1 py-0 h-4 inline-flex">{"Enter"}</Kbd>{" to use "}
                <span className="font-mono text-accent">{`"${valueQuery.trim()}"`}</span>
              </span>
            )}
          </div>
        ) : (
          values.map((dv, idx) => {
            const isSelected = selectedValues.has(dv.value)
            return (
              <button
                key={dv.value}
                ref={idx === activeIndex ? activeRef : undefined}
                role="option"
                aria-selected={idx === activeIndex}
                className={cn(
                  "flex w-full items-center text-left transition-colors duration-75 cursor-pointer focus:outline-none",
                  compact ? "gap-2 px-2 py-0.5 text-[11px]" : "gap-3 px-3 py-1.5 text-sm",
                  idx === activeIndex
                    ? "bg-secondary/80 text-foreground"
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                  isSelected && "opacity-50"
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectValue(dv)
                }}
                onMouseEnter={() => onHover(idx)}
                tabIndex={-1}
                disabled={isSelected}
              >
                <div className={cn(
                  "flex shrink-0 items-center justify-center rounded border px-1.5 font-mono font-medium transition-colors",
                  compact ? "h-5 min-w-[2.5rem] text-[10px]" : "h-6 min-w-[3rem] text-[11px]",
                  idx === activeIndex ? pendingOperator.colorClass : "border-border/40 text-muted-foreground"
                )}>
                  <FuzzyHighlight text={dv.value} indices={dv._fuzzyIndices} className="" highlightClassName="text-primary font-bold" />
                </div>
                <div className="flex flex-1 flex-col min-w-0">
                  <span className={cn("font-medium truncate", compact ? "text-[10px]" : "text-xs")}>{dv.label}</span>
                  {dv.description && !compact && (
                    <span className="text-[10px] text-muted-foreground/50 truncate">{dv.description}</span>
                  )}
                </div>
                {isSelected && <Check className={cn("shrink-0 text-primary", compact ? "size-2.5" : "size-3.5")} />}
                {idx === activeIndex && !isSelected && (
                  <Kbd className={cn(compact ? "text-[9px] px-0.5 py-0 h-3.5" : "text-[10px]")}>{"Tab"}</Kbd>
                )}
              </button>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className={cn("flex items-center justify-between border-t border-border/40", compact ? "px-2 py-1" : "px-3 py-1.5")}>
        <div className={cn("flex items-center gap-2 text-muted-foreground/40", compact ? "text-[9px]" : "text-[10px]")}>
          <Kbd className="text-[8px] px-0.5 py-0 h-3.5">{"j"}</Kbd>
          <Kbd className="text-[8px] px-0.5 py-0 h-3.5">{"k"}</Kbd>
          <Kbd className="text-[8px] px-0.5 py-0 h-3.5">{"Tab"}</Kbd>
          <Kbd className="text-[8px] px-0.5 py-0 h-3.5">{"Esc"}</Kbd>
        </div>
        <span className={cn("font-mono text-muted-foreground/30", compact ? "text-[9px]" : "text-[10px]")}>
          {values.length}/{pendingOperator.values?.length ?? 0}
        </span>
      </div>
    </>
  )
}
