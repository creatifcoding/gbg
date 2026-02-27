/**
 * TMNL Markdown Component System.
 *
 * Complete set of memoized, position-aware markdown renderers for Streamdown.
 * Every markdown element gets TMNL design tokens, data-tmnl-md attributes
 * for debugging, and cn-based className merging.
 *
 * Ownership model:
 *   Fenced code blocks  → parts system (appendTextDelta → ChatCodeBlock)
 *   Everything else     → these components via Streamdown
 *
 * @module chat/msg/md-components
 */

// ─── Component imports ──────────────────────────────────────────────────────

import { MdH1, MdH2, MdH3, MdH4, MdH5, MdH6 } from './headings'
import { MdParagraph, MdStrong, MdEm, MdLink, MdSup, MdSub, MdSection } from './text'
import { MdCode, MdPre } from './code'
import { MdOl, MdUl, MdLi } from './lists'
import { MdTable, MdThead, MdTbody, MdTr, MdTh, MdTd } from './tables'
import { MdBlockquote, MdHr, MdImg } from './structural'

// ─── Component map (Streamdown `components` prop) ───────────────────────────

/**
 * Complete TMNL component overrides for Streamdown.
 *
 * Stateless — no streaming/static distinction needed at the component level.
 * Streamdown handles block-level memoization; our components add
 * position-based React.memo on top.
 *
 * Usage:
 *   <Streamdown components={tmnlMdComponents} ...>
 */
export const tmnlMdComponents: Record<string, React.FC<any>> = {
  // Headings
  h1: MdH1,
  h2: MdH2,
  h3: MdH3,
  h4: MdH4,
  h5: MdH5,
  h6: MdH6,

  // Text & inline
  p: MdParagraph,
  strong: MdStrong,
  em: MdEm,
  a: MdLink,
  sup: MdSup,
  sub: MdSub,
  section: MdSection,

  // Code (inline + fenced fallback)
  code: MdCode,
  pre: MdPre,

  // Lists
  ol: MdOl,
  ul: MdUl,
  li: MdLi,

  // Tables
  table: MdTable,
  thead: MdThead,
  tbody: MdTbody,
  tr: MdTr,
  th: MdTh,
  td: MdTd,

  // Structural
  blockquote: MdBlockquote,
  hr: MdHr,
  img: MdImg,
}

// ─── Re-exports for direct use ──────────────────────────────────────────────

export { MdH1, MdH2, MdH3, MdH4, MdH5, MdH6 } from './headings'
export { MdParagraph, MdStrong, MdEm, MdLink, MdSup, MdSub, MdSection } from './text'
export { MdCode, MdPre } from './code'
export { MdOl, MdUl, MdLi } from './lists'
export { MdTable, MdThead, MdTbody, MdTr, MdTh, MdTd } from './tables'
export { MdBlockquote, MdHr, MdImg } from './structural'
export { CompactionBoundary, type CompactionBoundaryProps } from './compaction-boundary'
export { sameNodePosition, sameClassAndNode } from './types'
export type { MarkdownNode, WithNode } from './types'
