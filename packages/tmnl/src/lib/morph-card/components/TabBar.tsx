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
import { RegistryContext } from '@effect-atom/atom-react';
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

  const tabs = registry.get(tabsAtom);
  const cardState = registry.get(stateAtom);
  const activeTab = cardState.activeTab;

  // Auto-hide when single or no tabs
  if (config?.autoHide && tabs.length <= 1) {
    return null;
  }

  // No tabs registered yet
  if (tabs.length === 0) {
    return null;
  }

  const accentColor = config?.accentColor ?? 'rgb(0, 255, 255)'; // Cyan default

  const handleTabClick = useCallback(
    (tabId: string) => {
      setActiveTab(cardId, tabId, registry);
    },
    [cardId, registry]
  );

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
      {tab.label}

      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId={`tab-indicator-${tab.id}`}
          className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{ backgroundColor: accentColor }}
          initial={false}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 35,
          }}
        />
      )}
    </motion.button>
  );
}

export default TabBar;
