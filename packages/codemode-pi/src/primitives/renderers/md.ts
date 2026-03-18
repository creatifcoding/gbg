/**
 * md renderer — Markdown to styled ANSI via pi's Markdown component.
 *
 * Delegates to @mariozechner/pi-tui Markdown (uses `marked` internally).
 * Themed via getMarkdownTheme() when pi's theme is initialized (live extension),
 * falls back to a plain passthrough theme (tests / headless).
 *
 * Usage pattern — bind markdown to a const, return as `text`:
 *
 * ```js
 * const report = `
 * # Health Report
 *
 * **All checks passing.** 10/10 clean.
 *
 * | skill | level |
 * |-------|-------|
 * | metaskill | 3 |
 * `
 * return { _v: 'md', text: report }
 * ```
 *
 * Supports: headings, bold/italic/strikethrough, lists, code blocks,
 * tables, blockquotes, links, horizontal rules.
 *
 * @module
 */

import { Markdown } from '@mariozechner/pi-tui'
import type { MarkdownTheme } from '@mariozechner/pi-tui'
import type { Theme } from '@mariozechner/pi-coding-agent'
import type { Md } from '../types.js'
import { register } from '../registry.js'

/**
 * Get the active pi markdown theme, or a plain fallback if theme isn't initialized.
 * This makes the renderer testable without a full pi runtime.
 */
function getMdTheme(): MarkdownTheme {
  try {
    // Dynamic import to avoid hard crash when theme not initialized
    const { getMarkdownTheme } = require('@mariozechner/pi-coding-agent')
    return getMarkdownTheme()
  } catch {
    // Fallback: passthrough theme for tests / headless environments
    const identity = (s: string) => s
    return {
      heading: identity,
      link: identity,
      linkUrl: identity,
      code: identity,
      codeBlock: identity,
      codeBlockBorder: identity,
      quote: identity,
      quoteBorder: identity,
      hr: identity,
      listBullet: identity,
      bold: identity,
      italic: identity,
      strikethrough: identity,
      underline: identity,
    }
  }
}

register<Md>('md', (prim, width, _theme) => {
  if (!prim.text || prim.text.trim().length === 0) return ['(empty markdown)']

  const mdTheme = getMdTheme()
  const md = new Markdown(prim.text.trim(), 0, 0, mdTheme)
  const lines = md.render(width)

  // Strip trailing blank lines (Markdown adds padding)
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop()
  }

  return lines
})
