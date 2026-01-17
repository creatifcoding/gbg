/** @jsxImportSource @opentui/react */
/**
 * Progress Primitive
 *
 * Progress bar for showing completion state.
 * Note: OpenTUI doesn't have a built-in slider, so this is a text-based implementation.
 */
import type { ReactNode } from "react"
import type { Dimension } from "./box"

// =============================================================================
// PROGRESS BAR
// =============================================================================

export interface ProgressProps {
  value: number
  max?: number
  width?: Dimension
  showLabel?: boolean
  color?: string
  emptyColor?: string
}

export const Progress = ({
  value,
  max = 100,
  showLabel = true,
  color = "cyan",
  emptyColor = "gray",
}: ProgressProps): ReactNode => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  const barWidth = 20
  const filled = Math.round((percentage / 100) * barWidth)
  const empty = barWidth - filled

  return (
    <box style={{ flexDirection: "row" }}>
      <text style={{ fg: color }}>{"█".repeat(filled)}</text>
      <text style={{ fg: emptyColor }}>{"░".repeat(empty)}</text>
      {showLabel && (
        <text style={{ fg: "gray" }}> {Math.round(percentage)}%</text>
      )}
    </box>
  )
}

// Alias
export const ProgressBar = Progress
