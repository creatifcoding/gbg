"use client"

import { cn } from "@/lib/utils"

interface FuzzyHighlightProps {
  text: string
  indices: number[]
  className?: string
  highlightClassName?: string
}

export function FuzzyHighlight({
  text,
  indices,
  className,
  highlightClassName,
}: FuzzyHighlightProps) {
  if (indices.length === 0) {
    return <span className={className}>{text}</span>
  }

  const indexSet = new Set(indices)
  const parts: { text: string; highlighted: boolean }[] = []
  let current = ""
  let isHighlighted = indexSet.has(0)

  for (let i = 0; i < text.length; i++) {
    const charHighlighted = indexSet.has(i)
    if (charHighlighted !== isHighlighted) {
      if (current) parts.push({ text: current, highlighted: isHighlighted })
      current = text[i]
      isHighlighted = charHighlighted
    } else {
      current += text[i]
    }
  }
  if (current) parts.push({ text: current, highlighted: isHighlighted })

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.highlighted ? (
          <span
            key={i}
            className={cn("text-foreground font-semibold", highlightClassName)}
          >
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </span>
  )
}
