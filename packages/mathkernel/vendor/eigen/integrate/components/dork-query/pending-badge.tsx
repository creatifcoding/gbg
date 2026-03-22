"use client"

import { Slash } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDorkQuery } from "./context"

export function PendingBadge() {
  const { mode, pendingOperator, variant } = useDorkQuery()
  const compact = variant === "compact"

  if (mode === "value" && pendingOperator) {
    const Icon = pendingOperator.icon
    return (
      <span
        className={cn(
          "inline-flex items-center font-mono",
          "animate-in fade-in-0 slide-in-from-left-1 duration-150",
          compact
            ? "gap-0.5 rounded border px-1.5 py-px text-[10px] leading-tight"
            : "gap-1 rounded-md border px-2 py-0.5 text-xs",
          pendingOperator.colorClass
        )}
      >
        {!compact && <Icon className="size-3 opacity-70" />}
        <span className="font-semibold">{pendingOperator.key}</span>
      </span>
    )
  }

  if (mode === "operator") {
    return (
      <span className={cn(
        "inline-flex items-center gap-1 text-primary font-mono animate-in fade-in-0 duration-100",
        compact ? "text-[10px]" : "text-xs"
      )}>
        <Slash className={compact ? "size-2.5" : "size-3"} />
      </span>
    )
  }

  return null
}
