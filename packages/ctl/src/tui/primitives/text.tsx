/** @jsxImportSource @opentui/react */
/**
 * Text Primitive
 *
 * Styled wrapper around OpenTUI's `<text>` component.
 */
import type { ReactNode } from "react"

// =============================================================================
// TYPES
// =============================================================================

export type TextVariant = "default" | "heading" | "muted" | "success" | "warning" | "error"

export interface TextProps {
  variant?: TextVariant
  color?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  children?: ReactNode
}

// =============================================================================
// COLORS
// =============================================================================

const variantColors: Record<TextVariant, string> = {
  default: "white",
  heading: "cyan",
  muted: "gray",
  success: "green",
  warning: "yellow",
  error: "red",
}

// =============================================================================
// COMPONENT
// =============================================================================

export const Text = ({
  variant = "default",
  color,
  bold,
  italic,
  underline,
  children,
}: TextProps): ReactNode => {
  const fg = color ?? variantColors[variant]

  let content: ReactNode = children
  if (bold) content = <b>{content}</b>
  if (italic) content = <i>{content}</i>
  if (underline) content = <u>{content}</u>

  return <text style={{ fg }}>{content}</text>
}

// Convenience components
export const Heading = (props: Omit<TextProps, "variant">): ReactNode => <Text variant="heading" bold {...props} />
export const Muted = (props: Omit<TextProps, "variant">): ReactNode => <Text variant="muted" {...props} />
export const Success = (props: Omit<TextProps, "variant">): ReactNode => <Text variant="success" {...props} />
export const Warning = (props: Omit<TextProps, "variant">): ReactNode => <Text variant="warning" {...props} />
export const ErrorText = (props: Omit<TextProps, "variant">): ReactNode => <Text variant="error" {...props} />
