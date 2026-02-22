/**
 * MermaidBlock — Beautiful mermaid diagram rendering for chat messages.
 *
 * Compound component barrel. Uses beautiful-mermaid for pure-TS SVG rendering
 * with TMNL theme mapping via CSS custom properties.
 *
 * @module chat/msg/mermaid-block
 */

import { MermaidBlockRoot, type MermaidBlockProps } from './mermaid-block-root'

// Compound namespace
const MermaidBlock = MermaidBlockRoot as typeof MermaidBlockRoot & {
  Root: typeof MermaidBlockRoot
}
MermaidBlock.Root = MermaidBlockRoot

export { MermaidBlock as ChatMermaidBlock }
export type { MermaidBlockProps as ChatMermaidBlockProps }

// Re-export theme utilities
export {
  TMNL_DIAGRAM_THEME,
  TMNL_MERMAID_COLORS,
  TMNL_HYBRID_COLORS,
  ONE_DARK_PRO_MERMAID_COLORS,
  TMNL_MERMAID_TRANSPARENT,
} from './tmnl-mermaid-theme'
