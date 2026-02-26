/**
 * TMNL Markdown Tables — table, thead, tbody, tr, th, td.
 *
 * Design: AG-Grid–inspired aesthetic — neutral-950 background, neutral-800
 * borders, monospace text, compact cells. Scrollable overflow container.
 *
 * Animated:
 *   table wrapper — fade + subtle rise. Tables are visually heavy;
 *   a gentle entrance softens the "wall of data" impact.
 *
 * @module chat/msg/md-components/tables
 */

import { memo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { sameClassAndNode, type WithNode } from './types'
import { EASE_OUT, DURATION_ENTER_HEAVY } from './motion'

// ─── Table wrapper ──────────────────────────────────────────────────────────
// Purpose: heavy visual element gets a gentle entrance. The 4px rise
// communicates "this just materialized" without being theatrical.

type TableProps = WithNode<JSX.IntrinsicElements['table']>

export const MdTable = memo<TableProps>(
  ({ children, className, node, ...props }) => {
    const reduced = useReducedMotion()

    return (
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION_ENTER_HEAVY, ease: EASE_OUT }}
        className="overflow-x-auto my-3 rounded border border-neutral-800/60"
        data-tmnl-md="table-wrapper"
      >
        <table
          className={cn(
            'w-full border-collapse font-mono',
            className,
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          {...props}
        >
          {children}
        </table>
      </motion.div>
    )
  },
  sameClassAndNode,
)
MdTable.displayName = 'TmnlMd.Table'

// ─── Table Head ─────────────────────────────────────────────────────────────

type TheadProps = WithNode<JSX.IntrinsicElements['thead']>

export const MdThead = memo<TheadProps>(
  ({ children, className, node, ...props }) => (
    <thead
      className={cn('bg-neutral-900/80', className)}
      data-tmnl-md="table-header"
      {...props}
    >
      {children}
    </thead>
  ),
  sameClassAndNode,
)
MdThead.displayName = 'TmnlMd.Thead'

// ─── Table Body ─────────────────────────────────────────────────────────────

type TbodyProps = WithNode<JSX.IntrinsicElements['tbody']>

export const MdTbody = memo<TbodyProps>(
  ({ children, className, node, ...props }) => (
    <tbody
      className={cn('divide-y divide-neutral-800/40', className)}
      data-tmnl-md="table-body"
      {...props}
    >
      {children}
    </tbody>
  ),
  sameClassAndNode,
)
MdTbody.displayName = 'TmnlMd.Tbody'

// ─── Table Row ──────────────────────────────────────────────────────────────

type TrProps = WithNode<JSX.IntrinsicElements['tr']>

export const MdTr = memo<TrProps>(
  ({ children, className, node, ...props }) => (
    <tr
      className={cn(
        'border-b border-neutral-800/40',
        'hover:bg-neutral-800/20 transition-colors duration-75',
        className,
      )}
      data-tmnl-md="table-row"
      {...props}
    >
      {children}
    </tr>
  ),
  sameClassAndNode,
)
MdTr.displayName = 'TmnlMd.Tr'

// ─── Table Header Cell ──────────────────────────────────────────────────────

type ThProps = WithNode<JSX.IntrinsicElements['th']>

export const MdTh = memo<ThProps>(
  ({ children, className, node, ...props }) => (
    <th
      className={cn(
        'px-3 py-1.5 text-left text-neutral-300 font-semibold',
        'border-b border-neutral-700/60',
        'whitespace-nowrap',
        className,
      )}
      data-tmnl-md="table-header-cell"
      {...props}
    >
      {children}
    </th>
  ),
  sameClassAndNode,
)
MdTh.displayName = 'TmnlMd.Th'

// ─── Table Data Cell ────────────────────────────────────────────────────────

type TdProps = WithNode<JSX.IntrinsicElements['td']>

export const MdTd = memo<TdProps>(
  ({ children, className, node, ...props }) => (
    <td
      className={cn(
        'px-3 py-1.5 text-neutral-400',
        className,
      )}
      data-tmnl-md="table-cell"
      {...props}
    >
      {children}
    </td>
  ),
  sameClassAndNode,
)
MdTd.displayName = 'TmnlMd.Td'
