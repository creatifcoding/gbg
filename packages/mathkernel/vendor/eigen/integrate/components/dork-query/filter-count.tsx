"use client"

import { cn } from "@/lib/utils"
import { useDorkQuery } from "./context"

export function FilterCount() {
  const { filters, variant } = useDorkQuery()
  if (filters.length === 0) return null

  return (
    <span
      className={cn(
        "shrink-0 rounded-full bg-primary/15 font-mono font-semibold text-primary tabular-nums",
        variant === "compact"
          ? "px-1.5 py-px text-[9px]"
          : "px-2 py-0.5 text-[10px]"
      )}
    >
      {filters.length}
    </span>
  )
}
