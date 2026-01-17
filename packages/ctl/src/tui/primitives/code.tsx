/** @jsxImportSource @opentui/react */
/**
 * Code Display Primitives
 *
 * Simplified code and diff display without syntax highlighting.
 * For full syntax highlighting, use OpenTUI's <code> directly with a SyntaxStyle.
 */
import type { ReactNode } from "react"
import type { Dimension } from "./box"

// =============================================================================
// CODE BLOCK (Simplified - no syntax highlighting)
// =============================================================================

export interface CodeBlockProps {
  content: string
  width?: Dimension
  height?: Dimension
  backgroundColor?: string
  textColor?: string
}

/**
 * Simple code block without syntax highlighting.
 * For syntax highlighted code, use OpenTUI's <code> element directly.
 */
export const CodeBlock = ({
  content,
  width,
  height,
  backgroundColor = "#1e1e1e",
  textColor = "#d4d4d4",
}: CodeBlockProps): ReactNode => {
  return (
    <box
      style={{
        width,
        height,
        padding: 1,
        backgroundColor,
        border: true,
        borderColor: "#333333",
      }}
    >
      <text style={{ fg: textColor }}>{content}</text>
    </box>
  )
}

// =============================================================================
// DIFF VIEW
// =============================================================================

export interface DiffViewProps {
  diff: string
  view?: "unified" | "split"
  showLineNumbers?: boolean
  width?: Dimension
  height?: Dimension
}

export const DiffView = ({
  diff,
  view = "unified",
  showLineNumbers = true,
  width,
  height,
}: DiffViewProps): ReactNode => {
  return (
    <diff
      diff={diff}
      view={view}
      showLineNumbers={showLineNumbers}
      style={{ width, height }}
    />
  )
}

// =============================================================================
// LINE NUMBER (manual implementation)
// =============================================================================

export interface LineNumberDisplayProps {
  start?: number
  count: number
  color?: string
}

export const LineNumberDisplay = ({
  start = 1,
  count,
  color = "gray",
}: LineNumberDisplayProps): ReactNode => {
  const lines = Array.from({ length: count }, (_, i) => start + i)
  const maxWidth = String(start + count - 1).length

  return (
    <box style={{ flexDirection: "column" }}>
      {lines.map((num) => (
        <text key={num} style={{ fg: color }}>
          {String(num).padStart(maxWidth, " ")}
        </text>
      ))}
    </box>
  )
}
