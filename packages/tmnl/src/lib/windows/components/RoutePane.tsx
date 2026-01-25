/**
 * RoutePane - Router Content in Pane
 *
 * Renders TanStack Router content for a given route.
 * Derives components directly from the router's route tree.
 *
 * @module lib/windows/components/RoutePane
 */

import React, { Suspense, useMemo, useCallback } from 'react'
import { getRouterContext } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import type { ContentPane } from '../schemas'
import { windowActions } from '../atoms'
import router from '@/router'

// Get the router context for providing to route components
const RouterContext = getRouterContext()

// =============================================================================
// Types
// =============================================================================

interface RoutePaneProps {
  pane: ContentPane
  isFocused: boolean
}

// =============================================================================
// Route Pane Component
// =============================================================================

/**
 * Renders content for a pane based on its route.
 * Derives component directly from TanStack Router's route tree.
 */
export function RoutePane({ pane, isFocused }: RoutePaneProps) {
  // Find the route component from the router's route tree
  // Uses static router import - works outside RouterProvider context
  const RouteComponent = useMemo(() => {
    // Use router.routesByPath for efficient lookup
    const routesByPath = router.routesByPath as Record<string, any>

    // Try exact match first
    let route = routesByPath[pane.route]

    // Try with trailing slash if not found
    if (!route && !pane.route.endsWith('/')) {
      route = routesByPath[pane.route + '/']
    }

    // Try without trailing slash if not found
    if (!route && pane.route.endsWith('/') && pane.route.length > 1) {
      route = routesByPath[pane.route.slice(0, -1)]
    }

    // Return the component if found
    return route?.options?.component as React.ComponentType | undefined
  }, [pane.route])

  // Get available routes for the selector
  const availableRoutes = useMemo(() => {
    const routesByPath = router.routesByPath as Record<string, any>
    return Object.keys(routesByPath)
      .filter((path) => path && !path.includes('$')) // Exclude dynamic routes
      .sort()
  }, [])

  // Intercept link clicks to navigate within pane instead of globally
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const link = target.closest('a')
    if (link && link.href) {
      try {
        const url = new URL(link.href)
        // Only intercept same-origin links
        if (url.origin === window.location.origin) {
          e.preventDefault()
          e.stopPropagation()
          // Update this pane's route
          windowActions.setFocusedRoute(url.pathname)
        }
      } catch {
        // Invalid URL, let it propagate
      }
    }
  }, [])

  if (RouteComponent) {
    return (
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-text-secondary">
            Loading {pane.route}...
          </div>
        }
      >
        {/* Provide router context for <Link> and other router-aware components */}
        <RouterContext.Provider value={router}>
          <div
            className={cn(
              'relative h-full w-full overflow-auto',
              isFocused && 'outline-none'
            )}
            style={{ contain: 'layout paint' }}
            onClickCapture={handleClick}
          >
            <RouteComponent />
          </div>
        </RouterContext.Provider>
      </Suspense>
    )
  }

  // Fallback: show route selector when component not found
  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-text-secondary text-sm">
          Pane: {pane.id.slice(0, 12)}
        </span>
        {isFocused && (
          <span className="rounded bg-accent-blue/20 px-2 py-0.5 text-xs text-accent-blue">
            Focused
          </span>
        )}
      </div>

      <div className="text-text-primary mb-4">
        Route: <code className="rounded bg-surface-2 px-1">{pane.route}</code>
        <span className="ml-2 text-xs text-text-tertiary">(component not found)</span>
      </div>

      <div className="flex-1 overflow-auto">
        <h3 className="mb-2 text-sm font-medium text-text-secondary">
          Available routes:
        </h3>
        <div className="flex flex-wrap gap-2">
          {availableRoutes.slice(0, 12).map((route) => (
            <RouteButton
              key={route}
              route={route}
              currentRoute={pane.route}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 border-t border-surface-3 pt-4 text-xs text-text-tertiary">
        <div>C-x 2: Split horizontal</div>
        <div>C-x 3: Split vertical</div>
        <div>C-x o: Next pane</div>
        <div>C-x 0: Close pane</div>
        <div>C-x 1: Close others</div>
      </div>
    </div>
  )
}

/**
 * Legacy registration function - kept for backwards compatibility.
 * With router integration, this is no longer needed.
 */
export function registerPaneRoute(
  _route: string,
  _name: string,
  _component: React.ComponentType
) {
  console.warn('[windows] registerPaneRoute is deprecated - components are now derived from router')
}

// =============================================================================
// Route Button
// =============================================================================

function RouteButton({
  route,
  currentRoute,
}: {
  route: string
  currentRoute: string
}) {
  const handleClick = () => {
    windowActions.setFocusedRoute(route)
  }

  const isActive = currentRoute === route

  return (
    <button
      onClick={handleClick}
      className={cn(
        'rounded px-3 py-1.5 text-sm transition-colors',
        isActive
          ? 'bg-accent-blue text-white'
          : 'bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary'
      )}
    >
      {route === '/' ? 'Home' : route.slice(1)}
    </button>
  )
}

// =============================================================================
// Render Function for WindowManager
// =============================================================================

/**
 * Default render function for WindowManager.
 * Pass this to WindowManager's renderContent prop.
 */
export function renderRoutePane(
  pane: ContentPane,
  isFocused: boolean
): React.ReactNode {
  return <RoutePane pane={pane} isFocused={isFocused} />
}

export default RoutePane
