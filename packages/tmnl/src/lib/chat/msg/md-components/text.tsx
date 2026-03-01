/**
 * TMNL Markdown Text & Inline Elements.
 *
 * p, strong, em, a, sup, sub, section
 *
 * Animated:
 *   a (link) — whileHover subtle brightness + lift. Interactive affordance.
 *
 * @module chat/msg/md-components/text
 */

import { isValidElement, memo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { sameClassAndNode, type WithNode, type MarkdownNode } from './types'
import { useMdContext } from './md-context'
import { EASE_OUT, DURATION_MICRO } from './motion'

// ─── Paragraph ──────────────────────────────────────────────────────────────

type ParagraphProps = WithNode<JSX.IntrinsicElements['p']>

export const MdParagraph = memo<ParagraphProps>(
  ({ children, className, node, ...props }) => {
    // Unwrap image-only paragraphs to avoid <div> inside <p> hydration errors
    const childArray = Array.isArray(children) ? children : [children]
    const validChildren = childArray.filter(
      (child) => child !== null && child !== undefined && child !== '',
    )

    if (
      validChildren.length === 1 &&
      isValidElement(validChildren[0]) &&
      (validChildren[0].props as { node?: MarkdownNode }).node?.tagName === 'img'
    ) {
      return <>{children}</>
    }

    return (
      <p
        className={cn('mb-2 last:mb-0 leading-relaxed break-words', className)}
        data-tmnl-md="paragraph"
        {...props}
      >
        {children}
      </p>
    )
  },
  sameClassAndNode,
)
MdParagraph.displayName = 'TmnlMd.P'

// ─── Strong ─────────────────────────────────────────────────────────────────

type StrongProps = WithNode<JSX.IntrinsicElements['span']>

export const MdStrong = memo<StrongProps>(
  ({ children, className, node, ...props }) => (
    <strong
      className={cn('font-semibold text-neutral-100', className)}
      data-tmnl-md="strong"
      {...props}
    >
      {children}
    </strong>
  ),
  sameClassAndNode,
)
MdStrong.displayName = 'TmnlMd.Strong'

// ─── Emphasis ───────────────────────────────────────────────────────────────

type EmProps = WithNode<JSX.IntrinsicElements['em']>

export const MdEm = memo<EmProps>(
  ({ children, className, node, ...props }) => (
    <em
      className={cn('italic text-neutral-300', className)}
      data-tmnl-md="emphasis"
      {...props}
    >
      {children}
    </em>
  ),
  sameClassAndNode,
)
MdEm.displayName = 'TmnlMd.Em'

// ─── Link ───────────────────────────────────────────────────────────────────
// Purpose: interactive affordance. The cyan color says "clickable" —
// the hover lift + brightness confirms it kinetically.

type LinkProps = WithNode<JSX.IntrinsicElements['a']> & { href?: string }

export const MdLink = memo<LinkProps>(
  ({ children, className, href, node, ...props }) => {
    const { streaming } = useMdContext()
    const reduced = useReducedMotion()
    const isIncomplete = href === 'streamdown:incomplete-link'

    const linkClasses = cn(
      'text-cyan-400 hover:text-cyan-300',
      'underline underline-offset-2',
      'transition-colors',
      isIncomplete && 'opacity-50 pointer-events-none',
      className,
    )

    const externalIcon = !isIncomplete && (
      <span className="inline-block ml-0.5 opacity-40 text-[0.7em]" aria-hidden>↗</span>
    )

    // During streaming: plain <a> without motion wrapper
    if (streaming) {
      return (
        <a
          href={isIncomplete ? undefined : href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClasses}
          data-tmnl-md="link"
          data-incomplete={isIncomplete || undefined}
          {...props}
        >
          {children}
          {externalIcon}
        </a>
      )
    }

    return (
      <motion.a
        href={isIncomplete ? undefined : href}
        target="_blank"
        rel="noopener noreferrer"
        whileHover={reduced
          ? { filter: 'brightness(1.2)' }
          : { y: -1, filter: 'brightness(1.15)' }
        }
        transition={{ duration: DURATION_MICRO, ease: EASE_OUT }}
        className={linkClasses}
        data-tmnl-md="link"
        data-incomplete={isIncomplete || undefined}
        {...props}
      >
        {children}
        {externalIcon}
      </motion.a>
    )
  },
  (p, n) => sameClassAndNode(p, n) && p.href === n.href,
)
MdLink.displayName = 'TmnlMd.A'

// ─── Superscript ────────────────────────────────────────────────────────────

type SupProps = WithNode<JSX.IntrinsicElements['sup']>

export const MdSup = memo<SupProps>(
  ({ children, className, node, ...props }) => (
    <sup
      className={cn('text-cyan-400/60', className)}
      style={{ fontSize: '0.75em' }}
      data-tmnl-md="superscript"
      {...props}
    >
      {children}
    </sup>
  ),
  sameClassAndNode,
)
MdSup.displayName = 'TmnlMd.Sup'

// ─── Subscript ──────────────────────────────────────────────────────────────

type SubProps = WithNode<JSX.IntrinsicElements['sub']>

export const MdSub = memo<SubProps>(
  ({ children, className, node, ...props }) => (
    <sub
      className={cn('text-neutral-400', className)}
      style={{ fontSize: '0.75em' }}
      data-tmnl-md="subscript"
      {...props}
    >
      {children}
    </sub>
  ),
  sameClassAndNode,
)
MdSub.displayName = 'TmnlMd.Sub'

// ─── Section ────────────────────────────────────────────────────────────────

type SectionProps = WithNode<JSX.IntrinsicElements['section']>

export const MdSection = memo<SectionProps>(
  ({ children, className, node, ...props }) => (
    <section
      className={cn('my-2', className)}
      data-tmnl-md="section"
      {...props}
    >
      {children}
    </section>
  ),
  sameClassAndNode,
)
MdSection.displayName = 'TmnlMd.Section'
