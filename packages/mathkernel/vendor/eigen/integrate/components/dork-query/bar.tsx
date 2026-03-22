"use client"

import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDorkQuery } from "./context"

interface DorkBarProps {
  children: React.ReactNode
  className?: string
}

export function DorkBar({ children, className }: DorkBarProps) {
  const { isFocused, mode, inputRef, setFocusedChipIndex, variant } = useDorkQuery()
  const compact = variant === "compact"

  return (
    <div
      className={cn(
        "flex items-center rounded-lg border transition-all duration-200 cursor-text",
        compact
          ? "gap-1.5 px-2 py-1.5 border-transparent bg-transparent"
          : "gap-2 px-3 py-2.5 bg-card",
        isFocused && !compact && "border-primary/50 shadow-[0_0_0_1px_oklch(0.7_0.15_195/0.15),0_2px_12px_-2px_oklch(0.7_0.15_195/0.1)]",
        isFocused && compact && "border-primary/30",
        !isFocused && !compact && "border-border hover:border-border/80",
        !isFocused && compact && "border-transparent hover:border-border/40",
        mode === "value" && !compact && "border-accent/50 shadow-[0_0_0_1px_oklch(0.72_0.12_165/0.15)]",
        mode === "value" && compact && "border-accent/30",
        className
      )}
      onClick={() => {
        inputRef.current?.focus()
        setFocusedChipIndex(-1)
      }}
    >
      <Search
        className={cn(
          "shrink-0 transition-colors duration-150",
          compact ? "size-3.5" : "size-4",
          isFocused ? "text-primary" : "text-muted-foreground"
        )}
      />
      <div className={cn(
        "flex flex-1 flex-wrap items-center min-w-0",
        compact ? "gap-1" : "gap-1.5",
      )}>
        {children}
      </div>
    </div>
  )
}
