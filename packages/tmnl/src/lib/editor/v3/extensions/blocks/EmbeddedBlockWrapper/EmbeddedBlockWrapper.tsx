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
import { Atom, useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { NodeViewWrapper } from '@tiptap/react';

import * as Tabs from '@radix-ui/react-tabs';
import {
  ChevronDown,
  ChevronUp,
  Settings,
  Minus,
  GripVertical,
  Maximize2,
  Trash2,
  GripHorizontal,
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
  DataplaneState,
  PortConfig,
} from './types';
import {
  useDataplane,
  LinkPortIndicator,
  pendingLinkSourceAtom,
  isLinkingAtom,
  hoveredPortAtom,
  hoveredBlockIdAtom,
  dataplaneOps,
  portsByIdAtom,
  type LinkPort,
  type PortId,
  type BlockId as DataplaneBlockId,
  type PortPosition,
} from '@/lib/dataplane';
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
import { LinksTab } from './LinksTab';
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

export const EmbeddedBlockContext = createContext<EmbeddedBlockContextValue | null>(
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
  dataplaneConfig,
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

  // Dataplane atom setters - must use hooks for React registry
  const setHoveredBlockId = useAtomSet(hoveredBlockIdAtom);
  const setPendingLinkSource = useAtomSet(pendingLinkSourceAtom);
  const setHoveredPort = useAtomSet(hoveredPortAtom);

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
  const customHeight = useAtomValue(atoms.customHeightAtom);
  const settingsExpanded = useAtomValue(atoms.settingsExpandedAtom);

  // Compute effective height: customHeight overrides default when expanded
  const effectiveExpandedHeight = customHeight ?? expandedHeight;

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

  // ---------------------------------------------------------------------------
  // Dataplane Port Registration
  // ---------------------------------------------------------------------------
  const { registerPort: dpRegisterPort, unregisterPort: dpUnregisterPort } = useDataplane();
  const [registeredPorts, setRegisteredPorts] = useState<LinkPort[]>([]);
  const [portIdByPosition, setPortIdByPosition] = useState<Map<PortPosition, PortId>>(
    new Map()
  );

  // Use refs to avoid effect re-runs when dataplane functions change reference
  const registerPortRef = useRef(dpRegisterPort);
  const unregisterPortRef = useRef(dpUnregisterPort);
  useEffect(() => {
    registerPortRef.current = dpRegisterPort;
    unregisterPortRef.current = dpUnregisterPort;
  });

  // Register ports on mount, unregister on unmount
  useEffect(() => {
    if (!dataplaneConfig?.enabled || !dataplaneConfig.ports?.length) {
      return;
    }

    const ports: LinkPort[] = [];
    const positionMap = new Map<PortPosition, PortId>();

    // Register all configured ports
    const registerAll = async () => {
      for (const portConfig of dataplaneConfig.ports!) {
        try {
          const port = await registerPortRef.current({
            blockId: blockId as DataplaneBlockId,
            direction: portConfig.direction,
            dataType: portConfig.dataType,
            position: portConfig.position,
            label: portConfig.label,
          });

          if (port) {
            ports.push(port);
            positionMap.set(portConfig.position, port.id);
          }
        } catch (err) {
          console.warn(
            `[EmbeddedBlockWrapper] Failed to register port at ${portConfig.position}:`,
            err
          );
        }
      }

      setRegisteredPorts(ports);
      setPortIdByPosition(positionMap);
    };

    registerAll();

    // Cleanup: unregister all ports
    // NOTE: Don't call setState here - triggers infinite re-render loops during unmount.
    // State is garbage collected on unmount, and re-registration overwrites on dependency change.
    return () => {
      for (const port of ports) {
        unregisterPortRef.current(port.id).catch((err) => {
          console.warn(
            `[EmbeddedBlockWrapper] Failed to unregister port ${port.id}:`,
            err
          );
        });
      }
    };
    // Only re-run when blockId or dataplaneConfig changes, not when dataplane functions change
  }, [blockId, dataplaneConfig?.enabled, dataplaneConfig?.ports]);

  // Compute dataplane state for context
  const dataplaneState: DataplaneState | undefined = useMemo(() => {
    if (!dataplaneConfig?.enabled) return undefined;

    return {
      ports: registeredPorts,
      portIdByPosition,
      isReady: registeredPorts.length === (dataplaneConfig.ports?.length ?? 0),
    };
  }, [dataplaneConfig?.enabled, dataplaneConfig?.ports?.length, registeredPorts, portIdByPosition]);

  // Combine user-provided tabs with automatic LinksTab when dataplane is enabled
  const combinedTabs = useMemo(() => {
    if (!dataplaneConfig?.enabled) return tabs;

    const linksTab: SettingsTab = {
      id: 'links',
      label: 'Links',
      icon: undefined, // Using Link2 inside LinksTab
      content: <LinksTab ports={registeredPorts} blockId={blockId} />,
    };

    // Add Links tab at the end
    return [...tabs, linksTab];
  }, [tabs, dataplaneConfig?.enabled, registeredPorts, blockId]);

  // ---------------------------------------------------------------------------
  // Click-to-Connect Port Linking
  // ---------------------------------------------------------------------------
  const isLinking = useAtomValue(isLinkingAtom);
  const pendingSourcePortId = useAtomValue(pendingLinkSourceAtom);
  const portsById = useAtomValue(portsByIdAtom);

  /**
   * Handle port click for linking:
   * - First click: set as source port (start linking)
   * - Second click on different port: create link
   * - Click same port: cancel linking
   */
  const handlePortClick = useCallback(
    async (clickedPortId: PortId) => {
      if (!pendingSourcePortId) {
        // No link in progress — start linking from this port
        setPendingLinkSource(clickedPortId);
        console.log(`[Dataplane] Started linking from port ${clickedPortId}`);
      } else if (pendingSourcePortId === clickedPortId) {
        // Clicked same port — cancel linking
        setPendingLinkSource(null);
        console.log('[Dataplane] Linking cancelled');
      } else {
        // Different port — attempt to create link
        const sourcePort = portsById.get(pendingSourcePortId);
        const targetPort = portsById.get(clickedPortId);

        if (!sourcePort || !targetPort) {
          console.warn('[Dataplane] Port not found for linking');
          setPendingLinkSource(null);
          return;
        }

        // Validate: source must be output, target must be input (or inout)
        const isValidSource =
          sourcePort.direction === 'out' || sourcePort.direction === 'inout';
        const isValidTarget =
          targetPort.direction === 'in' || targetPort.direction === 'inout';

        if (!isValidSource || !isValidTarget) {
          console.warn(
            `[Dataplane] Invalid link: source=${sourcePort.direction}, target=${targetPort.direction}`
          );
          setPendingLinkSource(null);
          return;
        }

        try {
          await dataplaneOps.createLink({
            sourcePort: pendingSourcePortId,
            targetPort: clickedPortId,
            direction: 'unidirectional',
            relationship: 'pipe',
          });
          console.log(
            `[Dataplane] Created link: ${pendingSourcePortId} → ${clickedPortId}`
          );
        } catch (err) {
          console.error('[Dataplane] Failed to create link:', err);
        } finally {
          setPendingLinkSource(null);
        }
      }
    },
    [pendingSourcePortId, portsById]
  );

  /**
   * Handle port hover for visual feedback during linking
   */
  const handlePortHover = useCallback(
    (portId: PortId | null) => {
      if (isLinking) {
        setHoveredPort(portId);
      }
    },
    [isLinking]
  );

  // Notify on fold change
  useEffect(() => {
    onFoldChange?.(state.foldState);
  }, [state.foldState, onFoldChange]);

  // Resize state tracking
  const currentHeightRef = useRef(effectiveExpandedHeight);

  // Update ref when effectiveExpandedHeight changes
  useEffect(() => {
    currentHeightRef.current = effectiveExpandedHeight;
  }, [effectiveExpandedHeight]);

  // Resize handlers for adjustable height
  const handleResize = useCallback(
    (deltaY: number) => {
      const MIN_HEIGHT = 80;
      const MAX_HEIGHT = 800;
      const newHeight = Math.max(
        MIN_HEIGHT,
        Math.min(MAX_HEIGHT, currentHeightRef.current + deltaY)
      );
      currentHeightRef.current = newHeight;
      actions.setCustomHeight(newHeight);
    },
    [actions]
  );

  const handleResizeEnd = useCallback(() => {
    // Height is already persisted via atom, this is for any cleanup
    console.log(
      `[EmbeddedBlockWrapper] Resize complete: ${currentHeightRef.current}px`
    );
  }, []);

  // Block node protection: Prevent keyboard deletion
  // Nodes can ONLY be deleted via explicit UI (trash button in header)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selected) {
          // Stop deletion propagation — protect the node
          e.preventDefault();
          e.stopPropagation();
          // Do NOT call deleteNode() — explicit UI only
        }
      }
    },
    [selected]
  );

  // Context value
  const contextValue: EmbeddedBlockContextValue = useMemo(
    () => ({
      state,
      badge,
      tabs: combinedTabs,
      isEditable: editor.isEditable,
      dataplane: dataplaneState,
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
    [state, badge, combinedTabs, editor.isEditable, actions, dataplaneState]
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
        data-block-id={blockId}
        data-block-tag={badge.tag}
        data-focused={isThisBlockFocused}
        data-hidden-by-focus={isHiddenByFocus}
        data-settings-expanded={settingsExpanded}
        contentEditable={false}
        onMouseEnter={() => {
          actions.setHovered(true);
          setHoveredBlockId(blockId);
        }}
        onMouseLeave={() => {
          actions.setHovered(false);
          setHoveredBlockId(null);
        }}
        onKeyDown={handleKeyDown}
        tabIndex={isHiddenByFocus ? -1 : 0}
        style={{
          margin: isThisBlockFocused ? 0 : '16px 0',
          borderRadius: VANTA_BORDERS.radius.md,
          // Overflow visible when hovered (for port indicators) or focused
          overflow: isThisBlockFocused || state.isHovered ? 'visible' : 'hidden',
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
          display: isHiddenByFocus ? 'none' : settingsExpanded ? 'flex' : undefined,
          flexDirection: settingsExpanded ? 'column' : undefined,
          minHeight: settingsExpanded ? effectiveExpandedHeight + 100 : undefined,
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
            onDelete={() => {
              // Use editor chain with meta to bypass node protection
              editor
                .chain()
                .focus()
                .command(({ tr }) => {
                  tr.setMeta('allowProtectedNodeDeletion', true);
                  return true;
                })
                .deleteNode(node.type.name)
                .run();
            }}
          />
        )}

        {/* Dataplane Port Indicators - OUTSIDE overflow:hidden for visibility */}
        {dataplaneConfig?.enabled &&
          dataplaneConfig.showIndicators !== false &&
          state.foldState !== 'minimized' &&
          registeredPorts.map((port) => (
            <LinkPortIndicator
              key={port.id}
              portId={port.id}
              blockId={blockId as DataplaneBlockId}
              position={port.position}
              direction={port.direction}
              dataType={port.dataType}
              isPendingSource={pendingSourcePortId === port.id}
              onClick={() => handlePortClick(port.id)}
              onMouseEnter={() => handlePortHover(port.id)}
              onMouseLeave={() => handlePortHover(null)}
            />
          ))}

        <div
          style={{
            position: 'relative',
            height: isThisBlockFocused
              ? '100%'
              : settingsExpanded
              ? 0
              : state.foldState === 'minimized'
              ? 0
              : contentExpanded
              ? effectiveExpandedHeight
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
                  ? effectiveExpandedHeight
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

          {/* Resize handle - only show when expanded and not in focus mode */}
          {!isThisBlockFocused && contentExpanded && (
            <ResizeHandle
              onResize={handleResize}
              onResizeEnd={handleResizeEnd}
              minHeight={80}
              maxHeight={800}
            />
          )}
        </div>

        {!isThisBlockFocused && state.settingsOpen && combinedTabs.length > 0 && (
          <SettingsPanel
            tabs={combinedTabs}
            activeTab={state.activeTab}
            onTabChange={actions.setActiveTab}
            expanded={settingsExpanded}
            onToggleExpanded={actions.toggleSettingsExpanded}
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
  /** Explicit delete handler (bypasses keyboard protection) */
  onDelete: () => void;
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
  onDelete,
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

        {/* Delete button — explicit UI deletion (bypasses keyboard protection) */}
        <HeaderButton
          onClick={onDelete}
          title="Delete block"
          debugLabel={`Delete [${blockId}]`}
          activeColor={VANTA_COLORS.accent.rose}
          activeBg={VANTA_COLORS.accent.roseGlow}
        >
          <Trash2 size={14} />
        </HeaderButton>
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
  expanded?: boolean;
  onToggleExpanded?: () => void;
}

function SettingsPanel({
  tabs,
  activeTab,
  onTabChange,
  expanded = false,
  onToggleExpanded,
}: SettingsPanelProps) {
  return (
    <div
      style={{
        borderTop: `1px solid ${VANTA_COLORS.surface.border}`,
        background: VANTA_COLORS.surface.default,
        display: 'flex',
        flexDirection: 'column',
        ...(expanded && {
          flex: 1,
          minHeight: '300px',
        }),
      }}
    >
      <Tabs.Root
        value={activeTab}
        onValueChange={onTabChange}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: expanded ? '100%' : undefined,
        }}
      >
        {/* Tab list with expand button */}
        <Tabs.List
          style={{
            display: 'flex',
            borderBottom: `1px solid ${VANTA_COLORS.surface.border}`,
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'thin',
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
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  ...VANTA_TYPOGRAPHY.preset.label,
                  transition: VANTA_ANIMATION.transition.colors,
                }}
              >
                {Icon && <Icon size={12} />}
                {tab.label}
              </Tabs.Trigger>
            );
          })}

          {/* Expand/Collapse button */}
          {onToggleExpanded && (
            <button
              onClick={onToggleExpanded}
              title={expanded ? 'Collapse settings' : 'Expand settings to full block'}
              style={{
                marginLeft: 'auto',
                padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
                background: 'transparent',
                border: 'none',
                color: expanded
                  ? VANTA_COLORS.accent.cyan
                  : VANTA_COLORS.text.muted,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: VANTA_SPACING['1'],
                flexShrink: 0,
                ...VANTA_TYPOGRAPHY.preset.label,
                transition: VANTA_ANIMATION.transition.colors,
              }}
            >
              {expanded ? (
                <Minimize2 size={12} />
              ) : (
                <Maximize2 size={12} />
              )}
            </button>
          )}
        </Tabs.List>

        {/* Tab content */}
        {tabs.map((tab) => (
          <Tabs.Content
            key={tab.id}
            value={tab.id}
            style={{
              padding: VANTA_SPACING['3'],
              maxHeight: expanded ? undefined : '400px',
              overflowY: 'auto',
              ...(expanded && {
                flex: 1,
                minHeight: 0,
              }),
            }}
          >
            {tab.content}
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </div>
  );
}

// =============================================================================
// ResizeHandle Sub-component
// =============================================================================

interface ResizeHandleProps {
  onResize: (deltaY: number) => void;
  onResizeEnd: () => void;
  minHeight?: number;
  maxHeight?: number;
  disabled?: boolean;
}

function ResizeHandle({
  onResize,
  onResizeEnd,
  disabled = false,
}: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      startYRef.current = e.clientY;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [disabled]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      e.stopPropagation();
      const deltaY = e.clientY - startYRef.current;
      startYRef.current = e.clientY;
      onResize(deltaY);
    },
    [isDragging, onResize]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      onResizeEnd();
    },
    [isDragging, onResizeEnd]
  );

  if (disabled) return null;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '12px',
        cursor: 'ns-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDragging
          ? VANTA_COLORS.surface.hover
          : 'transparent',
        transition: isDragging
          ? 'none'
          : `background-color ${VANTA_ANIMATION.duration.fast}`,
        zIndex: 10,
      }}
      title="Drag to resize"
    >
      <div
        style={{
          width: '48px',
          height: '4px',
          borderRadius: '2px',
          backgroundColor: isDragging
            ? VANTA_COLORS.accent.cyan
            : VANTA_COLORS.surface.border,
          opacity: isDragging ? 1 : 0.6,
          transition: isDragging
            ? 'none'
            : `all ${VANTA_ANIMATION.duration.fast}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <GripHorizontal
          size={10}
          style={{
            color: isDragging
              ? VANTA_COLORS.surface.elevated
              : VANTA_COLORS.text.muted,
          }}
        />
      </div>
    </div>
  );
}

export default EmbeddedBlockWrapper;
