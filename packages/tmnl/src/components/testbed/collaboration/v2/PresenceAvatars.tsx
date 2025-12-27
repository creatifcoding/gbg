/**
 * Discord-style stacked presence avatars
 * Hover to expand, shows active users per document
 *
 * Uses TMNL Vanta design tokens.
 *
 * @module testbed/collaboration/v2/PresenceAvatars
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

import {
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
  VANTA_SPACING,
  VANTA_BORDERS,
  VANTA_ANIMATION,
} from '@/components/portal/tokens';

// =============================================================================
// Types
// =============================================================================

export interface User {
  id: string;
  name: string;
  color: string;
  isOnline?: boolean;
}

interface PresenceAvatarsProps {
  users: User[];
  maxVisible?: number;
  size?: 'sm' | 'md';
}

// =============================================================================
// Size Config
// =============================================================================

const sizeMap = {
  sm: { avatar: 24, font: 10, overlap: -8 },
  md: { avatar: 32, font: 12, overlap: -10 },
};

// =============================================================================
// PresenceAvatars Component
// =============================================================================

export function PresenceAvatars({
  users,
  maxVisible = 4,
  size = 'sm',
}: PresenceAvatarsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const dims = sizeMap[size];

  const visibleUsers = users.slice(0, maxVisible);
  const overflowCount = Math.max(0, users.length - maxVisible);

  if (users.length === 0) {
    return (
      <div
        style={{
          fontSize: dims.font,
          color: VANTA_COLORS.text.muted,
          fontFamily: VANTA_TYPOGRAPHY.family.sans,
        }}
      >
        No users
      </div>
    );
  }

  return (
    <motion.div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
      }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Stacked avatars */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <AnimatePresence mode="popLayout">
          {visibleUsers.map((user, index) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, scale: 0.8, x: -10 }}
              animate={{
                opacity: 1,
                scale: 1,
                x: 0,
                marginLeft: index === 0 ? 0 : dims.overlap,
              }}
              exit={{ opacity: 0, scale: 0.8, x: -10 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              style={{
                width: dims.avatar,
                height: dims.avatar,
                borderRadius: '50%',
                backgroundColor: user.color,
                border: `2px solid ${VANTA_COLORS.surface.base}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: dims.font,
                fontWeight: VANTA_TYPOGRAPHY.weight.semibold,
                color: 'white',
                textTransform: 'uppercase',
                fontFamily: VANTA_TYPOGRAPHY.family.sans,
                position: 'relative',
                zIndex: visibleUsers.length - index,
                cursor: 'default',
              }}
              title={user.name}
            >
              {user.name.charAt(0)}
              {/* Online indicator */}
              {user.isOnline !== false && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: -1,
                    right: -1,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: VANTA_COLORS.accent.emerald,
                    border: `2px solid ${VANTA_COLORS.surface.base}`,
                  }}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Overflow badge */}
        {overflowCount > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1, marginLeft: dims.overlap }}
            style={{
              width: dims.avatar,
              height: dims.avatar,
              borderRadius: '50%',
              backgroundColor: VANTA_COLORS.surface.elevated,
              border: VANTA_BORDERS.style.default,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: dims.font - 1,
              fontWeight: VANTA_TYPOGRAPHY.weight.medium,
              color: VANTA_COLORS.text.secondary,
              fontFamily: VANTA_TYPOGRAPHY.family.sans,
              position: 'relative',
              zIndex: 0,
            }}
          >
            +{overflowCount}
          </motion.div>
        )}
      </div>

      {/* Expanded dropdown */}
      <AnimatePresence>
        {isExpanded && users.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 8,
              backgroundColor: VANTA_COLORS.surface.base,
              border: VANTA_BORDERS.style.default,
              borderRadius: VANTA_BORDERS.radius.md,
              padding: VANTA_SPACING['1.5'],
              minWidth: 140,
              boxShadow: VANTA_BORDERS.shadow.elevated,
              backdropFilter: 'blur(12px)',
              zIndex: 100,
            }}
          >
            {users.map((user) => (
              <div
                key={user.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: VANTA_SPACING['2'],
                  padding: `${VANTA_SPACING['1.5']} ${VANTA_SPACING['2']}`,
                  borderRadius: VANTA_BORDERS.radius.sm,
                  transition: VANTA_ANIMATION.transition.colors,
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    backgroundColor: user.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: VANTA_TYPOGRAPHY.weight.semibold,
                    color: 'white',
                    textTransform: 'uppercase',
                  }}
                >
                  {user.name.charAt(0)}
                </div>
                <span
                  style={{
                    ...VANTA_TYPOGRAPHY.preset.cardSubtitle,
                    color: VANTA_COLORS.text.primary,
                  }}
                >
                  {user.name}
                </span>
                {user.isOnline !== false && (
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: VANTA_COLORS.accent.emerald,
                      marginLeft: 'auto',
                    }}
                  />
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
