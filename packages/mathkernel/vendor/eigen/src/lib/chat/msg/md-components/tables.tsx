/**
 * TMNL Markdown Tables — table, thead, tbody, tr, th, td.
 *
 * Design: AG-Grid–inspired aesthetic — neutral-950 background, neutral-800
 * borders, data font (Share Tech Mono), compact cells. Scrollable overflow.
 *
 * Animation gated on static mode (Vector 7) — tables appear instantly
 * during streaming, get gentle entrance when settled.
 *
 * @module chat/msg/md-components/tables
 */

import { memo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { sameClassAndNode, type WithNode } from './types'
import { useMdContext } from './md-context'
import { EASE_OUT, DURATION_ENTER_HEAVY } from './motion'

// ─── Table wrapper ──────────────────────────────────────────────────────────
// Conditional motion wrapper: animated in static mode, plain div during streaming.

type TableProps = WithNode<JSX.IntrinsicElements['table']>

export const MdTable = memo<TableProps>(
  ({ children, className, node, ...props }) => {
    const { streaming } = useMdContext()
    const reduced = useReducedMotion()

    const Wrapper = streaming ? 'div' : motion.div
    const motionProps = streaming ? {} : {
      initial: reduced ? { opacity: 0 } : { opacity: 0, y: 4 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: DURATION_ENTER_HEAVY, ease: EASE_OUT },
    }

    return (
      <Wrapper
        {...motionProps as any}
        className="overflow-x-auto my-3 rounded border border-neutral-800/60"
        data-tmnl-md="table-wrapper"
      >
        <table
          className={cn(
            'w-full border-collapse font-data',
            className,
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          {...props}
        >
          {children}
        </table>
      </Wrapper>
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
