/**
 * EmbeddedBlockWrapper Compound Component
 *
 * Shared wrapper for embedded blocks providing:
 * - Foldable behavior (expanded/collapsed/minimized)
 * - Badge with icon and label
 * - Delete-key-only close (no X button)
 * - Settings/tabs panel
 *
 * USAGE:
 * ```tsx
 * <EmbeddedBlockWrapper
 *   nodeViewProps={nodeViewProps}
 *   badge={{ tag: 'map', label: 'Map', icon: MapPin }}
 *   tabs={[{ id: 'style', label: 'Style', content: <StyleSettings /> }]}
 * >
 *   <MapContent />
 * </EmbeddedBlockWrapper>
 * ```
 *
 * @module editor/v3/extensions/blocks/EmbeddedBlockWrapper
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { Atom, useAtomValue } from '@effect-atom/atom-react';
import { NodeViewWrapper } from '@tiptap/react';
import * as Collapsible from '@radix-ui/react-collapsible';
import * as Tabs from '@radix-ui/react-tabs';
import {
  ChevronDown,
  ChevronUp,
  Settings,
  Minus,
  GripVertical,
  Maximize2,
} from 'lucide-react';

import {
  VANTA_COLORS,
  VANTA_BORDERS,
  VANTA_SPACING,
  VANTA_TYPOGRAPHY,
  VANTA_ANIMATION,
} from '@/components/portal/tokens';

import type {
  EmbeddedBlockWrapperProps,
  EmbeddedBlockContextValue,
  BlockBadge,
  SettingsTab,
  FoldState,
} from './types';
import {
  getEmbeddedBlockAtoms,
  disposeEmbeddedBlockAtoms,
  createEmbeddedBlockActions,
  focusActions,
  isFocusModeAtom,
  focusedBlockIdAtom,
  saveBlockState,
  restoreBlockState,
} from './atoms';
import { FocusOverlay } from './FocusOverlay';

// =============================================================================
// Context
// =============================================================================

const EmbeddedBlockContext = createContext<EmbeddedBlockContextValue | null>(null);

export const useEmbeddedBlock = () => {
  const ctx = useContext(EmbeddedBlockContext);
  if (!ctx) {
    throw new Error('useEmbeddedBlock must be used within EmbeddedBlockWrapper');
  }
  return ctx;
};

// =============================================================================
// Badge Colors
// =============================================================================

const BADGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  map: {
    bg: VANTA_COLORS.accent.cyanGlow,
    text: VANTA_COLORS.accent.cyan,
    border: VANTA_COLORS.accent.cyanMuted,
  },
  '3d': {
    bg: VANTA_COLORS.accent.violetGlow,
    text: VANTA_COLORS.accent.violet,
    border: VANTA_COLORS.accent.violetMuted,
  },
  'data-grid': {
    bg: VANTA_COLORS.accent.amberGlow,
    text: VANTA_COLORS.accent.amber,
    border: VANTA_COLORS.accent.amberMuted,
  },
  chart: {
    bg: VANTA_COLORS.accent.emeraldGlow,
    text: VANTA_COLORS.accent.emerald,
    border: VANTA_COLORS.accent.emeraldMuted,
  },
  embed: {
    bg: VANTA_COLORS.surface.hover,
    text: VANTA_COLORS.text.secondary,
    border: VANTA_COLORS.surface.border,
  },
  media: {
    bg: VANTA_COLORS.accent.roseGlow,
    text: VANTA_COLORS.accent.rose,
    border: VANTA_COLORS.accent.roseMuted,
  },
  custom: {
    bg: VANTA_COLORS.surface.hover,
    text: VANTA_COLORS.text.primary,
    border: VANTA_COLORS.surface.border,
  },
};

// =============================================================================
// Main Component
// =============================================================================

export function EmbeddedBlockWrapper({
  nodeViewProps,
  badge,
  tabs = [],
  initialFoldState = 'expanded',
  allowMinimize = true,
  expandedHeight = 300,
  collapsedHeight = 80,
  children,
  onFoldChange,
  className = '',
}: EmbeddedBlockWrapperProps) {
  const { node, editor, selected, deleteNode } = nodeViewProps;
  const blockId = node.attrs.id || 'default';

  // Focus mode state - check if this block should be hidden
  const isFocusMode = useAtomValue(isFocusModeAtom);
  const focusedBlockId = useAtomValue(focusedBlockIdAtom);

  // Get atoms for this block instance (needed for state save before unmount)
  const atoms = useMemo(() => getEmbeddedBlockAtoms(blockId), [blockId]);

  // Sibling unmount logic: if focus mode is active and this block is NOT focused,
  // save state and unmount this block (return null) to declutter the UI
  if (isFocusMode && focusedBlockId !== blockId) {
    // Save current state before unmounting
    const currentState = Atom.get(atoms.stateAtom);
    saveBlockState(blockId, currentState);
    return null;
  }

  // Restore state on mount if there's saved state from a previous focus mode
  useEffect(() => {
    const savedState = restoreBlockState(blockId);
    if (savedState) {
      Atom.set(atoms.foldStateAtom, savedState.foldState);
      Atom.set(atoms.settingsOpenAtom, savedState.settingsOpen);
      Atom.set(atoms.activeTabAtom, savedState.activeTab);
    }
  }, [blockId, atoms]);
  const actions = useMemo(() => createEmbeddedBlockActions(atoms), [atoms]);

  // Subscribe to state
  const state = useAtomValue(atoms.stateAtom);
  const showControls = useAtomValue(atoms.showControlsAtom);
  const contentVisible = useAtomValue(atoms.contentVisibleAtom);
  const contentExpanded = useAtomValue(atoms.contentExpandedAtom);

  // Sync selected state from TipTap
  useEffect(() => {
    actions.setSelected(selected);
  }, [selected, actions]);

  // Set initial fold state
  useEffect(() => {
    if (initialFoldState !== 'expanded') {
      if (initialFoldState === 'collapsed') {
        actions.collapse();
      } else if (initialFoldState === 'minimized' && allowMinimize) {
        actions.minimize();
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => disposeEmbeddedBlockAtoms(blockId);
  }, [blockId]);

  // Notify on fold change
  useEffect(() => {
    onFoldChange?.(state.foldState);
  }, [state.foldState, onFoldChange]);

  // Handle delete key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selected && editor.isEditable) {
          e.preventDefault();
          e.stopPropagation();
          deleteNode();
        }
      }
    },
    [selected, editor.isEditable, deleteNode]
  );

  // Context value
  const contextValue: EmbeddedBlockContextValue = useMemo(
    () => ({
      state,
      badge,
      tabs,
      isEditable: editor.isEditable,
      actions: {
        toggleFold: actions.toggleFold,
        expand: actions.expand,
        collapse: actions.collapse,
        minimize: actions.minimize,
        toggleSettings: actions.toggleSettings,
        setActiveTab: actions.setActiveTab,
      },
    }),
    [state, badge, tabs, editor.isEditable, actions]
  );

  // Badge colors
  const badgeColors = BADGE_COLORS[badge.tag] || BADGE_COLORS.custom;

  // Calculate content height
  const contentHeight = contentExpanded
    ? expandedHeight
    : contentVisible
      ? collapsedHeight
      : 0;

  // Check if THIS block is the focused block (renders in FocusOverlay)
  const isThisBlockFocused = isFocusMode && focusedBlockId === blockId;

  return (
    <EmbeddedBlockContext.Provider value={contextValue}>
      {/* FocusOverlay portal - renders content full-viewport when this block is focused */}
      {isThisBlockFocused && (
        <FocusOverlay
          title={badge.label}
          icon={badge.icon}
          onExit={() => focusActions.exitFocus()}
        >
          <div style={{ height: '100%', padding: VANTA_SPACING['4'] }}>
            {children}
          </div>
        </FocusOverlay>
      )}

      {/* Normal inline editor rendering */}
      <NodeViewWrapper
        className={`tmnl-embedded-block ${className}`}
        data-type="embeddedBlock"
        data-block-tag={badge.tag}
        data-focused={isThisBlockFocused}
        contentEditable={false}
        onMouseEnter={() => actions.setHovered(true)}
        onMouseLeave={() => actions.setHovered(false)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        style={{
          margin: '16px 0',
          borderRadius: VANTA_BORDERS.radius.md,
          overflow: 'hidden',
          border: selected
            ? `1px solid ${badgeColors.border}`
            : `1px solid ${VANTA_COLORS.surface.border}`,
          transition: VANTA_ANIMATION.transition.colors,
          outline: 'none',
          // Dim the inline view when focused (content is in overlay)
          opacity: isThisBlockFocused ? 0.3 : 1,
          pointerEvents: isThisBlockFocused ? 'none' : 'auto',
        }}
      >
        {/* Header */}
        <Header
          badge={badge}
          badgeColors={badgeColors}
          showControls={showControls}
          foldState={state.foldState}
          settingsOpen={state.settingsOpen}
          allowMinimize={allowMinimize}
          hasTabs={tabs.length > 0}
          blockId={blockId}
          onToggleFold={actions.toggleFold}
          onMinimize={actions.minimize}
          onToggleSettings={actions.toggleSettings}
          onEnterFocus={() => focusActions.enterFocus(blockId)}
        />

        {/* Collapsible Content - hidden when focused (content is in overlay) */}
        {!isThisBlockFocused && (
          <Collapsible.Root open={contentVisible}>
            <Collapsible.Content
              style={{
                height: typeof contentHeight === 'number' ? `${contentHeight}px` : contentHeight,
                overflow: 'hidden',
                transition: 'height 200ms ease',
              }}
            >
              {/* Main content */}
              <div
                style={{
                  height: '100%',
                  opacity: contentExpanded ? 1 : 0.6,
                  transition: 'opacity 200ms ease',
                }}
              >
                {children}
              </div>
            </Collapsible.Content>
          </Collapsible.Root>
        )}

        {/* Focused indicator in inline view */}
        {isThisBlockFocused && (
          <div
            style={{
              padding: VANTA_SPACING['4'],
              textAlign: 'center',
              color: VANTA_COLORS.text.muted,
              fontSize: 'var(--tmnl-text-xs, 12px)',
              fontFamily: 'var(--tmnl-font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Expanded to full viewport — Press Esc to exit
          </div>
        )}

        {/* Settings Panel */}
        {state.settingsOpen && tabs.length > 0 && !isThisBlockFocused && (
          <SettingsPanel
            tabs={tabs}
            activeTab={state.activeTab}
            onTabChange={actions.setActiveTab}
          />
        )}
      </NodeViewWrapper>
    </EmbeddedBlockContext.Provider>
  );
}

// =============================================================================
// Header Sub-component
// =============================================================================

interface HeaderProps {
  badge: BlockBadge;
  badgeColors: { bg: string; text: string; border: string };
  showControls: boolean;
  foldState: FoldState;
  settingsOpen: boolean;
  allowMinimize: boolean;
  hasTabs: boolean;
  blockId: string;
  onToggleFold: () => void;
  onMinimize: () => void;
  onToggleSettings: () => void;
  onEnterFocus: () => void;
}

function Header({
  badge,
  badgeColors,
  showControls,
  foldState,
  settingsOpen,
  allowMinimize,
  hasTabs,
  blockId,
  onToggleFold,
  onMinimize,
  onToggleSettings,
  onEnterFocus,
}: HeaderProps) {
  const Icon = badge.icon;

  const buttonStyle: CSSProperties = {
    padding: VANTA_SPACING['1'],
    background: 'transparent',
    border: 'none',
    color: VANTA_COLORS.text.muted,
    cursor: 'pointer',
    borderRadius: VANTA_BORDERS.radius.sm,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: VANTA_ANIMATION.transition.colors,
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
        background: VANTA_COLORS.surface.elevated,
        borderBottom: `1px solid ${VANTA_COLORS.surface.border}`,
        opacity: showControls ? 1 : 0.6,
        transition: 'opacity 150ms ease',
      }}
    >
      {/* Left: Drag handle + Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: VANTA_SPACING['2'],
        }}
      >
        {/* Drag handle */}
        <div
          data-drag-handle
          style={{
            cursor: 'grab',
            color: VANTA_COLORS.text.muted,
            padding: VANTA_SPACING['1'],
            display: 'flex',
            alignItems: 'center',
          }}
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </div>

        {/* Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: VANTA_SPACING['1'],
            padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
            background: badgeColors.bg,
            border: `1px solid ${badgeColors.border}`,
            borderRadius: VANTA_BORDERS.radius.sm,
          }}
        >
          {Icon && <Icon size={12} className="shrink-0" style={{ color: badgeColors.text }} />}
          <span
            style={{
              ...VANTA_TYPOGRAPHY.preset.label,
              color: badgeColors.text,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {badge.label}
          </span>
        </div>
      </div>

      {/* Right: Controls */}
      <div style={{ display: 'flex', gap: VANTA_SPACING['1'] }}>
        {/* Focus/Expand button */}
        <button
          onClick={onEnterFocus}
          style={buttonStyle}
          title="Focus mode (expand to full viewport)"
        >
          <Maximize2 size={14} />
        </button>

        {/* Fold toggle */}
        <button
          onClick={onToggleFold}
          style={buttonStyle}
          title={foldState === 'expanded' ? 'Collapse' : 'Expand'}
        >
          {foldState === 'expanded' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Minimize button */}
        {allowMinimize && foldState !== 'minimized' && (
          <button onClick={onMinimize} style={buttonStyle} title="Minimize">
            <Minus size={14} />
          </button>
        )}

        {/* Settings toggle */}
        {hasTabs && (
          <button
            onClick={onToggleSettings}
            style={{
              ...buttonStyle,
              color: settingsOpen ? badgeColors.text : VANTA_COLORS.text.muted,
              background: settingsOpen ? badgeColors.bg : 'transparent',
            }}
            title="Settings"
          >
            <Settings size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Settings Panel Sub-component
// =============================================================================

interface SettingsPanelProps {
  tabs: readonly SettingsTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

function SettingsPanel({ tabs, activeTab, onTabChange }: SettingsPanelProps) {
  return (
    <div
      style={{
        borderTop: `1px solid ${VANTA_COLORS.surface.border}`,
        background: VANTA_COLORS.surface.default,
      }}
    >
      <Tabs.Root value={activeTab} onValueChange={onTabChange}>
        {/* Tab list */}
        <Tabs.List
          style={{
            display: 'flex',
            borderBottom: `1px solid ${VANTA_COLORS.surface.border}`,
          }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;

            return (
              <Tabs.Trigger
                key={tab.id}
                value={tab.id}
                style={{
                  padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['3']}`,
                  background: isActive
                    ? VANTA_COLORS.surface.elevated
                    : 'transparent',
                  border: 'none',
                  borderBottom: isActive
                    ? `2px solid ${VANTA_COLORS.accent.cyan}`
                    : '2px solid transparent',
                  color: isActive
                    ? VANTA_COLORS.text.primary
                    : VANTA_COLORS.text.muted,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: VANTA_SPACING['1'],
                  ...VANTA_TYPOGRAPHY.preset.label,
                  transition: VANTA_ANIMATION.transition.colors,
                }}
              >
                {Icon && <Icon size={12} />}
                {tab.label}
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>

        {/* Tab content */}
        {tabs.map((tab) => (
          <Tabs.Content
            key={tab.id}
            value={tab.id}
            style={{
              padding: VANTA_SPACING['3'],
            }}
          >
            {tab.content}
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </div>
  );
}

export default EmbeddedBlockWrapper;
