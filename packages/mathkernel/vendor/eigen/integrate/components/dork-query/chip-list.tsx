"use client"

import { cn } from "@/lib/utils"
import { useDorkQuery } from "./context"
import { DorkChip } from "./chip"

interface DorkChipListProps {
  className?: string
}

export function DorkChipList({ className }: DorkChipListProps) {
  const { filters, focusedChipIndex, removeFilter, variant } = useDorkQuery()

  if (filters.length === 0) return null

  return (
    <div
      className={cn(
        "flex flex-wrap items-center",
        variant === "compact" ? "gap-1" : "gap-1.5",
        className
      )}
      role="listbox"
      aria-label="Active filters"
    >
      {filters.map((filter, i) => (
        <DorkChip
          key={`${filter.operator.key}-${filter.value}-${i}`}
          operator={filter.operator}
          value={filter.value}
          onRemove={() => removeFilter(i)}
          isFocused={focusedChipIndex === i}
          variant={variant}
        />
      ))}
    </div>
  )
}
