"use client"

import { Kbd } from "@/components/ui/kbd"
import { useDorkQuery } from "./context"

export function SlashHint() {
  const { isFocused, filters, inputValue, variant, trigger } = useDorkQuery()

  if (isFocused || filters.length > 0 || inputValue !== "") return null

  return (
    <div className="flex items-center shrink-0">
      <Kbd className={variant === "compact" ? "text-[9px] px-1 py-0 h-4 min-w-4" : undefined}>{trigger}</Kbd>
    </div>
  )
}
