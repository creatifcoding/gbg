/**
 * TMNL Markdown Lists — ol, ul, li.
 *
 * Design: Custom markers via CSS, proper nesting indentation,
 * neutral-300 text with relaxed leading.
 *
 * @module chat/msg/md-components/lists
 */

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { sameClassAndNode, type WithNode } from './types'

// ─── Ordered List ───────────────────────────────────────────────────────────

type OlProps = WithNode<JSX.IntrinsicElements['ol']>

export const MdOl = memo<OlProps>(
  ({ children, className, node, ...props }) => (
    <ol
      className={cn(
        'list-decimal list-inside mb-2 space-y-0.5 text-neutral-300',
        // Nested lists get indentation
        '[li_&]:pl-5',
        className,
      )}
      data-tmnl-md="ordered-list"
      {...props}
    >
      {children}
    </ol>
  ),
  sameClassAndNode,
)
MdOl.displayName = 'TmnlMd.OL'

// ─── Unordered List ─────────────────────────────────────────────────────────

type UlProps = WithNode<JSX.IntrinsicElements['ul']>

export const MdUl = memo<UlProps>(
  ({ children, className, node, ...props }) => (
    <ul
      className={cn(
        'list-disc list-inside mb-2 space-y-0.5 text-neutral-300',
        '[li_&]:pl-5',
        className,
      )}
      data-tmnl-md="unordered-list"
      {...props}
    >
      {children}
    </ul>
  ),
  sameClassAndNode,
)
MdUl.displayName = 'TmnlMd.UL'

// ─── List Item ──────────────────────────────────────────────────────────────

type LiProps = WithNode<JSX.IntrinsicElements['li']>

export const MdLi = memo<LiProps>(
  ({ children, className, node, ...props }) => (
    <li
      className={cn(
        'leading-relaxed',
        // Inline paragraphs inside list items (GFM)
        '[&>p]:inline',
        className,
      )}
      data-tmnl-md="list-item"
      {...props}
    >
      {children}
    </li>
  ),
  (p, n) => p.className === n.className &&
    p.node?.position?.start.line === n.node?.position?.start.line &&
    p.node?.position?.end.line === n.node?.position?.end.line,
)
MdLi.displayName = 'TmnlMd.LI'
