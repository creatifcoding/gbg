/** @jsxImportSource @opentui/react */
/**
 * ASCII Font Primitive
 *
 * Large ASCII art text using OpenTUI's built-in fonts.
 */
import type { ReactNode } from "react"

// OpenTUI's available fonts
export type ASCIIFontName = "tiny" | "block" | "shade" | "slick" | "huge" | "grid" | "pallet"

export interface ASCIIFontProps {
  font?: ASCIIFontName
  text?: string
  children?: string
}

export const ASCIIFont = ({
  font = "block",
  text,
  children,
}: ASCIIFontProps): ReactNode => {
  const displayText = text ?? children ?? ""
  return (
    <ascii-font font={font} text={displayText} />
  )
}

// Convenience aliases for common font sizes
export const HugeText = ({ children, ...props }: Omit<ASCIIFontProps, "font">): ReactNode => (
  <ASCIIFont font="huge" {...props}>{children}</ASCIIFont>
)

export const BlockText = ({ children, ...props }: Omit<ASCIIFontProps, "font">): ReactNode => (
  <ASCIIFont font="block" {...props}>{children}</ASCIIFont>
)

export const TinyText = ({ children, ...props }: Omit<ASCIIFontProps, "font">): ReactNode => (
  <ASCIIFont font="tiny" {...props}>{children}</ASCIIFont>
)

export const SlickText = ({ children, ...props }: Omit<ASCIIFontProps, "font">): ReactNode => (
  <ASCIIFont font="slick" {...props}>{children}</ASCIIFont>
)
