/**
 * Breadcrumb Component
 *
 * Level 3: Path navigation breadcrumbs.
 *
 * @module file-browser/components/Header
 */

import { memo, useCallback } from 'react'
import { ChevronRight, Home } from 'lucide-react'

import { useFileBrowserContext } from '../FileBrowser/context'
import { DARK_SIDE } from '../../tokens'

// =============================================================================
// Types
// =============================================================================

export interface BreadcrumbProps {
  /** Maximum segments to show (rest collapsed) */
  maxSegments?: number
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

export const Breadcrumb = memo(function Breadcrumb({
  maxSegments = 5,
  className = '',
}: BreadcrumbProps) {
  const { breadcrumbs, navigate, currentPath } = useFileBrowserContext()

  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path)
    },
    [navigate]
  )

  // Collapse middle segments if too many
  const displaySegments = (() => {
    if (breadcrumbs.length <= maxSegments) {
      return breadcrumbs.map((b, i) => ({ ...b, collapsed: false, index: i }))
    }

    const first = breadcrumbs.slice(0, 1)
    const last = breadcrumbs.slice(-maxSegments + 2)
    const collapsed = {
      name: '...',
      path: breadcrumbs[Math.floor(breadcrumbs.length / 2)].path,
      collapsed: true,
      index: 1,
    }

    return [
      ...first.map((b, i) => ({ ...b, collapsed: false, index: i })),
      collapsed,
      ...last.map((b, i) => ({ ...b, collapsed: false, index: i + 2 })),
    ]
  })()

  return (
    <nav
      className={`breadcrumb ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: DARK_SIDE.spacing['1'],
        fontFamily: DARK_SIDE.typography.family.mono,
        fontSize: DARK_SIDE.typography.size.sm,
      }}
      aria-label="File path"
    >
      {/* Root/Home */}
      <button
        onClick={() => handleNavigate('/')}
        className="breadcrumb-root"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
          padding: 0,
          background: 'transparent',
          border: 'none',
          color:
            currentPath === '/'
              ? DARK_SIDE.colors.accent.green
              : DARK_SIDE.colors.text.secondary,
          cursor: 'pointer',
          transition: `color ${DARK_SIDE.animation.duration.fast}`,
        }}
        title="Go to root"
        aria-label="Go to root directory"
      >
        <Home size={14} />
      </button>

      {/* Separator */}
      {breadcrumbs.length > 0 && (
        <ChevronRight
          size={12}
          style={{ color: DARK_SIDE.colors.text.muted }}
        />
      )}

      {/* Segments */}
      {displaySegments.map((segment, idx) => (
        <span
          key={segment.path}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: DARK_SIDE.spacing['1'],
          }}
        >
          <button
            onClick={() => handleNavigate(segment.path)}
            className="breadcrumb-segment"
            style={{
              padding: `${DARK_SIDE.spacing['0.5']} ${DARK_SIDE.spacing['1']}`,
              background: 'transparent',
              border: 'none',
              color:
                idx === displaySegments.length - 1
                  ? DARK_SIDE.colors.text.primary
                  : DARK_SIDE.colors.text.secondary,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              letterSpacing: segment.collapsed ? '0.1em' : 'normal',
              transition: `color ${DARK_SIDE.animation.duration.fast}`,
            }}
            title={segment.collapsed ? 'Collapsed segments' : segment.path}
            aria-current={idx === displaySegments.length - 1 ? 'page' : undefined}
          >
            {segment.name}
          </button>

          {/* Separator after each except last */}
          {idx < displaySegments.length - 1 && (
            <ChevronRight
              size={12}
              style={{ color: DARK_SIDE.colors.text.muted }}
            />
          )}
        </span>
      ))}

      {/* Hover styles */}
      <style>{`
        .breadcrumb-root:hover {
          color: ${DARK_SIDE.colors.accent.green} !important;
        }
        .breadcrumb-segment:hover {
          color: ${DARK_SIDE.colors.accent.cyan} !important;
        }
      `}</style>
    </nav>
  )
})
