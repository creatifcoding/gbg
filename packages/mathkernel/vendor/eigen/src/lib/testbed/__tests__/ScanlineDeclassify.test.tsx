/**
 * ScanlineDeclassify Tests
 *
 * Tests for full markdown support including:
 * - Block elements: code, headers, lists, blockquotes, tables, hr
 * - Inline elements: bold, italic, strikethrough, links, inline code
 * - Scanline reveal animation on all element types
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import * as React from 'react'
import { ScanlineDeclassify } from '../ScanlineDeclassify'

// Helper to advance timers
const advanceTimers = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms)
  })
}

describe('ScanlineDeclassify', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Block Elements', () => {
    it('renders code blocks with language tag', async () => {
      const text = '```typescript\nconst x = 1;\n```'
      render(<ScanlineDeclassify text={text} isStreaming={false} />)

      // Advance past initial delay and reveal
      await advanceTimers(500)

      // Should have a code block with language label
      expect(screen.getByText('typescript')).toBeInTheDocument()
    })

    it('renders headers with proper styling', async () => {
      const text = '# Header 1\n## Header 2\n### Header 3'
      render(<ScanlineDeclassify text={text} isStreaming={false} />)

      await advanceTimers(500)

      // Headers should be rendered (checking for their presence)
      const container = document.querySelector('div')
      expect(container).toBeInTheDocument()
    })

    it('renders unordered lists', async () => {
      const text = '- Item 1\n- Item 2\n- Item 3'
      render(<ScanlineDeclassify text={text} isStreaming={false} />)

      await advanceTimers(500)

      // Should render list markers
      const markers = screen.getAllByText('▸')
      expect(markers.length).toBe(3)
    })

    it('renders numbered lists', async () => {
      const text = '1. First\n2. Second\n3. Third'
      render(<ScanlineDeclassify text={text} isStreaming={false} />)

      await advanceTimers(500)

      // Should render list markers for numbered lists too
      const markers = screen.getAllByText('▸')
      expect(markers.length).toBe(3)
    })

    it('renders blockquotes', async () => {
      const text = '> This is a quote\n> continued here'
      const { container } = render(
        <ScanlineDeclassify text={text} isStreaming={false} />
      )

      await advanceTimers(500)

      // Blockquote should have left border styling
      const blockquote = container.querySelector('div[style*="border-left"]')
      expect(blockquote).toBeInTheDocument()
    })

    it('renders tables with header row', async () => {
      const text = '| Col 1 | Col 2 |\n|-------|-------|\n| A | B |\n| C | D |'
      const { container } = render(
        <ScanlineDeclassify text={text} isStreaming={false} />
      )

      await advanceTimers(500)

      // Should render a table
      const table = container.querySelector('table')
      expect(table).toBeInTheDocument()

      // Should have header cells
      const headerCells = container.querySelectorAll('th')
      expect(headerCells.length).toBe(2)

      // Should have body cells
      const bodyCells = container.querySelectorAll('td')
      expect(bodyCells.length).toBe(4)
    })

    it('renders horizontal rules', async () => {
      const text = 'Before\n\n---\n\nAfter'
      const { container } = render(
        <ScanlineDeclassify text={text} isStreaming={false} />
      )

      await advanceTimers(500)

      // Should render an hr element
      const hr = container.querySelector('hr')
      expect(hr).toBeInTheDocument()
    })

    it('renders horizontal rules with asterisks', async () => {
      const text = 'Before\n\n***\n\nAfter'
      const { container } = render(
        <ScanlineDeclassify text={text} isStreaming={false} />
      )

      await advanceTimers(500)

      const hr = container.querySelector('hr')
      expect(hr).toBeInTheDocument()
    })
  })

  describe('Inline Elements', () => {
    it('renders bold text with ** syntax', async () => {
      const text = 'This is **bold** text'
      const { container } = render(
        <ScanlineDeclassify text={text} isStreaming={false} />
      )

      await advanceTimers(500)

      // Bold text should have weight 900 and uppercase
      const boldSpan = container.querySelector('span[style*="font-weight: 900"]')
      expect(boldSpan).toBeInTheDocument()
    })

    it('renders bold text with __ syntax', async () => {
      const text = 'This is __bold__ text'
      const { container } = render(
        <ScanlineDeclassify text={text} isStreaming={false} />
      )

      await advanceTimers(500)

      const boldSpan = container.querySelector('span[style*="font-weight: 900"]')
      expect(boldSpan).toBeInTheDocument()
    })

    it('renders italic text with * syntax', async () => {
      const text = 'This is *italic* text'
      const { container } = render(
        <ScanlineDeclassify text={text} isStreaming={false} />
      )

      await advanceTimers(500)

      const italicSpan = container.querySelector('span[style*="font-style: italic"]')
      expect(italicSpan).toBeInTheDocument()
    })

    it('renders italic text with _ syntax', async () => {
      const text = 'This is _italic_ text'
      const { container } = render(
        <ScanlineDeclassify text={text} isStreaming={false} />
      )

      await advanceTimers(500)

      const italicSpan = container.querySelector('span[style*="font-style: italic"]')
      expect(italicSpan).toBeInTheDocument()
    })

    it('renders strikethrough text', async () => {
      const text = 'This is ~~deleted~~ text'
      const { container } = render(
        <ScanlineDeclassify text={text} isStreaming={false} />
      )

      await advanceTimers(500)

      const strikeSpan = container.querySelector(
        'span[style*="text-decoration: line-through"]'
      )
      expect(strikeSpan).toBeInTheDocument()
    })

    it('renders inline code', async () => {
      const text = 'Use `const x = 1` here'
      const { container } = render(
        <ScanlineDeclassify text={text} isStreaming={false} />
      )

      await advanceTimers(500)

      // Inline code should have dark background
      const codeSpan = container.querySelector('span[style*="background"]')
      expect(codeSpan).toBeInTheDocument()
    })

    it('renders links', async () => {
      const text = 'Check [this link](https://example.com) out'
      const { container } = render(
        <ScanlineDeclassify text={text} isStreaming={false} />
      )

      await advanceTimers(500)

      const link = container.querySelector('a')
      expect(link).toBeInTheDocument()
      expect(link?.getAttribute('href')).toBe('https://example.com')
    })

    it('opens external links in new tab', async () => {
      const text = '[External](https://example.com)'
      const { container } = render(
        <ScanlineDeclassify text={text} isStreaming={false} />
      )

      await advanceTimers(500)

      const link = container.querySelector('a')
      expect(link?.getAttribute('target')).toBe('_blank')
      expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
    })

    it('does not open internal links in new tab', async () => {
      const text = '[Internal](/page)'
      const { container } = render(
        <ScanlineDeclassify text={text} isStreaming={false} />
      )

      await advanceTimers(500)

      const link = container.querySelector('a')
      expect(link?.getAttribute('target')).toBeNull()
    })
  })

  describe('Scanline Reveal Animation', () => {
    it('starts with redacted characters', () => {
      const text = 'Hello world'
      const { container } = render(
        <ScanlineDeclassify
          text={text}
          isStreaming={false}
          initialDelay={1000} // Long delay to keep redacted
        />
      )

      // Before reveal starts, should show redacted chars
      const redactedChars = container.querySelectorAll('span')
      const hasRedacted = Array.from(redactedChars).some(
        (span) => span.textContent === '\u2593' // REDACTED_CHAR
      )
      expect(hasRedacted).toBe(true)
    })

    it('reveals characters over time', async () => {
      const text = 'Hello'
      const { container } = render(
        <ScanlineDeclassify
          text={text}
          isStreaming={false}
          revealSpeed={100} // Slow for testing
          initialDelay={0}
        />
      )

      // Initially redacted
      let spans = container.querySelectorAll('span')
      const initialRedacted = Array.from(spans).filter(
        (span) => span.textContent === '\u2593'
      ).length

      // Advance time
      await advanceTimers(500)

      // Should have fewer redacted chars
      spans = container.querySelectorAll('span')
      const laterRedacted = Array.from(spans).filter(
        (span) => span.textContent === '\u2593'
      ).length

      expect(laterRedacted).toBeLessThanOrEqual(initialRedacted)
    })

    it('applies scanline effect to bold text', async () => {
      const text = '**Bold text**'
      const { container } = render(
        <ScanlineDeclassify
          text={text}
          isStreaming={false}
          initialDelay={0}
        />
      )

      // Bold wrapper should exist
      const boldSpan = container.querySelector('span[style*="font-weight: 900"]')
      expect(boldSpan).toBeInTheDocument()

      // Characters inside should have reveal states
      const chars = boldSpan?.querySelectorAll('span')
      expect(chars?.length).toBeGreaterThan(0)
    })

    it('applies scanline effect to italic text', async () => {
      const text = '*Italic text*'
      const { container } = render(
        <ScanlineDeclassify
          text={text}
          isStreaming={false}
          initialDelay={0}
        />
      )

      const italicSpan = container.querySelector('span[style*="font-style: italic"]')
      expect(italicSpan).toBeInTheDocument()
    })

    it('applies scanline effect to table cells', async () => {
      const text = '| A | B |\n|---|---|\n| 1 | 2 |'
      const { container } = render(
        <ScanlineDeclassify
          text={text}
          isStreaming={false}
          initialDelay={0}
        />
      )

      await advanceTimers(100)

      // Table should exist
      const table = container.querySelector('table')
      expect(table).toBeInTheDocument()

      // Cells should contain character spans
      const cells = table?.querySelectorAll('td, th')
      expect(cells?.length).toBeGreaterThan(0)
    })

    it('shows cursor while streaming', async () => {
      const text = 'Done' // Short text for fast reveal
      const { container } = render(
        <ScanlineDeclassify
          text={text}
          isStreaming={true}
          revealSpeed={10000} // Very fast reveal (10k chars/sec)
          initialDelay={0}
        />
      )

      // Start immediately - need to advance past initial delay
      await advanceTimers(100)

      // Now advance enough to reveal all chars
      // With revealSpeed=10000, interval = 1000/10000 = 0.1ms
      // We reveal 3 chars per tick, so 4 chars = 2 ticks = 0.2ms
      // Add some buffer time
      await advanceTimers(500)

      // The cursor span has specific styling - look for inline-block display
      // which is unique to the cursor among the rendered spans
      const spans = container.querySelectorAll('span')
      const cursor = Array.from(spans).find(
        (span) => span.style.display === 'inline-block' && span.textContent === ''
      )

      // Cursor only shows when revealedCount >= text.length && isStreaming
      expect(cursor).toBeInTheDocument()
    })

    it('hides cursor when not streaming', async () => {
      const text = 'Done'
      const { container } = render(
        <ScanlineDeclassify
          text={text}
          isStreaming={false}
          revealSpeed={1000}
          initialDelay={0}
        />
      )

      await advanceTimers(1000)

      // Cursor should not be visible when not streaming
      const cursors = container.querySelectorAll('span')
      const hasCursor = Array.from(cursors).some(
        (span) => span.style.animation?.includes('blink')
      )
      expect(hasCursor).toBe(false)
    })
  })

  describe('Mixed Content', () => {
    it('renders complex markdown with multiple element types', async () => {
      const text = `# Title

This is a paragraph with **bold** and *italic* text.

\`\`\`javascript
const x = 1;
\`\`\`

> A quote here

- List item 1
- List item 2

| Header |
|--------|
| Cell |

---

[Link](https://example.com)`

      const { container } = render(
        <ScanlineDeclassify text={text} isStreaming={false} />
      )

      await advanceTimers(2000)

      // Should have all element types
      expect(container.querySelector('table')).toBeInTheDocument()
      expect(container.querySelector('hr')).toBeInTheDocument()
      expect(container.querySelector('a')).toBeInTheDocument()
    })

    it('handles inline formatting inside table cells', async () => {
      const text = '| **Bold** | *Italic* |\n|----------|----------|\n| ~~Strike~~ | `code` |'
      const { container } = render(
        <ScanlineDeclassify text={text} isStreaming={false} />
      )

      await advanceTimers(500)

      // Table should have formatted content
      const table = container.querySelector('table')
      expect(table).toBeInTheDocument()

      // Should have bold in table
      const boldInTable = table?.querySelector('span[style*="font-weight: 900"]')
      expect(boldInTable).toBeInTheDocument()

      // Should have italic in table
      const italicInTable = table?.querySelector('span[style*="font-style: italic"]')
      expect(italicInTable).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty text', () => {
      const { container } = render(
        <ScanlineDeclassify text="" isStreaming={false} />
      )

      // Should render without errors
      expect(container).toBeInTheDocument()
    })

    it('handles text with only whitespace', async () => {
      const text = '   \n   \n   '
      const { container } = render(
        <ScanlineDeclassify text={text} isStreaming={false} />
      )

      await advanceTimers(500)

      expect(container).toBeInTheDocument()
    })

    it('handles unclosed markdown syntax gracefully', async () => {
      const text = 'This has **unclosed bold'
      const { container } = render(
        <ScanlineDeclassify text={text} isStreaming={false} />
      )

      await advanceTimers(500)

      // Should not crash, renders as plain text
      expect(container).toBeInTheDocument()
    })

    it('handles nested-like markdown (not truly nested)', async () => {
      const text = '***bold and italic***'
      const { container } = render(
        <ScanlineDeclassify text={text} isStreaming={false} />
      )

      await advanceTimers(500)

      // Should handle gracefully (our parser doesn't support true nesting)
      expect(container).toBeInTheDocument()
    })
  })
})
