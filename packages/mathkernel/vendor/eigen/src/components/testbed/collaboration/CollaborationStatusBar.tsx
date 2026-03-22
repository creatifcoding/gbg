/**
 * CollaborationStatusBar
 *
 * Displays connection status, document ID, and user count.
 * Compact horizontal bar for collaboration state visibility.
 *
 * @module testbed/collaboration/CollaborationStatusBar
 */

import { useAtomValue } from '@effect-atom/atom-react';
import {
  collaborationStatusAtom,
  collaborationDocIdAtom,
  connectedUsersAtom,
  type CollaborationUser,
} from '@/lib/editor/v3';
import type { ConnectionStatus } from '@/lib/editor/v3/services';
import { COLORS } from '@/lib/capabilities/tokens';

// =============================================================================
// Types
// =============================================================================

export interface CollaborationStatusBarProps {
  /** Custom className */
  className?: string;
}

// =============================================================================
// Status Indicator
// =============================================================================

interface StatusIndicatorProps {
  status: ConnectionStatus;
}

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { color: string; label: string; pulse: boolean }
> = {
  disconnected: {
    color: COLORS.neutral[600],
    label: 'Disconnected',
    pulse: false,
  },
  connecting: {
    color: COLORS.accent.amber.base,
    label: 'Connecting...',
    pulse: true,
  },
  connected: {
    color: COLORS.accent.green.base,
    label: 'Connected',
    pulse: false,
  },
  error: {
    color: COLORS.accent.red.base,
    label: 'Error',
    pulse: false,
  },
};

function StatusIndicator({ status }: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: config.color,
          boxShadow: `0 0 6px ${config.color}`,
          animation: config.pulse ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }}
      />
      <span
        style={{
          color: config.color,
          fontFamily: 'var(--tmnl-font-mono, monospace)',
          fontSize: 'var(--tmnl-text-xs, 12px)',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {config.label}
      </span>
    </div>
  );
}

// =============================================================================
// Document ID Display
// =============================================================================

interface DocIdDisplayProps {
  docId: string | null;
}

function DocIdDisplay({ docId }: DocIdDisplayProps) {
  if (!docId) return null;

  // Truncate long IDs
  const displayId =
    docId.length > 20 ? `${docId.slice(0, 8)}...${docId.slice(-8)}` : docId;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '2px 8px',
        background: COLORS.neutral[900],
        borderRadius: '4px',
        border: `1px solid ${COLORS.neutral[800]}`,
      }}
    >
      <span
        style={{
          color: COLORS.neutral[500],
          fontFamily: 'var(--tmnl-font-mono, monospace)',
          fontSize: 'var(--tmnl-text-xs, 12px)',
        }}
      >
        DOC:
      </span>
      <span
        style={{
          color: COLORS.neutral[300],
          fontFamily: 'var(--tmnl-font-mono, monospace)',
          fontSize: 'var(--tmnl-text-xs, 12px)',
        }}
        title={docId}
      >
        {displayId}
      </span>
    </div>
  );
}

// =============================================================================
// User Count Badge
// =============================================================================

interface UserCountBadgeProps {
  count: number;
}

function UserCountBadge({ count }: UserCountBadgeProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        background: count > 0 ? COLORS.accent.cyan.base : COLORS.neutral[800],
        color: count > 0 ? COLORS.neutral[950] : COLORS.neutral[500],
        borderRadius: '4px',
        fontFamily: 'var(--tmnl-font-mono, monospace)',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        fontWeight: 600,
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      {count}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function CollaborationStatusBar({
  className,
}: CollaborationStatusBarProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const status = useAtomValue(
    collaborationStatusAtom as any
  ) as ConnectionStatus;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docId = useAtomValue(collaborationDocIdAtom as any) as string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users = useAtomValue(
    connectedUsersAtom as any
  ) as readonly CollaborationUser[];

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 12px',
        background: COLORS.neutral[950],
        borderRadius: '6px',
        border: `1px solid ${COLORS.neutral[800]}`,
      }}
    >
      <StatusIndicator status={status} />

      <div
        style={{
          width: '1px',
          height: '16px',
          background: COLORS.neutral[800],
        }}
      />

      <DocIdDisplay docId={docId} />

      <div style={{ marginLeft: 'auto' }}>
        <UserCountBadge count={users.length} />
      </div>
    </div>
  );
}

export default CollaborationStatusBar;
