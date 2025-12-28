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
  useState,
  useRef,
  type ReactNode,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Atom, useAtomValue } from '@effect-atom/atom-react';
import { NodeViewWrapper } from '@tiptap/react';

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
  BlockTag,
} from './types';
import {
  getEmbeddedBlockAtoms,
  disposeEmbeddedBlockAtoms,
  useEmbeddedBlockActions,
  useFocusActions,
  isFocusModeAtom,
  focusedBlockIdAtom,
  saveBlockState,
  restoreBlockState,
} from './atoms';
import { FocusOverlay } from './FocusOverlay';
// v4: Using new BlockNameBadge with storyboard animations
// Reference implementations kept: BlockNameBadge.tsx (v2), BlockNameBadge.v3.tsx
import { BlockNameBadge } from './BlockNameBadge/index';
import type { BlockId, BlockType } from './shared';
import { useBlockRegistryOptional } from './registry';

// =============================================================================
// BlockTag → BlockType Mapping
// =============================================================================

/**
 * Maps UI BlockTag to registry BlockType.
 * BlockType is a subset for categorization; tags like '3d' map to 'custom'.
 */
function tagToBlockType(tag: BlockTag): BlockType {
  switch (tag) {
    case 'map':
      return 'map';
    case 'chart':
      return 'chart';
    case 'data-grid':
      return 'table';
    case 'embed':
      return 'embed';
    case '3d':
    case 'media':
    case 'custom':
    default:
      return 'custom';
  }
}

// =============================================================================
// Context
// =============================================================================

const EmbeddedBlockContext = createContext<EmbeddedBlockContextValue | null>(
  null
);

export const useEmbeddedBlock = () => {
  const ctx = useContext(EmbeddedBlockContext);
  if (!ctx) {
    throw new Error(
      'useEmbeddedBlock must be used within EmbeddedBlockWrapper'
    );
  }
  return ctx;
};

// =============================================================================
// Badge Colors
// =============================================================================

const BADGE_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
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
  const blockId = node.attrs['id'] || 'default';

  // Focus mode state - check if this block should be hidden
  const isFocusMode = useAtomValue(isFocusModeAtom);
  const focusedBlockId = useAtomValue(focusedBlockIdAtom);

  // Get atoms for this block instance
  const atoms = useMemo(() => getEmbeddedBlockAtoms(blockId), [blockId]);

  const actions = useEmbeddedBlockActions(atoms);
  const focusActions = useFocusActions();
  const blockRegistry = useBlockRegistryOptional();

  const handleRename = useMemo(() => {
    if (!blockRegistry?.isAvailable) return undefined;
    return async (newName: string) => {
      await blockRegistry.ops.rename(blockId as BlockId, newName);
    };
  }, [blockRegistry, blockId]);

  // Subscribe to state
  const state = useAtomValue(atoms.stateAtom);

  // Sibling visibility logic: if focus mode is active and this block is NOT focused,
  // HIDE (don't unmount!) to preserve WebGL contexts and other heavy resources
  const isHiddenByFocus = isFocusMode && focusedBlockId !== blockId;

  // Save state when entering hidden mode (for potential future restoration)
  useEffect(() => {
    if (isHiddenByFocus) {
      saveBlockState(blockId, state);
    }
  }, [isHiddenByFocus, blockId, state]);

  // Restore state on mount if there's saved state from a previous focus mode
  useEffect(() => {
    const savedState = restoreBlockState(blockId);
    if (savedState) {
      if (savedState.foldState === 'collapsed') {
        actions.collapse();
      } else if (savedState.foldState === 'minimized') {
        actions.minimize();
      } else {
        actions.expand();
      }
      if (savedState.settingsOpen) {
        actions.toggleSettings();
      }
      if (savedState.activeTab !== 'general') {
        actions.setActiveTab(savedState.activeTab);
      }
    }
  }, [blockId]);
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

  // BlockRegistry lifecycle: register on mount, unregister on unmount
  useEffect(() => {
    if (!blockRegistry?.isAvailable) return;

    const blockType = tagToBlockType(badge.tag);

    blockRegistry.ops.register(blockId as BlockId, blockType).catch((err) => {
      console.warn(
        `[EmbeddedBlockWrapper] Failed to register block ${blockId}:`,
        err
      );
    });

    return () => {
      blockRegistry.ops.unregister(blockId as BlockId).catch((err) => {
        console.warn(
          `[EmbeddedBlockWrapper] Failed to unregister block ${blockId}:`,
          err
        );
      });
    };
  }, [blockId, badge.tag, blockRegistry]);

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
        connectStream: () => actions.setStreamStatus('connecting'),
        disconnectStream: () => actions.setStreamStatus('idle'),
        reconnectStream: () => actions.setStreamStatus('connecting'),
      },
    }),
    [state, badge, tabs, editor.isEditable, actions]
  );

  const badgeColors = BADGE_COLORS[badge.tag] || BADGE_COLORS['custom'];

  const isThisBlockFocused = isFocusMode && focusedBlockId === blockId;
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isThisBlockFocused) {
      const handleKeyDown = (e: globalThis.KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          focusActions.exitFocus();
        }
      };
      document.addEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleKeyDown, true);
        document.body.style.overflow = '';
      };
    }
    return undefined;
  }, [isThisBlockFocused]);

  const focusOverlayChrome = isThisBlockFocused
    ? createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            backgroundColor: VANTA_COLORS.surface.void,
            opacity: 0.95,
          }}
          onClick={() => focusActions.exitFocus()}
        />,
        document.body
      )
    : null;

  const focusOverlayHeader = isThisBlockFocused
    ? createPortal(
        <div
          style={{
            position: 'fixed',
            top: VANTA_SPACING['8'],
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            gap: VANTA_SPACING['3'],
            padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['4']}`,
            backgroundColor: VANTA_COLORS.surface.elevated,
            borderRadius: VANTA_BORDERS.radius.md,
            border: `1px solid ${VANTA_COLORS.surface.border}`,
          }}
        >
          <span style={{ color: VANTA_COLORS.text.muted, display: 'flex' }}>
            <Maximize2 size={14} />
          </span>
          {badge.icon && (
            <span style={{ color: badgeColors.text, display: 'flex' }}>
              <badge.icon size={14} className="shrink-0" />
            </span>
          )}
          <span
            style={{
              color: VANTA_COLORS.text.secondary,
              fontSize: 'var(--tmnl-text-xs, 12px)',
              fontFamily: 'var(--tmnl-font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {badge.label} — Press Esc to exit
          </span>
        </div>,
        document.body
      )
    : null;

  return (
    <EmbeddedBlockContext.Provider value={contextValue}>
      {focusOverlayChrome}
      {focusOverlayHeader}

      <NodeViewWrapper
        className={`tmnl-embedded-block ${className}`}
        data-type="embeddedBlock"
        data-block-tag={badge.tag}
        data-focused={isThisBlockFocused}
        data-hidden-by-focus={isHiddenByFocus}
        contentEditable={false}
        onMouseEnter={() => actions.setHovered(true)}
        onMouseLeave={() => actions.setHovered(false)}
        onKeyDown={handleKeyDown}
        tabIndex={isHiddenByFocus ? -1 : 0}
        style={{
          margin: isThisBlockFocused ? 0 : '16px 0',
          borderRadius: VANTA_BORDERS.radius.md,
          overflow: isThisBlockFocused ? 'visible' : 'hidden',
          border: isThisBlockFocused
            ? 'none'
            : selected
            ? `1px solid ${badgeColors.border}`
            : `1px solid ${VANTA_COLORS.surface.border}`,
          transition: isThisBlockFocused
            ? 'none'
            : VANTA_ANIMATION.transition.colors,
          outline: 'none',
          pointerEvents: isHiddenByFocus ? 'none' : 'auto',
          display: isHiddenByFocus ? 'none' : undefined,
          ...(isThisBlockFocused && {
            position: 'fixed' as const,
            inset: VANTA_SPACING['8'],
            zIndex: 9999,
            margin: 'auto',
            maxWidth: '1400px',
            maxHeight: '900px',
            backgroundColor: VANTA_COLORS.surface.default,
            border: `1px solid ${VANTA_COLORS.surface.border}`,
            boxShadow: `0 0 80px ${VANTA_COLORS.accent.cyanGlow}`,
            overflow: 'hidden',
          }),
        }}
      >
        {!isThisBlockFocused && (
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
            onRename={handleRename}
          />
        )}

        <div
          style={{
            position: 'relative',
            height: isThisBlockFocused
              ? '100%'
              : state.foldState === 'minimized'
              ? 0
              : contentExpanded
              ? expandedHeight
              : collapsedHeight,
            overflow: 'hidden',
            transition: isThisBlockFocused ? 'none' : 'height 200ms ease',
          }}
        >
          {/* WebGL preservation: absolute positioning keeps dimensions for WebGL while parent collapses */}
          <div
            ref={contentRef}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
            style={{
              position:
                state.foldState === 'minimized' ? 'absolute' : 'relative',
              top: 0,
              left: 0,
              width: '100%',
              height:
                state.foldState === 'minimized'
                  ? collapsedHeight
                  : isThisBlockFocused
                  ? '100%'
                  : contentExpanded
                  ? expandedHeight
                  : collapsedHeight,
              visibility:
                state.foldState === 'minimized' ? 'hidden' : 'visible',
              pointerEvents: state.foldState === 'minimized' ? 'none' : 'auto',
              opacity: isThisBlockFocused || contentExpanded ? 1 : 0.6,
              transition: 'opacity 200ms ease',
              padding: isThisBlockFocused ? VANTA_SPACING['4'] : undefined,
            }}
          >
            {children}
          </div>
        </div>

        {!isThisBlockFocused && state.settingsOpen && tabs.length > 0 && (
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
// HeaderButton Sub-component (with visual feedback + debug tracing)
// =============================================================================

interface HeaderButtonProps {
  onClick: () => void;
  title: string;
  debugLabel: string;
  isActive?: boolean;
  activeColor?: string;
  activeBg?: string;
  children: ReactNode;
}

function HeaderButton({
  onClick,
  title,
  debugLabel,
  isActive = false,
  activeColor,
  activeBg,
  children,
}: HeaderButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPressed(true);
    console.log(`[EmbeddedBlockWrapper] 🔘 Button PRESSED: ${debugLabel}`);
  };

  const handleMouseUp = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPressed) {
      console.log(
        `[EmbeddedBlockWrapper] ✅ Button RELEASED: ${debugLabel} — calling handler`
      );
      onClick();
      console.log(
        `[EmbeddedBlockWrapper] ✅ Button HANDLER COMPLETE: ${debugLabel}`
      );
    }
    setIsPressed(false);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (isPressed) {
      console.log(
        `[EmbeddedBlockWrapper] ⚠️ Button CANCELLED (mouse left): ${debugLabel}`
      );
      setIsPressed(false);
    }
  };

  // Compute styles based on state
  const baseColor = VANTA_COLORS.text.muted;
  const hoverColor = VANTA_COLORS.text.primary;
  const pressedColor = activeColor || VANTA_COLORS.accent.cyan;

  const baseBg = 'transparent';
  const hoverBg = VANTA_COLORS.surface.raised;
  const pressedBg = activeBg || VANTA_COLORS.accent.cyanGlow;

  let currentColor: string = baseColor;
  let currentBg: string = baseBg;
  let currentTransform = 'scale(1)';
  let currentBoxShadow = 'none';

  if (isActive) {
    currentColor = activeColor || VANTA_COLORS.accent.cyan;
    currentBg = activeBg || VANTA_COLORS.accent.cyanGlow;
  }

  if (isHovered && !isPressed) {
    currentColor = hoverColor;
    currentBg = hoverBg;
    currentBoxShadow = `0 0 0 1px ${VANTA_COLORS.surface.border}`;
  }

  if (isPressed) {
    currentColor = pressedColor;
    currentBg = pressedBg;
    currentTransform = 'scale(0.92)';
    currentBoxShadow = `0 0 0 2px ${pressedColor}`;
  }

  return (
    <button
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      title={title}
      style={{
        padding: VANTA_SPACING['1'],
        background: currentBg,
        border: 'none',
        color: currentColor,
        cursor: 'pointer',
        borderRadius: VANTA_BORDERS.radius.sm,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: `all ${VANTA_ANIMATION.duration.fast} ${VANTA_ANIMATION.easing.default}`,
        transform: currentTransform,
        boxShadow: currentBoxShadow,
        outline: 'none',
      }}
    >
      {children}
    </button>
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
  blockId: BlockId;
  onToggleFold: () => void;
  onMinimize: () => void;
  onToggleSettings: () => void;
  onEnterFocus: () => void;
  onRename?: (newName: string) => Promise<void>;
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
  onRename,
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
          {Icon && (
            <span style={{ color: badgeColors.text, display: 'flex' }}>
              <Icon size={12} className="shrink-0" />
            </span>
          )}
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

        <BlockNameBadge blockId={blockId} onRename={onRename} />
      </div>

      {/* Right: Controls */}
      <div style={{ display: 'flex', gap: VANTA_SPACING['1'] }}>
        {/* Focus/Expand button */}
        <HeaderButton
          onClick={onEnterFocus}
          title="Focus mode (expand to full viewport)"
          debugLabel={`Focus [${blockId}]`}
        >
          <Maximize2 size={14} />
        </HeaderButton>

        {/* Fold toggle */}
        <HeaderButton
          onClick={onToggleFold}
          title={foldState === 'expanded' ? 'Collapse' : 'Expand'}
          debugLabel={`ToggleFold [${blockId}] (current: ${foldState})`}
        >
          {foldState === 'expanded' ? (
            <ChevronUp size={14} />
          ) : (
            <ChevronDown size={14} />
          )}
        </HeaderButton>

        {/* Minimize button */}
        {allowMinimize && foldState !== 'minimized' && (
          <HeaderButton
            onClick={onMinimize}
            title="Minimize"
            debugLabel={`Minimize [${blockId}]`}
          >
            <Minus size={14} />
          </HeaderButton>
        )}

        {/* Settings toggle */}
        {hasTabs && (
          <HeaderButton
            onClick={onToggleSettings}
            title="Settings"
            debugLabel={`ToggleSettings [${blockId}]`}
            isActive={settingsOpen}
            activeColor={badgeColors.text}
            activeBg={badgeColors.bg}
          >
            <Settings size={14} />
          </HeaderButton>
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
