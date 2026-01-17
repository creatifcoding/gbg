/** @jsxImportSource @opentui/react */
/**
 * Divider Primitive
 *
 * Horizontal or vertical separator line.
 */
import type { ReactNode } from "react"

export type DividerOrientation = "horizontal" | "vertical"

export interface DividerProps {
  orientation?: DividerOrientation
  color?: string
  char?: string
}

export const Divider = ({
  orientation = "horizontal",
  color = "gray",
  char = "─",
}: DividerProps): ReactNode => {
  if (orientation === "vertical") {
    return (
      <text style={{ fg: color }}>│</text>
    )
  }

  return (
    <box style={{ width: "100%" }}>
      <text style={{ fg: color }}>{char.repeat(80)}</text>
    </box>
  )
}

// Convenience aliases
export const Separator = Divider
export const HR = (props: Omit<DividerProps, "orientation">): ReactNode => (
  <Divider orientation="horizontal" {...props} />
)
