/**
 * LiveFeedIndicator - Real-time Data Stream Status
 *
 * Displays status of live data feeds:
 * - Connection status (connected, connecting, disconnected, error)
 * - Message rate / throughput
 * - Last update timestamp
 * - Individual feed health
 * - Reconnection controls
 *
 * Compound component architecture:
 * - LiveFeedIndicator.Root - Container with feed state
 * - LiveFeedIndicator.StatusBadge - Compact status indicator
 * - LiveFeedIndicator.FeedList - List of active feeds
 * - LiveFeedIndicator.FeedItem - Individual feed status
 * - LiveFeedIndicator.Metrics - Aggregate metrics display
 *
 * @module geoint/components/LiveFeedIndicator
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  memo,
  type FC,
  type ReactNode,
} from 'react'
import { animate } from 'animejs'
import {
  Radio,
  Wifi,
  WifiOff,
  AlertTriangle,
  Activity,
  RefreshCw,
  Pause,
  Play,
  ChevronDown,
  X,
  Zap,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIMING, EASING, SOURCE_COLORS, STATUS_COLORS } from '../tokens'

// =============================================================================
// TYPES
// =============================================================================

export type FeedStatus = 'connected' | 'connecting' | 'disconnected' | 'error' | 'paused'

export interface LiveFeed {
  /** Unique ID */
  id: string
  /** Feed name */
  name: string
  /** Feed source type */
  source: string
  /** Current status */
  status: FeedStatus
  /** Last update timestamp */
  lastUpdate: number | null
  /** Messages per second */
  messageRate: number
  /** Total messages received */
  totalMessages: number
  /** Error message (if status === 'error') */
  errorMessage?: string
  /** Is primary feed */
  isPrimary?: boolean
}

export interface LiveFeedContextValue {
  /** All feeds */
  feeds: readonly LiveFeed[]
  /** Overall status */
  overallStatus: FeedStatus
  /** Total message rate */
  totalMessageRate: number
  /** Is any feed connected */
  hasConnection: boolean
  /** Pause feed */
  pauseFeed: (feedId: string) => void
  /** Resume feed */
  resumeFeed: (feedId: string) => void
  /** Reconnect feed */
  reconnectFeed: (feedId: string) => void
  /** Pause all feeds */
  pauseAll: () => void
  /** Resume all feeds */
  resumeAll: () => void
  /** Is expanded */
  isExpanded: boolean
  /** Toggle expanded */
  toggleExpanded: () => void
  /** Compact mode */
  compact: boolean
}

export interface LiveFeedIndicatorRootProps {
  /** Live feed data */
  feeds: readonly LiveFeed[]
  /** Feed action callback */
  onFeedAction?: (action: 'pause' | 'resume' | 'reconnect', feedId: string) => void
  /** Pause all callback */
  onPauseAll?: () => void
  /** Resume all callback */
  onResumeAll?: () => void
  /** Close handler */
  onClose?: () => void
  /** Initially expanded */
  initialExpanded?: boolean
  /** Compact mode */
  compact?: boolean
  /** Children */
  children: ReactNode
  /** Additional class */
  className?: string
}

// =============================================================================
// CONTEXT
// =============================================================================

const LiveFeedContext = createContext<LiveFeedContextValue | null>(null)

export const useLiveFeed = () => {
  const ctx = useContext(LiveFeedContext)
  if (!ctx) throw new Error('useLiveFeed must be used within LiveFeedIndicator.Root')
  return ctx
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_CONFIG: Record<FeedStatus, { label: string; color: string; icon: typeof Wifi }> = {
  connected: { label: 'Connected', color: STATUS_COLORS.success.primary, icon: Wifi },
  connecting: { label: 'Connecting', color: STATUS_COLORS.loading.primary, icon: Radio },
  disconnected: { label: 'Disconnected', color: STATUS_COLORS.idle.primary, icon: WifiOff },
  error: { label: 'Error', color: STATUS_COLORS.error.primary, icon: AlertTriangle },
  paused: { label: 'Paused', color: STATUS_COLORS.idle.primary, icon: Pause },
}

// =============================================================================
// UTILITIES
// =============================================================================

/** Format time ago */
const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 1000) return 'just now'
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

/** Format message rate */
const formatRate = (rate: number): string => {
  if (rate < 1) return `${(rate * 60).toFixed(1)}/min`
  if (rate < 1000) return `${rate.toFixed(1)}/s`
  return `${(rate / 1000).toFixed(1)}k/s`
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

const Root: FC<LiveFeedIndicatorRootProps> = ({
  feeds,
  onFeedAction,
  onPauseAll,
  onResumeAll,
  onClose,
  initialExpanded = false,
  compact = false,
  children,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded)
  const containerRef = useRef<HTMLDivElement>(null)

  // Calculate aggregate stats
  const overallStatus: FeedStatus = (() => {
    if (feeds.some(f => f.status === 'error')) return 'error'
    if (feeds.some(f => f.status === 'connected')) return 'connected'
    if (feeds.some(f => f.status === 'connecting')) return 'connecting'
    if (feeds.every(f => f.status === 'paused')) return 'paused'
    return 'disconnected'
  })()

  const totalMessageRate = feeds.reduce((sum, f) => sum + f.messageRate, 0)
  const hasConnection = feeds.some(f => f.status === 'connected')

  // Enter animation
  useEffect(() => {
    if (containerRef.current) {
      animate(containerRef.current, {
        opacity: [0, 1],
        scale: [0.95, 1],
        duration: TIMING.fast,
        ease: EASING.anime.out,
      })
    }
  }, [])

  const pauseFeed = useCallback((feedId: string) => {
    onFeedAction?.('pause', feedId)
  }, [onFeedAction])

  const resumeFeed = useCallback((feedId: string) => {
    onFeedAction?.('resume', feedId)
  }, [onFeedAction])

  const reconnectFeed = useCallback((feedId: string) => {
    onFeedAction?.('reconnect', feedId)
  }, [onFeedAction])

  const pauseAll = useCallback(() => {
    onPauseAll?.()
  }, [onPauseAll])

  const resumeAll = useCallback(() => {
    onResumeAll?.()
  }, [onResumeAll])

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])

  const contextValue: LiveFeedContextValue = {
    feeds,
    overallStatus,
    totalMessageRate,
    hasConnection,
    pauseFeed,
    resumeFeed,
    reconnectFeed,
    pauseAll,
    resumeAll,
    isExpanded,
    toggleExpanded,
    compact,
  }

  return (
    <LiveFeedContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        className={cn(
          'bg-surface-1 border border-border-subtle rounded-lg overflow-hidden',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-accent-primary" />
            <span className={cn(
              'font-medium text-text-primary',
              compact ? 'text-sm' : 'text-base'
            )}>
              Live Feeds
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleExpanded}
              className="p-1 hover:bg-surface-2 rounded text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <ChevronDown className={cn(
                'w-4 h-4 transition-transform',
                isExpanded && 'rotate-180'
              )} />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-surface-2 rounded text-text-tertiary hover:text-text-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {children}
      </div>
    </LiveFeedContext.Provider>
  )
}

// =============================================================================
// STATUS BADGE COMPONENT
// =============================================================================

export interface StatusBadgeProps {
  /** Show message rate */
  showRate?: boolean
  /** Show feed count */
  showCount?: boolean
  /** Pulse animation when connected */
  pulse?: boolean
  /** Additional class */
  className?: string
}

const StatusBadge: FC<StatusBadgeProps> = memo(function StatusBadge({
  showRate = true,
  showCount = false,
  pulse = true,
  className,
}) {
  const { overallStatus, totalMessageRate, feeds, hasConnection, compact } = useLiveFeed()
  const config = STATUS_CONFIG[overallStatus]
  const StatusIcon = config.icon

  const connectedCount = feeds.filter(f => f.status === 'connected').length

  return (
    <div className={cn(
      'flex items-center gap-2 px-2 py-1 rounded-lg',
      'bg-surface-2 border border-border-subtle',
      className
    )}>
      {/* Status indicator */}
      <div className="relative">
        <StatusIcon
          className={cn('w-4 h-4', compact && 'w-3.5 h-3.5')}
          style={{ color: config.color }}
        />
        {pulse && hasConnection && (
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-50"
            style={{ backgroundColor: config.color }}
          />
        )}
      </div>

      {/* Status text */}
      <span className={cn(
        'font-medium',
        compact ? 'text-xs' : 'text-sm'
      )} style={{ color: config.color }}>
        {config.label}
      </span>

      {/* Optional rate */}
      {showRate && hasConnection && (
        <div className="flex items-center gap-1 text-text-tertiary">
          <Activity className="w-3 h-3" />
          <span className="text-xs font-mono">{formatRate(totalMessageRate)}</span>
        </div>
      )}

      {/* Optional count */}
      {showCount && (
        <span className="text-xs text-text-tertiary">
          {connectedCount}/{feeds.length}
        </span>
      )}
    </div>
  )
})

// =============================================================================
// FEED LIST COMPONENT
// =============================================================================

export interface FeedListProps {
  /** Additional class */
  className?: string
}

const FeedList: FC<FeedListProps> = memo(function FeedList({ className }) {
  const { feeds, isExpanded } = useLiveFeed()

  if (!isExpanded) return null

  return (
    <div className={cn('px-3 py-2 space-y-1', className)}>
      {feeds.map(feed => (
        <FeedItem key={feed.id} feed={feed} />
      ))}
    </div>
  )
})

// =============================================================================
// FEED ITEM COMPONENT
// =============================================================================

export interface FeedItemProps {
  /** Feed data */
  feed: LiveFeed
  /** Additional class */
  className?: string
}

const FeedItem: FC<FeedItemProps> = memo(function FeedItem({
  feed,
  className,
}) {
  const { pauseFeed, resumeFeed, reconnectFeed, compact } = useLiveFeed()
  const config = STATUS_CONFIG[feed.status]
  const StatusIcon = config.icon
  const itemRef = useRef<HTMLDivElement>(null)

  // Source color
  const sourceColor = SOURCE_COLORS[feed.source as keyof typeof SOURCE_COLORS]?.primary ?? SOURCE_COLORS.custom.primary

  // Animate on status change
  useEffect(() => {
    if (itemRef.current) {
      animate(itemRef.current, {
        backgroundColor: [config.color + '20', 'transparent'],
        duration: TIMING.normal,
        ease: EASING.anime.out,
      })
    }
  }, [feed.status, config.color])

  return (
    <div
      ref={itemRef}
      className={cn(
        'flex items-center gap-2 p-2 rounded-lg bg-surface-2 transition-colors',
        className
      )}
    >
      {/* Source color indicator */}
      <div
        className="w-1 h-8 rounded-full"
        style={{ backgroundColor: sourceColor }}
      />

      {/* Status icon */}
      <StatusIcon
        className={cn('w-4 h-4 flex-shrink-0', compact && 'w-3.5 h-3.5')}
        style={{ color: config.color }}
      />

      {/* Feed info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            'font-medium truncate',
            compact ? 'text-xs' : 'text-sm',
            'text-text-secondary'
          )}>
            {feed.name}
          </span>
          {feed.isPrimary && (
            <span className="px-1.5 py-0.5 text-xs bg-accent-primary/20 text-accent-primary rounded">
              PRIMARY
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <span>{config.label}</span>
          {feed.lastUpdate && (
            <>
              <span>·</span>
              <span>{formatTimeAgo(feed.lastUpdate)}</span>
            </>
          )}
          {feed.status === 'connected' && (
            <>
              <span>·</span>
              <span className="font-mono">{formatRate(feed.messageRate)}</span>
            </>
          )}
        </div>
        {feed.status === 'error' && feed.errorMessage && (
          <div className="text-xs text-red-400 truncate mt-0.5">
            {feed.errorMessage}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {(feed.status === 'connected' || feed.status === 'connecting') && (
          <button
            onClick={() => pauseFeed(feed.id)}
            className="p-1 hover:bg-surface-3 rounded text-text-tertiary hover:text-text-secondary transition-colors"
            title="Pause"
          >
            <Pause className="w-3.5 h-3.5" />
          </button>
        )}
        {feed.status === 'paused' && (
          <button
            onClick={() => resumeFeed(feed.id)}
            className="p-1 hover:bg-surface-3 rounded text-text-tertiary hover:text-accent-primary transition-colors"
            title="Resume"
          >
            <Play className="w-3.5 h-3.5" />
          </button>
        )}
        {(feed.status === 'disconnected' || feed.status === 'error') && (
          <button
            onClick={() => reconnectFeed(feed.id)}
            className="p-1 hover:bg-surface-3 rounded text-text-tertiary hover:text-accent-primary transition-colors"
            title="Reconnect"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
})

// =============================================================================
// METRICS COMPONENT
// =============================================================================

export interface MetricsProps {
  /** Show total messages */
  showTotalMessages?: boolean
  /** Show uptime */
  showUptime?: boolean
  /** Additional class */
  className?: string
}

const Metrics: FC<MetricsProps> = memo(function Metrics({
  showTotalMessages = true,
  showUptime: _showUptime = false,
  className,
}) {
  const { feeds, totalMessageRate, isExpanded, compact } = useLiveFeed()

  if (!isExpanded) return null

  const totalMessages = feeds.reduce((sum, f) => sum + f.totalMessages, 0)
  const connectedFeeds = feeds.filter(f => f.status === 'connected').length

  return (
    <div className={cn('px-3 py-2 border-t border-border-subtle', className)}>
      <div className={cn(
        'grid gap-2',
        compact ? 'grid-cols-3' : 'grid-cols-3'
      )}>
        {/* Message rate */}
        <div className="p-2 bg-surface-2 rounded text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Zap className="w-3 h-3 text-accent-primary" />
            <span className="text-xs text-text-tertiary uppercase">Rate</span>
          </div>
          <div className="font-mono text-sm text-text-primary">
            {formatRate(totalMessageRate)}
          </div>
        </div>

        {/* Total messages */}
        {showTotalMessages && (
          <div className="p-2 bg-surface-2 rounded text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Activity className="w-3 h-3 text-accent-primary" />
              <span className="text-xs text-text-tertiary uppercase">Total</span>
            </div>
            <div className="font-mono text-sm text-text-primary">
              {totalMessages.toLocaleString()}
            </div>
          </div>
        )}

        {/* Connected feeds */}
        <div className="p-2 bg-surface-2 rounded text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Wifi className="w-3 h-3 text-accent-primary" />
            <span className="text-xs text-text-tertiary uppercase">Feeds</span>
          </div>
          <div className="font-mono text-sm text-text-primary">
            {connectedFeeds}/{feeds.length}
          </div>
        </div>
      </div>
    </div>
  )
})

// =============================================================================
// GLOBAL CONTROLS COMPONENT
// =============================================================================

export interface GlobalControlsProps {
  /** Additional class */
  className?: string
}

const GlobalControls: FC<GlobalControlsProps> = memo(function GlobalControls({ className }) {
  const { feeds, pauseAll, resumeAll, isExpanded, compact } = useLiveFeed()

  if (!isExpanded) return null

  const hasActive = feeds.some(f => f.status === 'connected' || f.status === 'connecting')
  const hasPaused = feeds.some(f => f.status === 'paused')

  return (
    <div className={cn('px-3 py-2 border-t border-border-subtle flex items-center gap-2', className)}>
      {hasActive && (
        <button
          onClick={pauseAll}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded text-text-secondary hover:bg-surface-2 transition-colors',
            compact ? 'text-xs' : 'text-sm'
          )}
        >
          <Pause className="w-3.5 h-3.5" />
          Pause All
        </button>
      )}
      {hasPaused && (
        <button
          onClick={resumeAll}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded text-accent-primary hover:bg-accent-primary/10 transition-colors',
            compact ? 'text-xs' : 'text-sm'
          )}
        >
          <Play className="w-3.5 h-3.5" />
          Resume All
        </button>
      )}
      <div className="flex-1" />
      <span className="text-xs text-text-tertiary flex items-center gap-1">
        <Clock className="w-3 h-3" />
        Updated {formatTimeAgo(Date.now())}
      </span>
    </div>
  )
})

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const LiveFeedIndicator = Object.assign(Root, {
  Root,
  StatusBadge,
  FeedList,
  FeedItem,
  Metrics,
  GlobalControls,
})

// Named exports
export {
  Root as LiveFeedIndicatorRoot,
  StatusBadge as LiveFeedIndicatorStatusBadge,
  FeedList as LiveFeedIndicatorFeedList,
  FeedItem as LiveFeedIndicatorFeedItem,
  Metrics as LiveFeedIndicatorMetrics,
  GlobalControls as LiveFeedIndicatorGlobalControls,
}

export default LiveFeedIndicator
