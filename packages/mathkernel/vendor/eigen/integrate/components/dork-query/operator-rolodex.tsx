"use client"

import { useRef, useEffect, forwardRef } from "react"
import { cn } from "@/lib/utils"
import { CATEGORIES, type DorkOperator } from "@/lib/dorks"
import { FuzzyHighlight } from "@/components/fuzzy-highlight"
import { Kbd } from "@/components/ui/kbd"
import { useDorkQuery } from "./context"

export function OperatorRolodex() {
  const {
    filteredOperators: operators,
    operatorActiveIndex: activeIndex,
    selectOperator,
    setOperatorActiveIndex: onHover,
    showOperatorRolodex,
    variant,
  } = useDorkQuery()

  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [activeIndex])

  if (!showOperatorRolodex) return null

  const compact = variant === "compact"

  if (operators.length === 0) {
    return (
      <RolodexShell compact={compact}>
        <div className={cn(
          "text-center text-muted-foreground font-mono",
          compact ? "p-2 text-[10px]" : "p-4 text-sm"
        )}>
          {"No matching operators"}
        </div>
      </RolodexShell>
    )
  }

  // Compact: flat list, no category groups
  if (compact) {
    return (
      <RolodexShell compact>
        <div role="listbox" aria-label="Search operators" className="max-h-48 overflow-y-auto overscroll-contain py-0.5">
          {operators.map((op, idx) => (
            <CompactOperatorOption
              key={op.key}
              ref={idx === activeIndex ? activeRef : undefined}
              operator={op}
              isActive={idx === activeIndex}
              onSelect={() => selectOperator(op)}
              onHover={() => onHover(idx)}
            />
          ))}
        </div>
        <CompactRolodexFooter count={operators.length} />
      </RolodexShell>
    )
  }

  // Default: grouped by category
  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    items: operators
      .map((op, originalIndex) => ({ op, originalIndex }))
      .filter(({ op }) => op.category === cat.key),
  })).filter((g) => g.items.length > 0)

  return (
    <RolodexShell compact={false}>
      <div role="listbox" aria-label="Search operators" className="max-h-72 overflow-y-auto overscroll-contain py-1">
        {grouped.map((group) => (
          <OperatorGroup key={group.key} label={group.label}>
            {group.items.map(({ op, originalIndex }) => (
              <OperatorOption
                key={op.key}
                ref={originalIndex === activeIndex ? activeRef : undefined}
                operator={op}
                isActive={originalIndex === activeIndex}
                onSelect={() => selectOperator(op)}
                onHover={() => onHover(originalIndex)}
              />
            ))}
          </OperatorGroup>
        ))}
        <RolodexFooter count={operators.length} unit="operator" />
      </div>
    </RolodexShell>
  )
}

// ────────────────────────────────────────────────
// Shared shell
// ────────────────────────────────────────────────

function RolodexShell({
  children,
  id,
  compact,
}: {
  children: React.ReactNode
  id?: string
  compact: boolean
}) {
  return (
    <div
      id={id}
      className={cn(
        "absolute left-0 right-0 top-full z-50",
        "rounded-lg border border-border/60 bg-popover shadow-xl shadow-background/40",
        "animate-in fade-in-0 slide-in-from-top-1 duration-150",
        "backdrop-blur-sm",
        compact ? "mt-1" : "mt-1.5"
      )}
    >
      {children}
    </div>
  )
}

// ────────────────────────────────────────────────
// Default variant sub-components
// ────────────────────────────────────────────────

function OperatorGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div role="group" aria-label={label}>
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          {label}
        </span>
        <div className="h-px flex-1 bg-border/40" />
      </div>
      {children}
    </div>
  )
}

interface OperatorOptionProps {
  operator: DorkOperator & { _fuzzyIndices: number[] }
  isActive: boolean
  onSelect: () => void
  onHover: () => void
}

const OperatorOption = forwardRef<HTMLButtonElement, OperatorOptionProps>(
  ({ operator, isActive, onSelect, onHover }, ref) => {
    const Icon = operator.icon
    return (
      <button
        ref={ref}
        role="option"
        id={`dork-op-${operator.key}`}
        aria-selected={isActive}
        className={cn(
          "flex w-full items-center gap-3 px-3 py-2 text-left text-sm",
          "transition-colors duration-75 cursor-pointer focus:outline-none",
          isActive
            ? "bg-secondary/80 text-foreground"
            : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
        )}
        onClick={onSelect}
        onMouseEnter={onHover}
        onMouseMove={() => onHover()}
        tabIndex={-1}
      >
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md border",
            "transition-colors duration-75",
            isActive ? operator.colorClass : "border-border/60 text-muted-foreground"
          )}
        >
          <Icon className="size-3.5" />
        </div>
        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <FuzzyHighlight
              text={operator.key}
              indices={operator._fuzzyIndices}
              className="font-mono text-xs font-semibold"
              highlightClassName="text-primary"
            />
            <span className="text-xs text-muted-foreground/60 truncate">{operator.description}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {operator.examples.slice(0, 3).map((ex) => (
              <span key={ex} className="rounded bg-muted/60 px-1.5 py-px text-[10px] font-mono text-muted-foreground/70">
                {ex}
              </span>
            ))}
            {operator.values && (
              <span className="rounded bg-primary/10 px-1.5 py-px text-[10px] font-mono text-primary/70">
                {operator.values.length} values
              </span>
            )}
          </div>
        </div>
        {isActive && (
          <div className="flex items-center gap-1 shrink-0">
            <Kbd className="text-[10px]">{"Tab"}</Kbd>
          </div>
        )}
      </button>
    )
  }
)
OperatorOption.displayName = "OperatorOption"

function RolodexFooter({ count, unit }: { count: number; unit: string }) {
  return (
    <div className="flex items-center justify-between border-t border-border/40 px-3 py-2 mt-1">
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50">
        <span className="flex items-center gap-1">
          <Kbd className="text-[9px] px-1 py-0 h-4 min-w-4">{"j"}</Kbd>
          <Kbd className="text-[9px] px-1 py-0 h-4 min-w-4">{"k"}</Kbd>
          <span>{"navigate"}</span>
        </span>
        <span className="flex items-center gap-1">
          <Kbd className="text-[9px] px-1 py-0 h-4 min-w-4">{"Tab"}</Kbd>
          <span>{"select"}</span>
        </span>
        <span className="flex items-center gap-1">
          <Kbd className="text-[9px] px-1 py-0 h-4 min-w-4">{"Esc"}</Kbd>
          <span>{"dismiss"}</span>
        </span>
      </div>
      <span className="text-[10px] font-mono text-muted-foreground/40">
        {count} {count === 1 ? unit : `${unit}s`}
      </span>
    </div>
  )
}

// ────────────────────────────────────────────────
// Compact variant sub-components
// ────────────────────────────────────────────────

interface CompactOperatorOptionProps {
  operator: DorkOperator & { _fuzzyIndices: number[] }
  isActive: boolean
  onSelect: () => void
  onHover: () => void
}

const CompactOperatorOption = forwardRef<HTMLButtonElement, CompactOperatorOptionProps>(
  ({ operator, isActive, onSelect, onHover }, ref) => {
    const Icon = operator.icon
    return (
      <button
        ref={ref}
        role="option"
        id={`dork-op-${operator.key}`}
        aria-selected={isActive}
        className={cn(
          "flex w-full items-center gap-2 px-2 py-1 text-left text-xs",
          "transition-colors duration-75 cursor-pointer focus:outline-none",
          isActive
            ? "bg-secondary/80 text-foreground"
            : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
        )}
        onClick={onSelect}
        onMouseEnter={onHover}
        onMouseMove={() => onHover()}
        tabIndex={-1}
      >
        <div
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded border",
            "transition-colors duration-75",
            isActive ? operator.colorClass : "border-border/60 text-muted-foreground"
          )}
        >
          <Icon className="size-2.5" />
        </div>
        <FuzzyHighlight
          text={operator.key}
          indices={operator._fuzzyIndices}
          className="font-mono text-[11px] font-semibold"
          highlightClassName="text-primary"
        />
        <span className="flex-1 truncate text-[10px] text-muted-foreground/50">{operator.description}</span>
        {isActive && (
          <Kbd className="text-[9px] px-1 py-0 h-3.5 min-w-3.5">{"Tab"}</Kbd>
        )}
      </button>
    )
  }
)
CompactOperatorOption.displayName = "CompactOperatorOption"

function CompactRolodexFooter({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-between border-t border-border/40 px-2 py-1">
      <div className="flex items-center gap-2 text-[9px] text-muted-foreground/40">
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
      <span className="text-[9px] font-mono text-muted-foreground/30">{count}</span>
    </div>
  )
}
