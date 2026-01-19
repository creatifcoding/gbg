/**
 * DynamicIslandCard Component
 *
 * MorphCard extended with tabbed views, server integration, and state caching.
 * Combines MorphCard's polymorphic container with Dynamic Island aesthetics.
 *
 * @module morph-card/components/DynamicIslandCard
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import { RegistryContext } from '@effect-atom/atom-react';
import { MorphCard } from './MorphCard';
import { TabBar } from './TabBar';
import type { TabView, TabBarConfig } from '../schemas/tab-schemas';
import type { CardMode, SizePreset } from '../schemas/card-state';
import type { MorphCardConfig } from '../schemas/animation-config';
import {
  tabsAtomFamily,
  cardTabStateFamily,
  setActiveTab,
  registerTab,
  unregisterTab,
} from '../atoms/tab-atoms';

// =============================================================================
// Context
// =============================================================================

interface DynamicIslandContextValue {
  cardId: string;
  activeTab: string;
  registerView: (tab: TabView) => void;
  unregisterView: (tabId: string) => void;
}

const DynamicIslandContext = createContext<DynamicIslandContextValue | null>(null);

/**
 * Hook to access DynamicIslandCard context
 * @throws Error if used outside DynamicIslandCard
 */
export function useDynamicIslandContext(): DynamicIslandContextValue {
  const ctx = useContext(DynamicIslandContext);
  if (!ctx) {
    throw new Error('useDynamicIslandContext must be used within DynamicIslandCard');
  }
  return ctx;
}

/**
 * Optional version that returns null if not in context
 */
export function useDynamicIslandContextOptional(): DynamicIslandContextValue | null {
  return useContext(DynamicIslandContext);
}

// =============================================================================
// Props
// =============================================================================

export interface DynamicIslandCardProps {
  /** Unique card identifier */
  cardId: string;
  /** Initial display mode (passed to MorphCard) */
  initialMode?: CardMode;
  /** Tab bar configuration */
  tabConfig?: TabBarConfig;
  /** MorphCard sizes (passed through) */
  sizes?: Partial<Record<CardMode, SizePreset>>;
  /** MorphCard config (passed through) */
  config?: Partial<MorphCardConfig>;
  /** Whether card is interactive */
  interactive?: boolean;
  /** Additional className */
  className?: string;
  /** Child elements (View components) */
  children: ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Mode change handler */
  onModeChange?: (mode: CardMode, previousMode: CardMode) => void;
}

// =============================================================================
// Component
// =============================================================================

/**
 * DynamicIslandCard - MorphCard extended with tabbed views
 *
 * Composition pattern: Wraps MorphCard with TabBar and view management.
 *
 * @example
 * ```tsx
 * <DynamicIslandCard cardId="status-card">
 *   <DynamicIslandCard.View id="data" label="Data">
 *     <DataView />
 *   </DynamicIslandCard.View>
 *   <DynamicIslandCard.View id="config" label="Config">
 *     <ConfigView />
 *   </DynamicIslandCard.View>
 * </DynamicIslandCard>
 * ```
 */
export function DynamicIslandCard({
  cardId,
  initialMode = 'default',
  tabConfig,
  sizes,
  config,
  interactive = true,
  className,
  children,
  onClick,
  onModeChange,
}: DynamicIslandCardProps) {
  const registry = useContext(RegistryContext);

  // Atom subscriptions
  const tabsAtom = useMemo(() => tabsAtomFamily(cardId), [cardId]);
  const stateAtom = useMemo(() => cardTabStateFamily(cardId), [cardId]);

  const tabs = registry.get(tabsAtom);
  const cardState = registry.get(stateAtom);
  const activeTab = cardState.activeTab;

  // Auto-select first tab if none active
  useEffect(() => {
    if (!activeTab && tabs.length > 0) {
      setActiveTab(cardId, tabs[0].id, registry);
    }
  }, [cardId, activeTab, tabs, registry]);

  // Tab registration functions
  const registerView = useCallback(
    (tab: TabView) => {
      registerTab(cardId, tab, registry);
    },
    [cardId, registry]
  );

  const unregisterView = useCallback(
    (tabId: string) => {
      unregisterTab(cardId, tabId, registry);
    },
    [cardId, registry]
  );

  const contextValue: DynamicIslandContextValue = useMemo(
    () => ({
      cardId,
      activeTab,
      registerView,
      unregisterView,
    }),
    [cardId, activeTab, registerView, unregisterView]
  );

  return (
    <DynamicIslandContext.Provider value={contextValue}>
      <MorphCard
        cardId={cardId}
        initialMode={initialMode}
        sizes={sizes}
        config={config}
        interactive={interactive}
        className={className}
        onClick={onClick}
        onModeChange={onModeChange}
      >
        {/* TabBar at top */}
        <TabBar cardId={cardId} config={tabConfig} />

        {/* Content area - renders active view */}
        <MorphCard.Content padding="md">{children}</MorphCard.Content>
      </MorphCard>
    </DynamicIslandContext.Provider>
  );
}

// =============================================================================
// View Compound Component
// =============================================================================

export interface DynamicIslandViewProps {
  /** Unique view identifier */
  id: string;
  /** Tab label */
  label: string;
  /** Optional icon name */
  icon?: string;
  /** Disabled state */
  disabled?: boolean;
  /** View content */
  children: ReactNode;
}

/**
 * DynamicIslandCard.View - Defines a tabbed view within the card
 *
 * Registers itself with parent context and only renders when active.
 */
function DynamicIslandView({
  id,
  label,
  icon,
  disabled,
  children,
}: DynamicIslandViewProps) {
  const { activeTab, registerView, unregisterView } = useDynamicIslandContext();

  // Register tab on mount, unregister on unmount
  useEffect(() => {
    registerView({ _tag: 'TabView', id, label, icon, disabled });
    return () => unregisterView(id);
  }, [id, label, icon, disabled, registerView, unregisterView]);

  // Only render if this view is active
  if (activeTab !== id) {
    return null;
  }

  return <>{children}</>;
}

// Attach compound component
DynamicIslandCard.View = DynamicIslandView;

export default DynamicIslandCard;
