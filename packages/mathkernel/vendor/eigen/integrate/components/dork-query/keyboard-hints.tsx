"use client"

import { cn } from "@/lib/utils"
import { Kbd } from "@/components/ui/kbd"
import { DEFAULT_TRIGGER, type AllowedTrigger } from "@/lib/dorks"

interface KeyboardHintsProps {
  className?: string
  trigger?: AllowedTrigger
}

export function KeyboardHints({ className, trigger = DEFAULT_TRIGGER }: KeyboardHintsProps) {
  const hints = [
    { keys: [trigger], label: "operators" },
    { keys: ["j", "k"], label: "navigate" },
    { keys: ["Tab"], label: "select" },
    { keys: ["Ctrl", "Tab"], label: "prev", join: "+" },
    { keys: ["Esc"], label: "dismiss" },
  ]

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground/60", className)}>
      {hints.map((hint) => (
        <span key={hint.label} className="flex items-center gap-1.5">
          {hint.keys.map((k, i) => (
            <span key={k} className="flex items-center gap-0.5">
              {i > 0 && hint.join && <span className="text-muted-foreground/30">{hint.join}</span>}
              <Kbd className="text-[10px] px-1.5 py-0 h-5 min-w-5">{k}</Kbd>
            </span>
          ))}
          <span>{hint.label}</span>
        </span>
      ))}
    </div>
  )
}
