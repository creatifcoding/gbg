/**
 * SearchErrorDisplay - Error presentation with retry UI
 *
 * Displays typed search errors with:
 * - Category-specific icons and colors
 * - User-friendly error messages
 * - Retry button for recoverable errors
 * - Retry countdown timer
 * - Error details expansion
 *
 * @module geoint/components/SearchErrorDisplay
 */

import { memo, useState, useEffect, useCallback, type FC } from 'react'
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react'
import {
  AlertCircle,
  WifiOff,
  Clock,
  Gauge,
  Server,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  XCircle,
  Shield,
  HelpCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  searchStatusAtom,
  searchTypedErrorAtom,
  searchRetryCountAtom,
  MAX_SEARCH_RETRIES,
} from '../atoms'
import { searchOps } from './SearchProvider'
import type { SearchErrorCategory } from '../schemas'

// =============================================================================
// Error Icon Mapping
// =============================================================================

const ERROR_ICONS: Record<SearchErrorCategory, typeof AlertCircle> = {
  network: WifiOff,
  timeout: Clock,
  rate_limit: Gauge,
  server: Server,
  validation: AlertTriangle,
  not_found: XCircle,
  auth: Shield,
  unknown: HelpCircle,
}

const ERROR_COLORS: Record<SearchErrorCategory, string> = {
  network: 'text-status-warning',
  timeout: 'text-status-warning',
  rate_limit: 'text-status-warning',
  server: 'text-status-error',
  validation: 'text-status-error',
  not_found: 'text-status-warning',
  auth: 'text-status-error',
  unknown: 'text-text-tertiary',
}

const ERROR_BG: Record<SearchErrorCategory, string> = {
  network: 'bg-status-warning/10 border-status-warning/20',
  timeout: 'bg-status-warning/10 border-status-warning/20',
  rate_limit: 'bg-status-warning/10 border-status-warning/20',
  server: 'bg-status-error/10 border-status-error/20',
  validation: 'bg-status-error/10 border-status-error/20',
  not_found: 'bg-status-warning/10 border-status-warning/20',
  auth: 'bg-status-error/10 border-status-error/20',
  unknown: 'bg-surface-2 border-border-subtle',
}

// =============================================================================
// Types
// =============================================================================

export interface SearchErrorDisplayProps {
  /** Additional class names */
  className?: string
  /** Show compact version */
  compact?: boolean
  /** Auto-retry on recoverable errors */
  autoRetry?: boolean
  /** Auto-retry delay in ms (default: use error's retryDelayMs) */
  autoRetryDelay?: number
  /** Callback when retry is triggered */
  onRetry?: () => void
  /** Callback when error is dismissed */
  onDismiss?: () => void
}

// =============================================================================
// Component
// =============================================================================

/**
 * SearchErrorDisplay - Shows search errors with retry functionality.
 *
 * @example
 * ```tsx
 * <SearchErrorDisplay
 *   autoRetry
 *   onRetry={() => console.log('Retrying...')}
 * />
 * ```
 */
export const SearchErrorDisplay: FC<SearchErrorDisplayProps> = memo(function SearchErrorDisplay({
  className,
  compact = false,
  autoRetry = false,
  autoRetryDelay,
  onRetry,
  onDismiss,
}) {
  const status = useAtomValue(searchStatusAtom)
  const typedError = useAtomValue(searchTypedErrorAtom)
  const retryCount = useAtomValue(searchRetryCountAtom)
  const retrySearchFn = useAtomSet(searchOps.retrySearch, { mode: 'promiseExit' })

  const [showDetails, setShowDetails] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  // Calculate if we can retry
  const canRetry =
    typedError !== null &&
    typedError.recoverable &&
    retryCount < MAX_SEARCH_RETRIES

  // Get retry delay from error or prop
  const getRetryDelay = useCallback((): number => {
    if (autoRetryDelay !== undefined) return autoRetryDelay
    if (!typedError) return 3000

    // Get delay based on error type
    switch (typedError._tag) {
      case 'SearchNetworkError':
        return typedError.retryDelayMs
      case 'SearchTimeoutError':
        return typedError.retryDelayMs
      case 'SearchRateLimitError':
        return typedError.retryDelayMs
      case 'SearchServerError':
        return typedError.retryDelayMs
      default:
        return 3000
    }
  }, [typedError, autoRetryDelay])

  // Auto-retry countdown
  useEffect(() => {
    if (!autoRetry || !canRetry || status !== 'error') {
      setCountdown(null)
      return
    }

    const delay = getRetryDelay()
    setCountdown(Math.ceil(delay / 1000))

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          return null
        }
        return prev - 1
      })
    }, 1000)

    const timeout = setTimeout(() => {
      handleRetry()
    }, delay)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [autoRetry, canRetry, status, typedError, getRetryDelay])

  // Handle manual retry
  const handleRetry = useCallback(async () => {
    onRetry?.()
    const exit = await retrySearchFn(undefined)
    if (exit._tag === 'Failure') {
      console.error('[SearchErrorDisplay] Retry failed:', exit.cause)
    }
  }, [retrySearchFn, onRetry])

  // Don't render if no error
  if (status !== 'error' || !typedError) {
    return null
  }

  const Icon = ERROR_ICONS[typedError.category]
  const colorClass = ERROR_COLORS[typedError.category]
  const bgClass = ERROR_BG[typedError.category]

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md border',
          bgClass,
          className
        )}
      >
        <Icon className={cn('h-4 w-4 shrink-0', colorClass)} />
        <span className="text-xs text-text-secondary truncate">
          {typedError.userMessage}
        </span>
        {canRetry && (
          <button
            onClick={handleRetry}
            className="shrink-0 p-1 hover:bg-surface-3 rounded transition-colors"
            title={countdown ? `Auto-retry in ${countdown}s` : 'Retry'}
          >
            <RefreshCw
              className={cn(
                'h-3 w-3 text-accent-primary',
                countdown && 'animate-spin'
              )}
            />
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-4 rounded-lg border',
        bgClass,
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-full', bgClass)}>
          <Icon className={cn('h-5 w-5', colorClass)} />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-text-primary">
            {getCategoryLabel(typedError.category)}
          </h4>
          <p className="text-xs text-text-secondary mt-0.5">
            {typedError.userMessage}
          </p>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-surface-3 rounded transition-colors"
            aria-label="Dismiss error"
          >
            <XCircle className="h-4 w-4 text-text-tertiary" />
          </button>
        )}
      </div>

      {/* Retry Section */}
      {canRetry && (
        <div className="flex items-center gap-3 pt-2 border-t border-border-subtle">
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary text-xs font-medium rounded transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', countdown && 'animate-spin')} />
            {countdown ? `Retrying in ${countdown}s...` : 'Retry'}
          </button>

          <span className="text-xs text-text-quaternary">
            Attempt {retryCount + 1} of {MAX_SEARCH_RETRIES}
          </span>
        </div>
      )}

      {/* Details Toggle */}
      {import.meta.env?.DEV && (
        <>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs text-text-quaternary hover:text-text-tertiary transition-colors"
          >
            {showDetails ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {showDetails ? 'Hide' : 'Show'} details
          </button>

          {showDetails && (
            <div className="p-2 bg-surface-0 rounded text-xs font-mono text-text-tertiary overflow-x-auto">
              <pre>{JSON.stringify(
                {
                  tag: typedError._tag,
                  category: typedError.category,
                  message: typedError.message,
                  recoverable: typedError.recoverable,
                },
                null,
                2
              )}</pre>
            </div>
          )}
        </>
      )}
    </div>
  )
})

// =============================================================================
// Helpers
// =============================================================================

function getCategoryLabel(category: SearchErrorCategory): string {
  switch (category) {
    case 'network':
      return 'Connection Error'
    case 'timeout':
      return 'Request Timeout'
    case 'rate_limit':
      return 'Rate Limited'
    case 'server':
      return 'Server Error'
    case 'validation':
      return 'Invalid Request'
    case 'not_found':
      return 'Not Found'
    case 'auth':
      return 'Authentication Required'
    case 'unknown':
      return 'Error'
  }
}

// =============================================================================
// Inline Error Display (for StatusBar integration)
// =============================================================================

export interface InlineSearchErrorProps {
  className?: string
}

/**
 * Inline error display for status bars.
 * Shows just the icon and message with minimal styling.
 */
export const InlineSearchError: FC<InlineSearchErrorProps> = memo(function InlineSearchError({
  className,
}) {
  const status = useAtomValue(searchStatusAtom)
  const typedError = useAtomValue(searchTypedErrorAtom)
  const retryCount = useAtomValue(searchRetryCountAtom)

  if (status !== 'error' || !typedError) {
    return null
  }

  const Icon = ERROR_ICONS[typedError.category]
  const colorClass = ERROR_COLORS[typedError.category]

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <Icon className={cn('h-3.5 w-3.5', colorClass)} />
      <span className={cn('text-xs', colorClass)}>
        {typedError.userMessage}
        {typedError.recoverable && retryCount > 0 && (
          <span className="text-text-quaternary ml-1">
            (retry {retryCount}/{MAX_SEARCH_RETRIES})
          </span>
        )}
      </span>
    </span>
  )
})

export default SearchErrorDisplay
