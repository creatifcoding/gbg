/**
 * WindowHeaderContent
 *
 * Header content for child Tauri windows.
 * Derived from HeaderContent conventions with simplified structure:
 * - Left: Testbed name/icon
 * - Right: Window controls (minimize, maximize, close)
 * - Full drag region for Tauri window movement
 *
 * Typography (consistent with HeaderContent):
 * - Title → Orbitron (font-nav)
 * - Buttons → Orbitron (font-button)
 *
 * @module lib/shell
 */

import { useCallback } from 'react'
import { X, Minus, Maximize2 } from 'lucide-react'
import { Effect } from 'effect'
import { WindowManagerService, WindowManagerServiceDefault } from '@/lib/tauri-windows'
import { getTestbedById } from '@/lib/testbed/registry'

// ─────────────────────────────────────────────────────────────
// Button Primitive (from HeaderContent)
// ─────────────────────────────────────────────────────────────

interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'outline' | 'ghost' | 'danger'
  size?: 'xs' | 'sm'
  className?: string
  title?: string
}

function Button({
  children,
  onClick,
  variant = 'ghost',
  size = 'xs',
  className = '',
  title,
}: ButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center gap-1.5 font-button uppercase tracking-wide transition-colors disabled:opacity-50'

  const sizeClasses = {
    xs: 'px-2 py-1',
    sm: 'px-3 py-1.5',
  }

  const variantClasses = {
    outline:
      'border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white hover:bg-neutral-900',
    ghost: 'text-neutral-500 hover:text-white hover:bg-neutral-900',
    danger: 'text-neutral-500 hover:text-red-400 hover:bg-red-950/50',
  }

  return (
    <button
      data-tauri-drag-region="false"
      onClick={onClick}
      title={title}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface WindowHeaderContentProps {
  /** Testbed ID (from URL params) */
  testbedId: string
  /** Current window label */
  windowLabel?: string
  /** Custom title override */
  title?: string
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

/**
 * WindowHeaderContent renders the header for child Tauri windows.
 *
 * Features:
 * - Testbed name from registry
 * - Window controls (close)
 * - Tauri drag region for window movement
 */
export function WindowHeaderContent({
  testbedId,
  windowLabel,
  title: customTitle,
}: WindowHeaderContentProps) {
  // Get testbed metadata from registry
  const testbed = getTestbedById(testbedId)
  const displayTitle = customTitle ?? testbed?.name ?? testbedId

  // ─── Window Control Handlers ─────────────────────────────────

  const handleClose = useCallback(() => {
    if (!windowLabel) return

    Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* WindowManagerService
        yield* svc.closeWindow(windowLabel)
      }).pipe(
        Effect.provide(WindowManagerServiceDefault),
        Effect.catchAll(() => Effect.void)
      )
    )
  }, [windowLabel])

  const handleMinimize = useCallback(() => {
    if (!windowLabel) return

    Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* WindowManagerService
        yield* svc.minimizeWindow(windowLabel)
      }).pipe(
        Effect.provide(WindowManagerServiceDefault),
        Effect.catchAll(() => Effect.void)
      )
    )
  }, [windowLabel])

  const handleMaximize = useCallback(() => {
    if (!windowLabel) return

    Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* WindowManagerService
        const state = yield* svc.getWindowState(windowLabel)
        if (state.is_maximized) {
          yield* svc.unmaximizeWindow(windowLabel)
        } else {
          yield* svc.maximizeWindow(windowLabel)
        }
      }).pipe(
        Effect.provide(WindowManagerServiceDefault),
        Effect.catchAll(() => Effect.void)
      )
    )
  }, [windowLabel])

  return (
    <div
      data-tauri-drag-region
      className="h-full flex items-center"
      style={{ borderBottom: 'var(--tmnl-border-chrome)' }}
    >
      {/* Left section - Testbed title */}
      <div
        data-tauri-drag-region
        className="flex-1 h-full flex items-center px-4"
      >
        <div className="flex items-center gap-3">
          {/* Category indicator dot */}
          {testbed?.accent && (
            <div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: `var(--tmnl-accent-${testbed.accent}, currentColor)`,
                boxShadow: `0 0 6px var(--tmnl-accent-${testbed.accent}, currentColor)`,
              }}
            />
          )}

          {/* Testbed name */}
          <span
            className="text-white font-nav uppercase tracking-wide"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            {displayTitle}
          </span>

          {/* Category badge */}
          {testbed?.category && (
            <span
              className="text-neutral-600 font-terminal uppercase"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {testbed.category}
            </span>
          )}
        </div>
      </div>

      {/* Right section - Window controls */}
      <div className="flex items-center h-full">
        {/* Minimize */}
        <Button variant="ghost" onClick={handleMinimize} title="Minimize">
          <Minus
            style={{
              width: 'var(--tmnl-text-sm, 14px)',
              height: 'var(--tmnl-text-sm, 14px)',
            }}
          />
        </Button>

        {/* Maximize */}
        <Button variant="ghost" onClick={handleMaximize} title="Maximize">
          <Maximize2
            style={{
              width: 'var(--tmnl-text-sm, 14px)',
              height: 'var(--tmnl-text-sm, 14px)',
            }}
          />
        </Button>

        {/* Close */}
        <Button
          variant="danger"
          onClick={handleClose}
          title="Close"
          className="px-4"
        >
          <X
            style={{
              width: 'var(--tmnl-text-sm, 14px)',
              height: 'var(--tmnl-text-sm, 14px)',
            }}
          />
        </Button>
      </div>
    </div>
  )
}

export default WindowHeaderContent
