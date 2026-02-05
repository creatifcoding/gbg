/**
 * ScanlineDeclassify
 *
 * Brutalist text reveal animation with full markdown support.
 * Text initially appears as redacted blocks (▓), then a horizontal
 * scanline sweeps left-to-right revealing characters underneath.
 *
 * Markdown is parsed and rendered with brutalist styling:
 *
 * Block elements:
 * - Code blocks (```): monospace, bordered, dark background
 * - Headers (#): uppercase, bold, left border accent
 * - Lists (-, *, numbered): monospace bullets, tight spacing
 * - Blockquotes (>): italic, left border
 * - Tables (| col |): monospace, bordered cells, dark header
 * - Horizontal rules (---, ***): solid border
 *
 * Inline elements:
 * - Inline code (`): inverted colors
 * - Bold (**text** / __text__): weight 900, uppercase
 * - Italic (*text* / _text_): italic style
 * - Strikethrough (~~text~~): line-through decoration
 * - Links [text](url): underlined, external opens in new tab
 */

import * as React from 'react'
import { useEffect, useState, useMemo, memo, useCallback } from 'react'

// =============================================================================
// Types
// =============================================================================

export interface ScanlineDeclassifyProps {
  /** Text to reveal (supports markdown) */
  text: string
  /** Whether content is still streaming */
  isStreaming: boolean
  /** Characters revealed per second (default: 300 for fast brutalist reveal) */
  revealSpeed?: number
  /** Delay before starting reveal (ms) */
  initialDelay?: number
  /** Custom className */
  className?: string
  /** Custom style */
  style?: React.CSSProperties
}

interface MarkdownBlock {
  type: 'paragraph' | 'code' | 'header' | 'list' | 'blockquote' | 'table' | 'hr'
  content: string
  language?: string // for code blocks
  level?: number // for headers (1-6)
  startIndex: number // character index in original text
  endIndex: number
  rows?: string[][] // for tables
  hasHeader?: boolean // for tables
}

// =============================================================================
// Constants
// =============================================================================

const REDACTED_CHAR = '▓'
const SCANLINE_WIDTH = 4 // characters wide

// =============================================================================
// Brutalist Styles
// =============================================================================

// =============================================================================
// INVERTED LIGHT THEME STYLES
// Main text is dark on light background
// Code blocks stay dark as contrast islands
// =============================================================================
const styles = {
  container: {
    fontFamily: "'Courier New', monospace",
    fontSize: '13px',
    lineHeight: 1.6,
    color: '#000', // INVERTED: dark text on light bg
  },
  paragraph: {
    margin: '0 0 12px 0',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
  // CODE BLOCKS: Stay DARK as contrast islands
  codeBlock: {
    margin: '12px 0',
    padding: '12px',
    background: '#0d0d0d', // KEEP DARK - contrast island
    border: '2px solid #333',
    fontFamily: "'Courier New', monospace",
    fontSize: '12px',
    lineHeight: 1.5,
    overflow: 'auto' as const,
    whiteSpace: 'pre' as const,
    color: '#ccc', // Light text for dark code bg
  },
  codeLanguage: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '10px',
    color: '#888',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
  },
  header: {
    margin: '16px 0 8px 0',
    paddingLeft: '12px',
    borderLeft: '4px solid #000', // INVERTED: dark border
    fontWeight: 900,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  h1: { fontSize: '18px' },
  h2: { fontSize: '16px' },
  h3: { fontSize: '14px' },
  list: {
    margin: '8px 0',
    paddingLeft: '20px',
  },
  listItem: {
    margin: '4px 0',
    position: 'relative' as const,
  },
  blockquote: {
    margin: '12px 0',
    paddingLeft: '16px',
    borderLeft: '3px solid #999', // INVERTED: lighter border
    color: '#666', // INVERTED: darker text
    fontStyle: 'italic' as const,
  },
  inlineCode: {
    background: '#0d0d0d', // INVERTED: dark bg for inline code
    color: '#ccc', // Light text
    padding: '1px 4px',
    fontFamily: "'Courier New', monospace",
    fontSize: '12px',
  },
  // INLINE FORMATTING: Bold, Italic, Strikethrough, Links
  bold: {
    fontWeight: 900,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.02em',
  },
  italic: {
    fontStyle: 'italic' as const,
  },
  strikethrough: {
    textDecoration: 'line-through' as const,
  },
  link: {
    textDecoration: 'underline' as const,
    cursor: 'pointer' as const,
    // No color change - brutalist
  },
  // TABLE: Brutalist bordered cells
  table: {
    margin: '12px 0',
    borderCollapse: 'collapse' as const,
    fontFamily: "'Courier New', monospace",
    fontSize: '12px',
    width: '100%',
  },
  tableHeader: {
    background: '#0d0d0d',
    color: '#ccc',
    fontWeight: 900,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  tableCell: {
    border: '1px solid #333',
    padding: '6px 10px',
    textAlign: 'left' as const,
  },
  tableRow: {
    background: 'transparent',
  },
  tableRowAlt: {
    background: 'rgba(0,0,0,0.03)',
  },
  // HORIZONTAL RULE
  hr: {
    margin: '16px 0',
    border: 'none',
    borderTop: '2px solid #333',
    height: '0',
  },
  // REVEAL ANIMATION: Works on light bg
  redacted: {
    color: '#ccc', // INVERTED: light redacted char on light bg
    background: '#ddd',
  },
  scanline: {
    color: '#000', // INVERTED: dark text
    background: '#bbb', // INVERTED: gray scanline
    textShadow: '0 0 4px rgba(0,0,0,0.3)',
  },
  revealed: {
    color: 'inherit',
  },
  cursor: {
    display: 'inline-block',
    width: '8px',
    height: '14px',
    background: '#000', // INVERTED: dark cursor
    marginLeft: '2px',
    verticalAlign: 'middle',
    animation: 'blink 0.8s step-end infinite',
  },
} as const

// =============================================================================
// Keyframes (injected once)
// =============================================================================

const KEYFRAMES_ID = 'scanline-declassify-keyframes'

function ensureKeyframes() {
  if (typeof document === 'undefined') return
  if (document.getElementById(KEYFRAMES_ID)) return

  const style = document.createElement('style')
  style.id = KEYFRAMES_ID
  style.textContent = `
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
  `
  document.head.appendChild(style)
}

// =============================================================================
// Markdown Parser (simple, brutalist)
// =============================================================================

function parseMarkdown(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  let currentIndex = 0

  // Split into lines for processing
  const lines = text.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const lineStart = currentIndex

    // Horizontal rule (---, ***, ___)
    if (line.match(/^(\s*[-*_]\s*){3,}$/) && line.trim().length >= 3) {
      blocks.push({
        type: 'hr',
        content: '',
        startIndex: lineStart,
        endIndex: lineStart + line.length + 1,
      })
      currentIndex += line.length + 1
      i++
      continue
    }

    // Table (| col | col |)
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableLines: string[] = [line]
      currentIndex += line.length + 1
      i++

      // Collect all table rows
      while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i])
        currentIndex += lines[i].length + 1
        i++
      }

      // Parse table rows
      const rows: string[][] = []
      let hasHeader = false

      for (let rowIdx = 0; rowIdx < tableLines.length; rowIdx++) {
        const rowLine = tableLines[rowIdx]
        // Check if this is a separator row (|---|---|)
        if (rowLine.match(/^\|[\s-:|]+\|$/)) {
          hasHeader = rowIdx === 1 // Header exists if separator is second row
          continue
        }
        // Parse cells
        const cells = rowLine
          .split('|')
          .slice(1, -1) // Remove first and last empty elements
          .map(cell => cell.trim())
        if (cells.length > 0) {
          rows.push(cells)
        }
      }

      if (rows.length > 0) {
        blocks.push({
          type: 'table',
          content: tableLines.join('\n'),
          startIndex: lineStart,
          endIndex: currentIndex,
          rows,
          hasHeader,
        })
      }
      continue
    }

    // Code block (```)
    if (line.startsWith('```')) {
      const language = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      currentIndex += line.length + 1

      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        currentIndex += lines[i].length + 1
        i++
      }

      if (i < lines.length) {
        currentIndex += lines[i].length + 1
        i++
      }

      blocks.push({
        type: 'code',
        content: codeLines.join('\n'),
        language: language || undefined,
        startIndex: lineStart,
        endIndex: currentIndex,
      })
      continue
    }

    // Headers (#, ##, ###)
    const headerMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headerMatch) {
      blocks.push({
        type: 'header',
        content: headerMatch[2],
        level: headerMatch[1].length,
        startIndex: lineStart,
        endIndex: lineStart + line.length + 1,
      })
      currentIndex += line.length + 1
      i++
      continue
    }

    // List items (-, *, or numbered)
    if (line.match(/^[\s]*[-*]\s+/) || line.match(/^[\s]*\d+\.\s+/)) {
      const listLines: string[] = [line]
      currentIndex += line.length + 1
      i++

      while (i < lines.length &&
             (lines[i].match(/^[\s]*[-*]\s+/) ||
              lines[i].match(/^[\s]*\d+\.\s+/) ||
              (lines[i].startsWith('  ') && lines[i].trim()))) {
        listLines.push(lines[i])
        currentIndex += lines[i].length + 1
        i++
      }

      blocks.push({
        type: 'list',
        content: listLines.join('\n'),
        startIndex: lineStart,
        endIndex: currentIndex,
      })
      continue
    }

    // Blockquote (>)
    if (line.startsWith('>')) {
      const quoteLines: string[] = [line.slice(1).trim()]
      currentIndex += line.length + 1
      i++

      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].slice(1).trim())
        currentIndex += lines[i].length + 1
        i++
      }

      blocks.push({
        type: 'blockquote',
        content: quoteLines.join('\n'),
        startIndex: lineStart,
        endIndex: currentIndex,
      })
      continue
    }

    // Regular paragraph (collect until empty line or special block)
    const paraLines: string[] = []
    while (i < lines.length &&
           lines[i].trim() !== '' &&
           !lines[i].startsWith('```') &&
           !lines[i].match(/^#{1,6}\s+/) &&
           !lines[i].match(/^[\s]*[-*]\s+/) &&
           !lines[i].match(/^[\s]*\d+\.\s+/) &&
           !lines[i].startsWith('>')) {
      paraLines.push(lines[i])
      currentIndex += lines[i].length + 1
      i++
    }

    if (paraLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        content: paraLines.join('\n'),
        startIndex: lineStart,
        endIndex: currentIndex,
      })
    }

    // Skip empty lines
    while (i < lines.length && lines[i].trim() === '') {
      currentIndex += lines[i].length + 1
      i++
    }
  }

  return blocks
}

// =============================================================================
// Inline Markdown (bold, italic, code, links, strikethrough)
// =============================================================================

interface InlineToken {
  type: 'text' | 'code' | 'bold' | 'italic' | 'strikethrough' | 'link'
  content: string
  url?: string // for links
  rawLength: number // length including markdown syntax
}

function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let remaining = text

  while (remaining.length > 0) {
    let matched = false

    // Inline code (`code`)
    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      tokens.push({
        type: 'code',
        content: codeMatch[1],
        rawLength: codeMatch[0].length,
      })
      remaining = remaining.slice(codeMatch[0].length)
      matched = true
      continue
    }

    // Strikethrough (~~text~~)
    const strikeMatch = remaining.match(/^~~([^~]+)~~/)
    if (strikeMatch) {
      tokens.push({
        type: 'strikethrough',
        content: strikeMatch[1],
        rawLength: strikeMatch[0].length,
      })
      remaining = remaining.slice(strikeMatch[0].length)
      matched = true
      continue
    }

    // Bold (**text** or __text__)
    const boldMatch = remaining.match(/^(\*\*|__)([^*_]+)\1/)
    if (boldMatch) {
      tokens.push({
        type: 'bold',
        content: boldMatch[2],
        rawLength: boldMatch[0].length,
      })
      remaining = remaining.slice(boldMatch[0].length)
      matched = true
      continue
    }

    // Italic (*text* or _text_) - must not be inside a word for underscore
    const italicMatch = remaining.match(/^(\*|_)([^*_]+)\1/)
    if (italicMatch) {
      tokens.push({
        type: 'italic',
        content: italicMatch[2],
        rawLength: italicMatch[0].length,
      })
      remaining = remaining.slice(italicMatch[0].length)
      matched = true
      continue
    }

    // Link [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch) {
      tokens.push({
        type: 'link',
        content: linkMatch[1],
        url: linkMatch[2],
        rawLength: linkMatch[0].length,
      })
      remaining = remaining.slice(linkMatch[0].length)
      matched = true
      continue
    }

    // Plain text - consume until next potential markdown
    if (!matched) {
      // Find next potential markdown start
      const nextSpecial = remaining.slice(1).search(/[`*_~\[]/)
      const textEnd = nextSpecial === -1 ? remaining.length : nextSpecial + 1

      tokens.push({
        type: 'text',
        content: remaining.slice(0, textEnd),
        rawLength: textEnd,
      })
      remaining = remaining.slice(textEnd)
    }
  }

  return tokens
}

function renderInlineMarkdown(
  text: string,
  revealedCount: number,
  blockStartIndex: number
): React.ReactNode[] {
  const elements: React.ReactNode[] = []
  const tokens = tokenizeInline(text)
  let key = 0
  let charIndex = blockStartIndex

  for (const token of tokens) {
    switch (token.type) {
      case 'code':
        elements.push(
          <span key={key++} style={styles.inlineCode}>
            {renderChars(token.content, revealedCount, charIndex)}
          </span>
        )
        break

      case 'bold':
        elements.push(
          <span key={key++} style={styles.bold}>
            {renderChars(token.content, revealedCount, charIndex)}
          </span>
        )
        break

      case 'italic':
        elements.push(
          <span key={key++} style={styles.italic}>
            {renderChars(token.content, revealedCount, charIndex)}
          </span>
        )
        break

      case 'strikethrough':
        elements.push(
          <span key={key++} style={styles.strikethrough}>
            {renderChars(token.content, revealedCount, charIndex)}
          </span>
        )
        break

      case 'link':
        {
          const isExternal = token.url?.startsWith('http')
          elements.push(
            <a
              key={key++}
              href={token.url}
              style={styles.link}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noopener noreferrer' : undefined}
            >
              {renderChars(token.content, revealedCount, charIndex)}
            </a>
          )
        }
        break

      default: // 'text'
        elements.push(
          <React.Fragment key={key++}>
            {renderChars(token.content, revealedCount, charIndex)}
          </React.Fragment>
        )
    }

    charIndex += token.rawLength
  }

  return elements
}

function renderChars(
  text: string,
  revealedCount: number,
  startIndex: number
): React.ReactNode[] {
  return text.split('').map((char, i) => {
    const globalIndex = startIndex + i

    if (char === '\n') {
      return <br key={i} />
    }

    let state: 'redacted' | 'scanline' | 'revealed'
    if (globalIndex < revealedCount - SCANLINE_WIDTH) {
      state = 'revealed'
    } else if (globalIndex < revealedCount) {
      state = 'scanline'
    } else {
      state = 'redacted'
    }

    const style = state === 'redacted'
      ? styles.redacted
      : state === 'scanline'
      ? styles.scanline
      : styles.revealed

    const displayChar = state === 'redacted' ? REDACTED_CHAR : char

    return <span key={i} style={style}>{displayChar}</span>
  })
}

// =============================================================================
// Block Renderers
// =============================================================================

interface BlockRendererProps {
  block: MarkdownBlock
  revealedCount: number
}

const ParagraphBlock = memo(function ParagraphBlock({ block, revealedCount }: BlockRendererProps) {
  return (
    <p style={styles.paragraph}>
      {renderInlineMarkdown(block.content, revealedCount, block.startIndex)}
    </p>
  )
})

const CodeBlock = memo(function CodeBlock({ block, revealedCount }: BlockRendererProps) {
  return (
    <div style={styles.codeBlock}>
      {block.language && (
        <span style={styles.codeLanguage}>{block.language}</span>
      )}
      {renderChars(block.content, revealedCount, block.startIndex)}
    </div>
  )
})

const HeaderBlock = memo(function HeaderBlock({ block, revealedCount }: BlockRendererProps) {
  const sizeStyle = block.level === 1 ? styles.h1
    : block.level === 2 ? styles.h2
    : styles.h3

  return (
    <div style={{ ...styles.header, ...sizeStyle }}>
      {renderChars(block.content, revealedCount, block.startIndex)}
    </div>
  )
})

const ListBlock = memo(function ListBlock({ block, revealedCount }: BlockRendererProps) {
  const items = block.content.split('\n')
  let charIndex = block.startIndex

  return (
    <div style={styles.list}>
      {items.map((item, i) => {
        const cleaned = item.replace(/^[\s]*[-*]\s+/, '').replace(/^[\s]*\d+\.\s+/, '')
        const startIdx = charIndex
        charIndex += item.length + 1

        return (
          <div key={i} style={styles.listItem}>
            <span style={{ color: '#999' }}>▸ </span>
            {renderChars(cleaned, revealedCount, startIdx + (item.length - cleaned.length))}
          </div>
        )
      })}
    </div>
  )
})

const BlockquoteBlock = memo(function BlockquoteBlock({ block, revealedCount }: BlockRendererProps) {
  return (
    <div style={styles.blockquote}>
      {renderChars(block.content, revealedCount, block.startIndex)}
    </div>
  )
})

const TableBlock = memo(function TableBlock({ block, revealedCount }: BlockRendererProps) {
  const { rows, hasHeader } = block
  if (!rows || rows.length === 0) return null

  let charIndex = block.startIndex

  return (
    <table style={styles.table}>
      {hasHeader && rows.length > 0 && (
        <thead>
          <tr>
            {rows[0].map((cell, cellIdx) => {
              const cellStart = charIndex
              charIndex += cell.length + 1 // +1 for separator
              return (
                <th
                  key={cellIdx}
                  style={{ ...styles.tableCell, ...styles.tableHeader }}
                >
                  {renderInlineMarkdown(cell, revealedCount, cellStart)}
                </th>
              )
            })}
          </tr>
        </thead>
      )}
      <tbody>
        {(hasHeader ? rows.slice(1) : rows).map((row, rowIdx) => (
          <tr
            key={rowIdx}
            style={rowIdx % 2 === 1 ? styles.tableRowAlt : styles.tableRow}
          >
            {row.map((cell, cellIdx) => {
              const cellStart = charIndex
              charIndex += cell.length + 1
              return (
                <td key={cellIdx} style={styles.tableCell}>
                  {renderInlineMarkdown(cell, revealedCount, cellStart)}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
})

const HorizontalRuleBlock = memo(function HorizontalRuleBlock({ block, revealedCount }: BlockRendererProps) {
  // Animate the rule appearance based on reveal
  const isRevealed = revealedCount >= block.startIndex
  return (
    <hr
      style={{
        ...styles.hr,
        opacity: isRevealed ? 1 : 0.2,
        transition: 'opacity 0.3s ease',
      }}
    />
  )
})

// =============================================================================
// Main Component
// =============================================================================

function ScanlineDeclassifyComponent({
  text,
  isStreaming,
  revealSpeed = 300, // chars per second - fast brutalist reveal
  initialDelay = 100,
  className,
  style,
}: ScanlineDeclassifyProps) {
  const [revealedCount, setRevealedCount] = useState(0)
  const [started, setStarted] = useState(false)

  // Inject keyframes on mount
  useEffect(() => {
    ensureKeyframes()
  }, [])

  // Parse markdown
  const blocks = useMemo(() => parseMarkdown(text), [text])

  // Total character count
  const totalChars = useMemo(() => {
    return blocks.reduce((sum, block) => sum + block.content.length, 0)
  }, [blocks])

  // Start delay
  useEffect(() => {
    if (text.length === 0) return

    const timer = setTimeout(() => {
      setStarted(true)
    }, initialDelay)

    return () => clearTimeout(timer)
  }, [initialDelay, text.length])

  // Reveal animation - during streaming, show content immediately; otherwise animate
  useEffect(() => {
    if (!started) return

    // During streaming, always show all content immediately (no delay)
    if (isStreaming) {
      setRevealedCount(text.length)
      return
    }

    // Not streaming - use reveal animation for completed messages
    if (revealedCount >= text.length) return

    const interval = 1000 / revealSpeed
    const timer = setInterval(() => {
      setRevealedCount((prev) => {
        const target = text.length
        if (prev >= target) {
          clearInterval(timer)
          return prev
        }
        // Reveal multiple chars per tick for speed
        return Math.min(prev + 3, target)
      })
    }, interval)

    return () => clearInterval(timer)
  }, [started, text.length, revealSpeed, isStreaming, revealedCount])

  // Reset when text changes significantly (new message)
  const textRef = React.useRef(text)
  useEffect(() => {
    if (text.length < textRef.current.length - 10) {
      setRevealedCount(0)
      setStarted(false)
    }
    textRef.current = text
  }, [text])

  // Show cursor while streaming
  const showCursor = isStreaming && revealedCount >= text.length

  return (
    <div className={className} style={{ ...styles.container, ...style }}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'code':
            return <CodeBlock key={i} block={block} revealedCount={revealedCount} />
          case 'header':
            return <HeaderBlock key={i} block={block} revealedCount={revealedCount} />
          case 'list':
            return <ListBlock key={i} block={block} revealedCount={revealedCount} />
          case 'blockquote':
            return <BlockquoteBlock key={i} block={block} revealedCount={revealedCount} />
          case 'table':
            return <TableBlock key={i} block={block} revealedCount={revealedCount} />
          case 'hr':
            return <HorizontalRuleBlock key={i} block={block} revealedCount={revealedCount} />
          default:
            return <ParagraphBlock key={i} block={block} revealedCount={revealedCount} />
        }
      })}
      {showCursor && <span style={styles.cursor} />}
    </div>
  )
}

export const ScanlineDeclassify = memo(ScanlineDeclassifyComponent)
export default ScanlineDeclassify
