"use client"

import { useRef, useEffect, forwardRef } from "react"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import { FuzzyHighlight } from "@/components/fuzzy-highlight"
import { Kbd } from "@/components/ui/kbd"
import { useDorkQuery } from "./context"
import type { DorkValue } from "@/lib/dorks"

export function ValueRolodex() {
  const {
    filteredValues: values,
    valueActiveIndex: activeIndex,
    selectValue,
    setValueActiveIndex: onHover,
    showValueRolodex,
    pendingOperator,
    filters,
    valueQuery,
    variant,
  } = useDorkQuery()

  const activeRef = useRef<HTMLButtonElement>(null)
  const compact = variant === "compact"

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [activeIndex])

  if (!showValueRolodex || !pendingOperator) return null

  const selectedValues = new Set(
    filters.filter((f) => f.operator.key === pendingOperator.key).map((f) => f.value)
  )

  const Icon = pendingOperator.icon

  return (
    <div
      id="dork-value-rolodex"
      className={cn(
        "absolute left-0 right-0 top-full z-50",
        "rounded-lg border border-border/60 bg-popover shadow-xl shadow-background/40",
        "animate-in fade-in-0 slide-in-from-top-1 duration-150",
        "backdrop-blur-sm",
        compact ? "mt-1" : "mt-1.5"
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center border-b border-border/40",
        compact ? "gap-1.5 px-2 py-1" : "gap-2 px-3 py-2"
      )}>
        <div className={cn(
          "flex items-center justify-center rounded-md border",
          compact ? "size-5" : "size-6",
          pendingOperator.colorClass
        )}>
          <Icon className={compact ? "size-2.5" : "size-3"} />
        </div>
        <span className={cn(
          "font-mono font-semibold text-foreground",
          compact ? "text-[10px]" : "text-xs"
        )}>{pendingOperator.key}</span>
        <span className={cn(
          "text-muted-foreground/60",
          compact ? "text-[10px]" : "text-xs"
        )}>{"Select a value"}</span>
        {pendingOperator.freeform !== false && (
          <span className={cn(
            "ml-auto font-mono text-muted-foreground/40",
            compact ? "text-[9px]" : "text-[10px]"
          )}>{"or type custom"}</span>
        )}
      </div>

      {/* Value list */}
      <div
        role="listbox"
        aria-label={`${pendingOperator.label} values`}
        className={cn(
          "overflow-y-auto overscroll-contain",
          compact ? "max-h-40 py-0.5" : "max-h-64 py-1"
        )}
      >
        {values.length === 0 ? (
          <div className={cn(
            "flex flex-col items-center gap-1 text-center",
            compact ? "p-2" : "p-4"
          )}>
            <span className={cn(
              "text-muted-foreground font-mono",
              compact ? "text-[10px]" : "text-sm"
            )}>{"No matching values"}</span>
            {pendingOperator.freeform !== false && valueQuery.trim() && (
              <span className={cn(
                "text-muted-foreground/50",
                compact ? "text-[9px]" : "text-xs"
              )}>
                {"Press"} <Kbd className="text-[9px] px-1 py-0 h-4 min-w-4 inline-flex">{"Enter"}</Kbd> {"to use"}{" "}
                <span className="font-mono text-accent">{`"${valueQuery.trim()}"`}</span>
              </span>
            )}
          </div>
        ) : compact ? (
          values.map((dv, idx) => (
            <CompactValueOption
              key={dv.value}
              ref={idx === activeIndex ? activeRef : undefined}
              dorkValue={dv}
              isActive={idx === activeIndex}
              isSelected={selectedValues.has(dv.value)}
              onSelect={() => selectValue(dv)}
              onHover={() => onHover(idx)}
              operatorColorClass={pendingOperator.colorClass}
            />
          ))
        ) : (
          values.map((dv, idx) => (
            <ValueOption
              key={dv.value}
              ref={idx === activeIndex ? activeRef : undefined}
              dorkValue={dv}
              isActive={idx === activeIndex}
              isSelected={selectedValues.has(dv.value)}
              onSelect={() => selectValue(dv)}
              onHover={() => onHover(idx)}
              operatorColorClass={pendingOperator.colorClass}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className={cn(
        "flex items-center justify-between border-t border-border/40",
        compact ? "px-2 py-1" : "px-3 py-2"
      )}>
        <div className={cn(
          "flex items-center text-muted-foreground/50",
          compact ? "gap-2 text-[9px]" : "gap-3 text-[10px]"
        )}>
          <span className="flex items-center gap-0.5">
            <Kbd className={cn(compact ? "text-[8px] px-0.5 py-0 h-3.5 min-w-3.5" : "text-[9px] px-1 py-0 h-4 min-w-4")}>{"j"}</Kbd>
            <Kbd className={cn(compact ? "text-[8px] px-0.5 py-0 h-3.5 min-w-3.5" : "text-[9px] px-1 py-0 h-4 min-w-4")}>{"k"}</Kbd>
          </span>
          <span className="flex items-center gap-0.5">
            <Kbd className={cn(compact ? "text-[8px] px-0.5 py-0 h-3.5 min-w-3.5" : "text-[9px] px-1 py-0 h-4 min-w-4")}>{"Tab"}</Kbd>
          </span>
          <span className="flex items-center gap-0.5">
            <Kbd className={cn(compact ? "text-[8px] px-0.5 py-0 h-3.5 min-w-3.5" : "text-[9px] px-1 py-0 h-4 min-w-4")}>{"Esc"}</Kbd>
          </span>
        </div>
        <span className={cn(
          "font-mono text-muted-foreground/40",
          compact ? "text-[9px]" : "text-[10px]"
        )}>
          {values.length}/{pendingOperator.values?.length ?? 0}
        </span>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────
// Default value option
// ────────────────────────────────────────────────

interface ValueOptionProps {
  dorkValue: DorkValue & { _fuzzyIndices: number[] }
  isActive: boolean
  isSelected: boolean
  onSelect: () => void
  onHover: () => void
  operatorColorClass: string
}

const ValueOption = forwardRef<HTMLButtonElement, ValueOptionProps>(
  ({ dorkValue, isActive, isSelected, onSelect, onHover, operatorColorClass }, ref) => {
    return (
      <button
        ref={ref}
        role="option"
        id={`dork-val-${dorkValue.value}`}
        aria-selected={isActive}
        className={cn(
          "flex w-full items-center gap-3 px-3 py-1.5 text-left text-sm",
          "transition-colors duration-75 cursor-pointer focus:outline-none",
          isActive
            ? "bg-secondary/80 text-foreground"
            : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
          isSelected && "opacity-50"
        )}
        onClick={onSelect}
        onMouseEnter={onHover}
        onMouseMove={() => onHover()}
        tabIndex={-1}
        disabled={isSelected}
      >
        <div
          className={cn(
            "flex h-6 min-w-[3rem] shrink-0 items-center justify-center rounded-md border px-2",
            "font-mono text-[11px] font-medium transition-colors duration-75",
            isActive ? operatorColorClass : "border-border/40 text-muted-foreground"
          )}
        >
          <FuzzyHighlight
            text={dorkValue.value}
            indices={dorkValue._fuzzyIndices}
            className=""
            highlightClassName="text-primary font-bold"
          />
        </div>
        <div className="flex flex-1 flex-col min-w-0">
          <span className="text-xs font-medium truncate">{dorkValue.label}</span>
          {dorkValue.description && (
            <span className="text-[10px] text-muted-foreground/50 truncate">{dorkValue.description}</span>
          )}
        </div>
        {isSelected && <Check className="size-3.5 shrink-0 text-primary" />}
        {isActive && !isSelected && (
          <Kbd className="text-[10px] shrink-0">{"Tab"}</Kbd>
        )}
      </button>
    )
  }
)
ValueOption.displayName = "ValueOption"

// ────────────────────────────────────────────────
// Compact value option
// ────────────────────────────────────────────────

const CompactValueOption = forwardRef<HTMLButtonElement, ValueOptionProps>(
  ({ dorkValue, isActive, isSelected, onSelect, onHover, operatorColorClass }, ref) => {
    return (
      <button
        ref={ref}
        role="option"
        id={`dork-val-${dorkValue.value}`}
        aria-selected={isActive}
        className={cn(
          "flex w-full items-center gap-2 px-2 py-0.5 text-left text-[11px]",
          "transition-colors duration-75 cursor-pointer focus:outline-none",
          isActive
            ? "bg-secondary/80 text-foreground"
            : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
          isSelected && "opacity-50"
        )}
        onClick={onSelect}
        onMouseEnter={onHover}
        onMouseMove={() => onHover()}
        tabIndex={-1}
        disabled={isSelected}
      >
        <div
          className={cn(
            "flex h-5 min-w-[2.5rem] shrink-0 items-center justify-center rounded border px-1.5",
            "font-mono text-[10px] font-medium transition-colors duration-75",
            isActive ? operatorColorClass : "border-border/40 text-muted-foreground"
          )}
        >
          <FuzzyHighlight
            text={dorkValue.value}
            indices={dorkValue._fuzzyIndices}
            className=""
            highlightClassName="text-primary font-bold"
          />
        </div>
        <span className="flex-1 truncate text-[10px]">{dorkValue.label}</span>
        {isSelected && <Check className="size-2.5 shrink-0 text-primary" />}
        {isActive && !isSelected && (
          <Kbd className="text-[9px] px-0.5 py-0 h-3.5 min-w-3.5 shrink-0">{"Tab"}</Kbd>
        )}
      </button>
    )
  }
)
CompactValueOption.displayName = "CompactValueOption"
