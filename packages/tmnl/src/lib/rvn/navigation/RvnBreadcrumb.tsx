/**
 * RvnBreadcrumb
 *
 * Breadcrumb navigation with slash separators.
 * Monospace, uppercase, muted styling.
 *
 * Patterns extracted from:
 * - react-app(24).js: "Deployments / Global Fleet / Overview"
 * - react-app(31).js: "Intel / Briefings / Sector 09"
 *
 * @example
 * ```tsx
 * <RvnBreadcrumb>
 *   <RvnBreadcrumb.Item>Deployments</RvnBreadcrumb.Item>
 *   <RvnBreadcrumb.Item>Global Fleet</RvnBreadcrumb.Item>
 *   <RvnBreadcrumb.Item current>Overview</RvnBreadcrumb.Item>
 * </RvnBreadcrumb>
 *
 * // Or with simple string
 * <RvnBreadcrumb path="Deployments / Global Fleet / Overview" />
 * ```
 */

import * as React from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface RvnBreadcrumbProps {
  children?: React.ReactNode
  /** Simple path string with slashes as separators */
  path?: string
  /** Separator character (default: " / ") */
  separator?: string
  /** Additional class name */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

interface RvnBreadcrumbItemProps {
  children: React.ReactNode
  /** Whether this is the current page */
  current?: boolean
  /** Link href */
  href?: string
  /** Click handler */
  onClick?: (event: React.MouseEvent) => void
  /** Additional class name */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const breadcrumbStyles: React.CSSProperties = {
  fontFamily: 'var(--rvn-font-mono)',
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  color: 'var(--rvn-text-main, #000000)',
  opacity: 0.5,
  display: 'flex',
  alignItems: 'center',
  gap: '0',
}

const separatorStyles: React.CSSProperties = {
  margin: '0 4px',
  color: 'inherit',
}

const itemBaseStyles: React.CSSProperties = {
  color: 'inherit',
  textDecoration: 'none',
  transition: 'opacity 0.2s',
}

const itemLinkStyles: React.CSSProperties = {
  ...itemBaseStyles,
  cursor: 'pointer',
}

const itemCurrentStyles: React.CSSProperties = {
  ...itemBaseStyles,
  opacity: 1,
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

const RvnBreadcrumbItem = React.forwardRef<
  HTMLSpanElement,
  RvnBreadcrumbItemProps
>(({ children, current = false, href, onClick, className, style }, ref) => {
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault()
      onClick(e)
    }
  }

  const combinedStyles: React.CSSProperties = {
    ...(href || onClick ? itemLinkStyles : itemBaseStyles),
    ...(current ? itemCurrentStyles : {}),
    ...style,
  }

  if (href && !current) {
    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        className={className}
        style={combinedStyles}
        onClick={handleClick}
        aria-current={current ? 'page' : undefined}
      >
        {children}
      </a>
    )
  }

  return (
    <span
      ref={ref}
      className={className}
      style={combinedStyles}
      onClick={onClick ? handleClick : undefined}
      aria-current={current ? 'page' : undefined}
    >
      {children}
    </span>
  )
})
RvnBreadcrumbItem.displayName = 'RvnBreadcrumb.Item'

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

const RvnBreadcrumbRoot = React.forwardRef<HTMLElement, RvnBreadcrumbProps>(
  ({ children, path, separator = ' / ', className, style }, ref) => {
    const combinedStyles: React.CSSProperties = {
      ...breadcrumbStyles,
      ...style,
    }

    // Simple path mode
    if (path && !children) {
      return (
        <nav
          ref={ref}
          className={className}
          style={combinedStyles}
          aria-label="Breadcrumb"
        >
          {path}
        </nav>
      )
    }

    // Children mode - interleave separators
    const items = React.Children.toArray(children)
    const itemsWithSeparators: React.ReactNode[] = []

    items.forEach((child, index) => {
      itemsWithSeparators.push(
        <React.Fragment key={`item-${index}`}>{child}</React.Fragment>
      )
      if (index < items.length - 1) {
        itemsWithSeparators.push(
          <span key={`sep-${index}`} style={separatorStyles} aria-hidden="true">
            {separator}
          </span>
        )
      }
    })

    return (
      <nav
        ref={ref}
        className={className}
        style={combinedStyles}
        aria-label="Breadcrumb"
      >
        {itemsWithSeparators}
      </nav>
    )
  }
)
RvnBreadcrumbRoot.displayName = 'RvnBreadcrumb'

// -----------------------------------------------------------------------------
// Compound Component Export
// -----------------------------------------------------------------------------

export const RvnBreadcrumb = Object.assign(RvnBreadcrumbRoot, {
  Item: RvnBreadcrumbItem,
})

export type { RvnBreadcrumbProps, RvnBreadcrumbItemProps }
