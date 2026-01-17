/** @jsxImportSource @opentui/react */
/**
 * Link Primitive
 *
 * Clickable link text (terminal hyperlinks where supported).
 */
import type { ReactNode } from "react"

export interface LinkProps {
  href: string
  color?: string
  children?: ReactNode
}

export const Link = ({
  href,
  color = "cyan",
  children,
}: LinkProps): ReactNode => {
  return (
    <a href={href} style={{ fg: color }}>
      {children}
    </a>
  )
}

// Span for inline styling
export interface SpanProps {
  color?: string
  bg?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  children?: ReactNode
}

export const Span = ({
  color,
  bg,
  bold,
  italic,
  underline,
  children,
}: SpanProps): ReactNode => {
  let content: ReactNode = children
  if (bold) content = <b>{content}</b>
  if (italic) content = <i>{content}</i>
  if (underline) content = <u>{content}</u>

  return (
    <span style={{ fg: color, bg }}>
      {content}
    </span>
  )
}
