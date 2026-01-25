/**
 * TabBar Component
 *
 * Cyan-accented tab switcher for DynamicIslandCard.
 * Features spring animation for tab indicator and Dynamic Island aesthetics.
 *
 * @module morph-card/components/TabBar
 */

import { useContext, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { RegistryContext, useAtomValue } from '@effect-atom/atom-react';
import { cn } from '@/lib/utils';
import type { TabView, TabBarConfig } from '../schemas/tab-schemas';
import { tabsAtomFamily, cardTabStateFamily, setActiveTab } from '../atoms/tab-atoms';

// =============================================================================
// Props
// =============================================================================

export interface TabBarProps {
  /** Card ID for state binding */
  cardId: string;
  /** Tab bar configuration */
  config?: TabBarConfig;
  /** Additional className */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * TabBar - Cyan-accented tab switcher for DynamicIslandCard
 *
 * Features:
 * - Spring animation for tab indicator
 * - Cyan accent color (Dynamic Island aesthetic)
 * - Auto-hide when single tab
 * - Position: top or bottom
 */
export function TabBar({ cardId, config, className }: TabBarProps) {
  const registry = useContext(RegistryContext);

  // Atom subscriptions
  const tabsAtom = useMemo(() => tabsAtomFamily(cardId), [cardId]);
  const stateAtom = useMemo(() => cardTabStateFamily(cardId), [cardId]);

  const tabs = useAtomValue(tabsAtom);
  const cardState = useAtomValue(stateAtom);
  const activeTab = cardState.activeTab;

  const handleTabClick = useCallback(
    (tabId: string) => {
      setActiveTab(cardId, tabId, registry);
    },
    [cardId, registry]
  );

  // Auto-hide when single or no tabs
  if (config?.autoHide && tabs.length <= 1) {
    return null;
  }

  // No tabs registered yet
  if (tabs.length === 0) {
    return null;
  }

  const accentColor = config?.accentColor ?? 'rgb(0, 255, 255)'; // Cyan default

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-2 py-1',
        'bg-black/40 backdrop-blur-sm',
        'border-b border-cyan-500/20',
        className
      )}
      style={
        {
          '--tab-accent': accentColor,
        } as React.CSSProperties
      }
    >
      {tabs.map((tab) => (
        <TabButton
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTab}
          accentColor={accentColor}
          onClick={() => handleTabClick(tab.id)}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Tab Button
// =============================================================================

interface TabButtonProps {
  tab: TabView;
  isActive: boolean;
  accentColor: string;
  onClick: () => void;
}

function TabButton({ tab, isActive, accentColor, onClick }: TabButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={tab.disabled}
      className={cn(
        'relative px-3 py-1.5',
        'text-xs font-mono uppercase tracking-wider',
        'transition-colors duration-150',
        tab.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
        isActive ? 'text-white' : 'text-white/60 hover:text-white/80'
      )}
      whileTap={{ scale: 0.95 }}
    >
      <span className="relative inline-flex">
        <span>{tab.label}</span>

        {/* Active indicator */}
        {isActive && (
          <motion.span
            layoutId="tab-underline"
            className="absolute -bottom-1 left-0 right-0 h-0.5"
            style={{
              backgroundColor: accentColor,
              boxShadow: `0 0 10px ${accentColor}, 0 0 20px ${accentColor}`,
              borderRadius: 999,
              transformOrigin: 'center',
            }}
            initial={false}
            animate={{ scaleX: [1, 1.08, 1], scaleY: [1, 1.2, 1] }}
            transition={{
              layout: { type: 'spring', stiffness: 520, damping: 38, mass: 0.7 },
              duration: 0.22,
              times: [0, 0.5, 1],
              ease: [0.2, 0, 0.2, 1],
            }}
          />
        )}
      </span>
    </motion.button>
  );
}

export default TabBar;
