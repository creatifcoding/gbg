/** @jsxImportSource @opentui/react */
/**
 * Box Primitive
 *
 * Styled wrapper around OpenTUI's `<box>` component.
 */
import type { ReactNode } from "react"

// =============================================================================
// TYPES
// =============================================================================

/** OpenTUI dimension type: number (pixels), percentage string, or "auto" */
export type Dimension = number | `${number}%` | "auto"

export type BoxVariant = "default" | "card" | "outline" | "muted"

export interface BoxProps {
  variant?: BoxVariant
  title?: string
  padding?: number
  border?: boolean
  borderColor?: string
  width?: Dimension
  height?: Dimension
  flexDirection?: "row" | "column"
  flexGrow?: number
  children?: ReactNode
}

// =============================================================================
// STYLES
// =============================================================================

const variantStyles: Record<BoxVariant, Partial<BoxProps>> = {
  default: {},
  card: { border: true, borderColor: "gray", padding: 1 },
  outline: { border: true, borderColor: "cyan" },
  muted: { border: true, borderColor: "#444444" },
}

// =============================================================================
// COMPONENT
// =============================================================================

export const Box = ({
  variant = "default",
  children,
  ...props
}: BoxProps): ReactNode => {
  const style = { ...variantStyles[variant], ...props }

  return (
    <box
      title={style.title}
      style={{
        border: style.border,
        borderColor: style.borderColor,
        padding: style.padding,
        width: style.width,
        height: style.height,
        flexDirection: style.flexDirection,
        flexGrow: style.flexGrow,
      }}
    >
      {children}
    </box>
  )
}

// Convenience components
export const Card = (props: Omit<BoxProps, "variant">): ReactNode => <Box variant="card" {...props} />
export const Panel = (props: Omit<BoxProps, "variant">): ReactNode => <Box variant="outline" {...props} />
export const Row = ({ children, ...props }: Omit<BoxProps, "flexDirection">): ReactNode => (
  <Box flexDirection="row" {...props}>{children}</Box>
)
export const Column = ({ children, ...props }: Omit<BoxProps, "flexDirection">): ReactNode => (
  <Box flexDirection="column" {...props}>{children}</Box>
)
export const Spacer = (): ReactNode => <box style={{ flexGrow: 1 }} />
