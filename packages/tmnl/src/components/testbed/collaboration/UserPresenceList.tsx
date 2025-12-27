/**
 * UserPresenceList
 *
 * Simple component showing connected collaboration users.
 * Displays colored dots with names in a horizontal or vertical list.
 *
 * @module testbed/collaboration/UserPresenceList
 */

import { useAtomValue } from '@effect-atom/atom-react';
import { connectedUsersAtom, type CollaborationUser } from '@/lib/editor/v3';
import { COLORS } from '@/lib/capabilities/tokens';

// =============================================================================
// Types
// =============================================================================

export interface UserPresenceListProps {
  /** Layout direction */
  direction?: 'horizontal' | 'vertical';
  /** Max users to show before "+N more" */
  maxVisible?: number;
  /** Show user count badge */
  showCount?: boolean;
  /** Custom className */
  className?: string;
}

// =============================================================================
// User Badge
// =============================================================================

interface UserBadgeProps {
  user: CollaborationUser;
  compact?: boolean;
}

function UserBadge({ user, compact }: UserBadgeProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? '4px' : '8px',
        padding: compact ? '2px 6px' : '4px 10px',
        background: COLORS.neutral[900],
        borderRadius: '4px',
        border: `1px solid ${COLORS.neutral[800]}`,
      }}
    >
      <div
        style={{
          width: compact ? '8px' : '10px',
          height: compact ? '8px' : '10px',
          borderRadius: '50%',
          background: user.color,
          boxShadow: `0 0 6px ${user.color}`,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          color: COLORS.neutral[300],
          fontFamily: 'var(--tmnl-font-mono, monospace)',
          fontSize: 'var(--tmnl-text-xs, 12px)',
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        {user.name}
      </span>
    </div>
  );
}

// =============================================================================
// Overflow Badge
// =============================================================================

interface OverflowBadgeProps {
  count: number;
  compact?: boolean;
}

function OverflowBadge({ count, compact }: OverflowBadgeProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: compact ? '2px 6px' : '4px 10px',
        background: COLORS.neutral[800],
        borderRadius: '4px',
        border: `1px solid ${COLORS.neutral[700]}`,
      }}
    >
      <span
        style={{
          color: COLORS.neutral[400],
          fontFamily: 'var(--tmnl-font-mono, monospace)',
          fontSize: 'var(--tmnl-text-xs, 12px)',
          fontWeight: 500,
        }}
      >
        +{count} more
      </span>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function UserPresenceList({
  direction = 'horizontal',
  maxVisible = 5,
  showCount = true,
  className,
}: UserPresenceListProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users = useAtomValue(
    connectedUsersAtom as any
  ) as readonly CollaborationUser[];
  const visibleUsers = users.slice(0, maxVisible);
  const overflowCount = Math.max(0, users.length - maxVisible);
  const isCompact = direction === 'horizontal';

  if (users.length === 0) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 10px',
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
          No users connected
        </span>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: direction === 'horizontal' ? 'row' : 'column',
        alignItems: direction === 'horizontal' ? 'center' : 'flex-start',
        gap: '6px',
        flexWrap: 'wrap',
      }}
    >
      {showCount && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            background: COLORS.accent.cyan.base,
            color: COLORS.neutral[950],
            borderRadius: '4px',
            fontFamily: 'var(--tmnl-font-mono, monospace)',
            fontSize: 'var(--tmnl-text-xs, 12px)',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {users.length}
        </div>
      )}

      {visibleUsers.map((user, index) => (
        <UserBadge
          key={`${user.name}-${index}`}
          user={user}
          compact={isCompact}
        />
      ))}

      {overflowCount > 0 && (
        <OverflowBadge count={overflowCount} compact={isCompact} />
      )}
    </div>
  );
}

export default UserPresenceList;
