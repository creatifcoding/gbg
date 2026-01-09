/**
 * AlertPanel - Real-time Intel Notifications
 *
 * Displays real-time intelligence alerts and notifications:
 * - New entity detection alerts
 * - Classification change notifications
 * - Proximity/geofence alerts
 * - System status messages
 * - Alert acknowledgment workflow
 *
 * Compound component architecture:
 * - AlertPanel.Root - Main container with alert management
 * - AlertPanel.Header - Title and controls (clear all, settings)
 * - AlertPanel.AlertList - Virtualized alert list
 * - AlertPanel.AlertItem - Individual alert card
 * - AlertPanel.EmptyState - No alerts display
 * - AlertPanel.Badge - Unread count badge
 * - AlertPanel.Settings - Alert preferences panel
 *
 * @module geoint/components/AlertPanel
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
import { animate, stagger } from 'animejs'
import {
  Bell,
  BellOff,
  BellRing,
  X,
  Check,
  CheckCheck,
  AlertTriangle,
  Info,
  AlertCircle,
  Shield,
  MapPin,
  Radar,
  Settings,
  Trash2,
  ChevronRight,
  Clock,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIMING, EASING, SOURCE_COLORS, CLASSIFICATION_COLORS } from '../tokens'
import type { IntelSource, Classification } from '../schemas'

// =============================================================================
// TYPES
// =============================================================================

export type AlertSeverity = 'critical' | 'warning' | 'info' | 'success'
export type AlertCategory = 'detection' | 'classification' | 'proximity' | 'system' | 'geofence'

export interface IntelAlert {
  /** Unique identifier */
  id: string
  /** Alert title */
  title: string
  /** Alert message/description */
  message: string
  /** Severity level */
  severity: AlertSeverity
  /** Alert category */
  category: AlertCategory
  /** Timestamp */
  timestamp: Date
  /** Associated entity ID (if applicable) */
  entityId?: string
  /** Intel source */
  source?: IntelSource
  /** Classification (for classification change alerts) */
  classification?: Classification
  /** Has been read */
  read: boolean
  /** Has been acknowledged */
  acknowledged: boolean
  /** Location (for geofence/proximity alerts) */
  location?: { longitude: number; latitude: number }
}

export interface AlertPanelContextValue {
  /** All alerts */
  alerts: readonly IntelAlert[]
  /** Unread count */
  unreadCount: number
  /** Mark alert as read */
  markRead: (id: string) => void
  /** Mark all as read */
  markAllRead: () => void
  /** Acknowledge alert */
  acknowledge: (id: string) => void
  /** Dismiss/delete alert */
  dismiss: (id: string) => void
  /** Clear all alerts */
  clearAll: () => void
  /** Sound enabled */
  soundEnabled: boolean
  /** Toggle sound */
  toggleSound: () => void
  /** Compact mode */
  compact: boolean
  /** Close handler */
  onClose?: () => void
  /** Navigate to entity */
  onNavigateToEntity?: (entityId: string) => void
  /** Navigate to location */
  onNavigateToLocation?: (location: { longitude: number; latitude: number }) => void
}

export interface AlertPanelRootProps {
  /** Initial alerts */
  initialAlerts?: readonly IntelAlert[]
  /** New alert handler (for streaming) */
  onNewAlert?: (callback: (alert: IntelAlert) => void) => () => void
  /** Sound enabled by default */
  defaultSoundEnabled?: boolean
  /** Close handler */
  onClose?: () => void
  /** Navigate to entity handler */
  onNavigateToEntity?: (entityId: string) => void
  /** Navigate to location handler */
  onNavigateToLocation?: (location: { longitude: number; latitude: number }) => void
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

const AlertPanelContext = createContext<AlertPanelContextValue | null>(null)

export const useAlertPanel = () => {
  const ctx = useContext(AlertPanelContext)
  if (!ctx) throw new Error('useAlertPanel must be used within AlertPanel.Root')
  return ctx
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SEVERITY_CONFIG: Record<AlertSeverity, { icon: typeof AlertTriangle; color: string; bgColor: string }> = {
  critical: { icon: AlertCircle, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  warning: { icon: AlertTriangle, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
  info: { icon: Info, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  success: { icon: Check, color: 'text-green-500', bgColor: 'bg-green-500/10' },
}

const CATEGORY_CONFIG: Record<AlertCategory, { icon: typeof Radar; label: string }> = {
  detection: { icon: Radar, label: 'Detection' },
  classification: { icon: Shield, label: 'Classification' },
  proximity: { icon: MapPin, label: 'Proximity' },
  system: { icon: Info, label: 'System' },
  geofence: { icon: MapPin, label: 'Geofence' },
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

const Root: FC<AlertPanelRootProps> = ({
  initialAlerts = [],
  onNewAlert,
  defaultSoundEnabled = true,
  onClose,
  onNavigateToEntity,
  onNavigateToLocation,
  compact = false,
  children,
  className,
}) => {
  const [alerts, setAlerts] = useState<IntelAlert[]>([...initialAlerts])
  const [soundEnabled, setSoundEnabled] = useState(defaultSoundEnabled)
  const containerRef = useRef<HTMLDivElement>(null)

  // Enter animation
  useEffect(() => {
    if (containerRef.current) {
      animate(containerRef.current, {
        opacity: [0, 1],
        translateX: [20, 0],
        duration: TIMING.normal,
        ease: EASING.anime.out,
      })
    }
  }, [])

  // Subscribe to new alerts
  useEffect(() => {
    if (!onNewAlert) return

    const unsubscribe = onNewAlert((alert) => {
      setAlerts(prev => [alert, ...prev])
      // Play sound if enabled
      if (soundEnabled && alert.severity === 'critical') {
        // Would play alert sound here
        console.log('Alert sound:', alert.title)
      }
    })
    return unsubscribe
  }, [onNewAlert, soundEnabled])

  const unreadCount = alerts.filter(a => !a.read).length

  const markRead = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a))
  }, [])

  const markAllRead = useCallback(() => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })))
  }, [])

  const acknowledge = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true, read: true } : a))
  }, [])

  const dismiss = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setAlerts([])
  }, [])

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => !prev)
  }, [])

  const contextValue: AlertPanelContextValue = {
    alerts,
    unreadCount,
    markRead,
    markAllRead,
    acknowledge,
    dismiss,
    clearAll,
    soundEnabled,
    toggleSound,
    compact,
    onClose,
    onNavigateToEntity,
    onNavigateToLocation,
  }

  return (
    <AlertPanelContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        className={cn(
          'flex flex-col bg-surface-1 border border-border-subtle rounded-lg overflow-hidden',
          className
        )}
      >
        {children}
      </div>
    </AlertPanelContext.Provider>
  )
}

// =============================================================================
// HEADER COMPONENT
// =============================================================================

export interface HeaderProps {
  /** Additional class */
  className?: string
}

const Header: FC<HeaderProps> = memo(function Header({ className }) {
  const { unreadCount, markAllRead, clearAll, soundEnabled, toggleSound, onClose, compact } = useAlertPanel()

  return (
    <div
      className={cn(
        'flex items-center justify-between px-3 py-2 border-b border-border-subtle',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <div className="relative">
          {unreadCount > 0 ? (
            <BellRing className="w-4 h-4 text-accent-primary" />
          ) : (
            <Bell className="w-4 h-4 text-text-tertiary" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 flex items-center justify-center text-xs font-bold bg-red-500 text-white rounded-full">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <span className={cn(
          'font-medium text-text-primary',
          compact ? 'text-sm' : 'text-base'
        )}>
          Alerts
        </span>
      </div>

      <div className="flex items-center gap-1">
        {/* Sound toggle */}
        <button
          onClick={toggleSound}
          className="p-1.5 hover:bg-surface-2 rounded transition-colors text-text-tertiary hover:text-text-secondary"
          title={soundEnabled ? 'Mute alerts' : 'Enable sound'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Mark all read */}
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="p-1.5 hover:bg-surface-2 rounded transition-colors text-text-tertiary hover:text-text-secondary"
            title="Mark all as read"
          >
            <CheckCheck className="w-4 h-4" />
          </button>
        )}

        {/* Clear all */}
        <button
          onClick={clearAll}
          className="p-1.5 hover:bg-surface-2 rounded transition-colors text-text-tertiary hover:text-text-secondary"
          title="Clear all"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Close */}
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-surface-2 rounded transition-colors text-text-tertiary hover:text-text-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
})

// =============================================================================
// ALERT LIST COMPONENT
// =============================================================================

export interface AlertListProps {
  /** Max height */
  maxHeight?: number | string
  /** Additional class */
  className?: string
}

const AlertList: FC<AlertListProps> = memo(function AlertList({
  maxHeight = 400,
  className,
}) {
  const { alerts } = useAlertPanel()
  const listRef = useRef<HTMLDivElement>(null)

  // Animate new alerts
  useEffect(() => {
    if (listRef.current && alerts.length > 0) {
      const items = listRef.current.querySelectorAll('[data-alert-item]')
      animate(items, {
        opacity: [0, 1],
        translateX: [-10, 0],
        delay: stagger(30),
        duration: TIMING.fast,
        ease: EASING.anime.out,
      })
    }
  }, [alerts.length])

  if (alerts.length === 0) {
    return <EmptyState />
  }

  return (
    <div
      ref={listRef}
      className={cn('flex-1 overflow-y-auto', className)}
      style={{ maxHeight }}
    >
      {alerts.map(alert => (
        <AlertItem key={alert.id} alert={alert} />
      ))}
    </div>
  )
})

// =============================================================================
// ALERT ITEM COMPONENT
// =============================================================================

export interface AlertItemProps {
  /** The alert to display */
  alert: IntelAlert
  /** Additional class */
  className?: string
}

const AlertItem: FC<AlertItemProps> = memo(function AlertItem({
  alert,
  className,
}) {
  const { markRead, acknowledge, dismiss, onNavigateToEntity, onNavigateToLocation, compact } = useAlertPanel()
  const itemRef = useRef<HTMLDivElement>(null)
  const severityConfig = SEVERITY_CONFIG[alert.severity]
  const categoryConfig = CATEGORY_CONFIG[alert.category]
  const Icon = severityConfig.icon
  const CategoryIcon = categoryConfig.icon

  // Mark as read on hover
  const handleMouseEnter = () => {
    if (!alert.read) {
      markRead(alert.id)
    }
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (itemRef.current) {
      animate(itemRef.current, {
        opacity: [1, 0],
        translateX: [0, 20],
        duration: TIMING.fast,
        ease: EASING.anime.in,
        complete: () => dismiss(alert.id),
      })
    }
  }

  const handleAcknowledge = (e: React.MouseEvent) => {
    e.stopPropagation()
    acknowledge(alert.id)
  }

  const handleNavigate = () => {
    if (alert.entityId && onNavigateToEntity) {
      onNavigateToEntity(alert.entityId)
    } else if (alert.location && onNavigateToLocation) {
      onNavigateToLocation(alert.location)
    }
  }

  const sourceColors = alert.source ? SOURCE_COLORS[alert.source] : null
  const classColors = alert.classification ? CLASSIFICATION_COLORS[alert.classification] : null

  return (
    <div
      ref={itemRef}
      data-alert-item
      onMouseEnter={handleMouseEnter}
      onClick={handleNavigate}
      className={cn(
        'relative flex gap-3 p-3 border-b border-border-subtle transition-colors',
        !alert.read && 'bg-surface-2/50',
        (alert.entityId || alert.location) && 'cursor-pointer hover:bg-surface-2',
        className
      )}
    >
      {/* Unread indicator */}
      {!alert.read && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-accent-primary rounded-r" />
      )}

      {/* Severity icon */}
      <div className={cn('p-1.5 rounded', severityConfig.bgColor)}>
        <Icon className={cn('w-4 h-4', severityConfig.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className={cn(
              'font-medium text-text-primary truncate',
              compact ? 'text-xs' : 'text-sm'
            )}>
              {alert.title}
            </h4>
            <p className={cn(
              'text-text-secondary line-clamp-2',
              compact ? 'text-xs' : 'text-xs'
            )}>
              {alert.message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {!alert.acknowledged && alert.severity === 'critical' && (
              <button
                onClick={handleAcknowledge}
                className="p-1 hover:bg-surface-3 rounded transition-colors"
                title="Acknowledge"
              >
                <Check className="w-3.5 h-3.5 text-green-500" />
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-surface-3 rounded transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5 text-text-tertiary" />
            </button>
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-2 mt-1.5">
          {/* Category */}
          <span className="flex items-center gap-1 text-xs text-text-tertiary">
            <CategoryIcon className="w-3 h-3" />
            {categoryConfig.label}
          </span>

          {/* Source badge */}
          {sourceColors && (
            <span
              className={cn(
                'px-1.5 py-0.5 rounded text-xs font-mono uppercase',
                sourceColors.tailwind.bg,
                sourceColors.tailwind.primary
              )}
            >
              {alert.source}
            </span>
          )}

          {/* Classification badge */}
          {classColors && (
            <span
              className={cn(
                'px-1.5 py-0.5 rounded text-xs font-medium uppercase',
                classColors.tailwind.bg,
                classColors.tailwind.text
              )}
            >
              {alert.classification}
            </span>
          )}

          {/* Timestamp */}
          <span className="flex items-center gap-1 text-xs text-text-tertiary ml-auto">
            <Clock className="w-3 h-3" />
            {formatTimeAgo(alert.timestamp)}
          </span>

          {/* Navigate indicator */}
          {(alert.entityId || alert.location) && (
            <ChevronRight className="w-3 h-3 text-text-tertiary" />
          )}
        </div>

        {/* Acknowledged badge */}
        {alert.acknowledged && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-green-500">
            <CheckCheck className="w-3 h-3" />
            Acknowledged
          </div>
        )}
      </div>
    </div>
  )
})

// =============================================================================
// EMPTY STATE COMPONENT
// =============================================================================

export interface EmptyStateProps {
  /** Additional class */
  className?: string
}

const EmptyState: FC<EmptyStateProps> = ({ className }) => {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-12 px-4 text-center',
      className
    )}>
      <BellOff className="w-10 h-10 text-text-tertiary/50 mb-3" />
      <p className="text-sm text-text-secondary">No alerts</p>
      <p className="text-xs text-text-tertiary mt-1">
        You&apos;re all caught up
      </p>
    </div>
  )
}

// =============================================================================
// BADGE COMPONENT (standalone for use in headers)
// =============================================================================

export interface BadgeProps {
  /** Alert count */
  count: number
  /** Additional class */
  className?: string
}

const Badge: FC<BadgeProps> = memo(function Badge({ count, className }) {
  const badgeRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (badgeRef.current && count > 0) {
      animate(badgeRef.current, {
        scale: [0.5, 1.2, 1],
        duration: TIMING.fast,
        ease: EASING.anime.bounce,
      })
    }
  }, [count])

  if (count === 0) return null

  return (
    <span
      ref={badgeRef}
      className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1',
        'text-xs font-bold bg-red-500 text-white rounded-full',
        className
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
})

// =============================================================================
// SETTINGS COMPONENT
// =============================================================================

export interface SettingsProps {
  /** Additional class */
  className?: string
}

const AlertSettings: FC<SettingsProps> = memo(function AlertSettings({ className }) {
  const { soundEnabled, toggleSound } = useAlertPanel()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 hover:bg-surface-2 rounded transition-colors text-text-tertiary hover:text-text-secondary"
        title="Alert settings"
      >
        <Settings className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-surface-1 border border-border-subtle rounded-lg shadow-lg p-2 z-50">
          <button
            onClick={toggleSound}
            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-sm rounded hover:bg-surface-2 transition-colors"
          >
            <span className="text-text-secondary">Alert sounds</span>
            <span className={soundEnabled ? 'text-green-500' : 'text-text-tertiary'}>
              {soundEnabled ? 'On' : 'Off'}
            </span>
          </button>
        </div>
      )}
    </div>
  )
})

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format timestamp as relative time
 */
const formatTimeAgo = (date: Date): string => {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const AlertPanel = Object.assign(Root, {
  Root,
  Header,
  AlertList,
  AlertItem,
  EmptyState,
  Badge,
  Settings: AlertSettings,
})

// Named exports
export {
  Root as AlertPanelRoot,
  Header as AlertPanelHeader,
  AlertList as AlertPanelAlertList,
  AlertItem as AlertPanelAlertItem,
  EmptyState as AlertPanelEmptyState,
  Badge as AlertPanelBadge,
  AlertSettings as AlertPanelSettings,
}

export default AlertPanel
