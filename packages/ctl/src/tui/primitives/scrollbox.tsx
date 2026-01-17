/** @jsxImportSource @opentui/react */
/**
 * ScrollBox Primitive
 *
 * Scrollable container with viewport culling.
 */
import type { ReactNode } from "react"
import type { Dimension } from "./box"

export interface ScrollBoxProps {
  width?: Dimension
  height?: Dimension
  scrollX?: boolean
  scrollY?: boolean
  focused?: boolean
  children?: ReactNode
}

export const ScrollBox = ({
  width,
  height,
  scrollX = false,
  scrollY = true,
  focused = false,
  children,
}: ScrollBoxProps): ReactNode => {
  return (
    <scrollbox
      scrollX={scrollX}
      scrollY={scrollY}
      focused={focused}
      style={{ width, height }}
    >
      {children}
    </scrollbox>
  )
}
