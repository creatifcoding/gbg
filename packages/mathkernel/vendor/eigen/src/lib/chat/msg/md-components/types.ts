/**
 * Shared types for TMNL markdown components.
 *
 * Every component receives Streamdown's `node` (AST position) and `className`
 * via ExtraProps. Position-based memoization prevents re-renders when content
 * hasn't structurally changed.
 *
 * @module chat/msg/md-components/types
 */

/** Streamdown AST node with position info */
export interface MarkdownNode {
  position?: {
    start: { line: number; column: number }
    end: { line: number; column: number }
  }
  tagName?: string
}

/** Extra props Streamdown passes to all custom components */
export type WithNode<T> = T & {
  node?: MarkdownNode
  children?: React.ReactNode
  className?: string
}

/**
 * Position-based equality check for React.memo comparators.
 * Matches Streamdown's internal `sameNodePosition` pattern.
 */
export function sameNodePosition(prev?: MarkdownNode, next?: MarkdownNode): boolean {
  if (!(prev?.position || next?.position)) return true
  if (!(prev?.position && next?.position)) return false

  const ps = prev.position.start
  const ns = next.position.start
  const pe = prev.position.end
  const ne = next.position.end

  return (
    ps.line === ns.line &&
    ps.column === ns.column &&
    pe.line === ne.line &&
    pe.column === ne.column
  )
}

/** Standard memo comparator: className + node position */
export function sameClassAndNode(
  prev: { className?: string; node?: MarkdownNode },
  next: { className?: string; node?: MarkdownNode },
): boolean {
  return prev.className === next.className && sameNodePosition(prev.node, next.node)
}
