"use client"

import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DorkOperator } from "@/lib/dorks"
import type { DorkVariant } from "./context"

interface DorkChipProps {
  operator: DorkOperator
  value: string
  onRemove: () => void
  isFocused?: boolean
  variant?: DorkVariant
}

export function DorkChip({ operator, value, onRemove, isFocused, variant = "default" }: DorkChipProps) {
  const Icon = operator.icon
  const compact = variant === "compact"

  if (compact) {
    return (
      <span
        className={cn(
          "group inline-flex items-center rounded border px-1.5 py-px text-[10px] font-mono leading-tight",
          "transition-all duration-100",
          operator.colorClass,
          isFocused && "ring-1 ring-ring ring-offset-1 ring-offset-background"
        )}
        role="option"
        aria-selected={isFocused}
        aria-label={`${operator.label}: ${value}`}
      >
        <span className="mr-1 font-semibold opacity-70">{operator.key}</span>
        <span className="max-w-20 truncate">{value}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="w-0 overflow-hidden opacity-0 group-hover:ml-0.5 group-hover:w-2.5 group-hover:opacity-60 hover:!opacity-100 focus:ml-0.5 focus:w-2.5 focus:opacity-100 focus:outline-none transition-all duration-100 cursor-pointer rounded-sm shrink-0"
          aria-label={`Remove ${operator.label} filter`}
          tabIndex={-1}
        >
          <X className="size-2.5 shrink-0" />
        </button>
      </span>
    )
  }

  return (
    <span
      className={cn(
        "group inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono",
        "transition-all duration-150",
        operator.colorClass,
        isFocused && "ring-2 ring-ring ring-offset-1 ring-offset-background scale-105"
      )}
      role="option"
      aria-selected={isFocused}
      aria-label={`${operator.label}: ${value}`}
    >
      <Icon className="mr-1.5 size-3 shrink-0 opacity-70" />
      <span className="mr-1.5 font-semibold opacity-80">{operator.key}</span>
      <span className="max-w-32 truncate">{value}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="w-0 overflow-hidden opacity-0 group-hover:ml-1 group-hover:w-3 group-hover:opacity-60 hover:!opacity-100 focus:ml-1 focus:w-3 focus:opacity-100 focus:outline-none transition-all duration-150 cursor-pointer rounded-sm shrink-0"
        aria-label={`Remove ${operator.label} filter`}
        tabIndex={-1}
      >
        <X className="size-3 shrink-0" />
      </button>
    </span>
  )
}
