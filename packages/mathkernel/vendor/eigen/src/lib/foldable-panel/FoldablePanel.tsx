/**
 * FoldablePanel Component
 *
 * Framework-agnostic foldable panel with header, content, settings, and resize.
 * Can be used standalone or wrapped by TipTap (EmbeddedBlockWrapper).
 *
 * @module foldable-panel/FoldablePanel
 */

import {
  useEffect,
  useMemo,
  useCallback,
  useState,
  useRef,
  type ReactNode,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import * as Tabs from '@radix-ui/react-tabs';
import {
  ChevronDown,
  ChevronUp,
  Settings,
  Minus,
  GripVertical,
  Maximize2,
  Minimize2,
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
  FoldablePanelProps,
  PanelBadge,
  SettingsTab,
  FoldState,
  PanelTag,
} from './types';
import {
  getFoldablePanelAtoms,
  disposeFoldablePanelAtoms,
  useFoldablePanelActions,
} from './atoms';
import { FoldablePanelProvider } from './context';
// Re-export for external use
export { useFoldablePanel } from './context';

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

export function getBadgeColors(tag: PanelTag) {
  return BADGE_COLORS[tag] || BADGE_COLORS['custom'];
}

// =============================================================================
// FoldablePanel Component
// =============================================================================

/**
 * FoldablePanel
 *
 * Framework-agnostic foldable panel. Can be used standalone or wrapped
 * by TipTap's EmbeddedBlockWrapper.
 *
 * @example
 * ```tsx
 * // Standalone usage (no TipTap)
 * <FoldablePanel
 *   panelId="chart-1"
 *   badge={{ tag: 'chart', label: 'Sales Chart' }}
 *   tabs={[{ id: 'style', label: 'Style', content: <StyleSettings /> }]}
 * >
 *   <Line data={[...]} xField="x" yField="y" />
 * </FoldablePanel>
 * ```
 */
export function FoldablePanel({
  panelId,
  badge,
  tabs = [],
  initialFoldState = 'expanded',
  allowMinimize = true,
  expandedHeight = 300,
  collapsedHeight = 80,
  children,
  onFoldChange,
  className = '',
  isSelected: externalSelected = false,
  isEditable = true,
  customName,
  onRename: _onRename, // Reserved for future inline rename support
  onDelete,
  showDragHandle = true,
  showFocusButton = false,
  onEnterFocus,
}: FoldablePanelProps) {
  // Get atoms for this panel instance
  const atoms = useMemo(() => getFoldablePanelAtoms(panelId), [panelId]);
  const actions = useFoldablePanelActions(atoms);

  // Subscribe to state
  const state = useAtomValue(atoms.stateAtom);
  const showControls = useAtomValue(atoms.showControlsAtom);
  const contentExpanded = useAtomValue(atoms.contentExpandedAtom);
  const customHeight = useAtomValue(atoms.customHeightAtom);
  const settingsExpanded = useAtomValue(atoms.settingsExpandedAtom);

  // Compute effective height: customHeight overrides default when expanded
  const effectiveExpandedHeight = customHeight ?? expandedHeight;

  // Sync external selected state
  useEffect(() => {
    actions.setSelected(externalSelected);
  }, [externalSelected, actions]);

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
    return () => disposeFoldablePanelAtoms(panelId);
  }, [panelId]);

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

  // Resize handlers
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
    console.log(`[FoldablePanel] Resize complete: ${currentHeightRef.current}px`);
  }, []);

  // Keyboard handling
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.isSelected && onDelete) {
          e.preventDefault();
          e.stopPropagation();
          // Don't auto-delete, let parent handle it
        }
      }
    },
    [state.isSelected, onDelete]
  );

  const badgeColors = getBadgeColors(badge.tag);

  return (
    <FoldablePanelProvider
      atoms={atoms}
      badge={badge}
      tabs={tabs}
      isEditable={isEditable}
    >
      <div
        className={`tmnl-foldable-panel ${className}`}
        data-panel-id={panelId}
        data-panel-tag={badge.tag}
        data-settings-expanded={settingsExpanded}
        onMouseEnter={() => actions.setHovered(true)}
        onMouseLeave={() => actions.setHovered(false)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        style={{
          margin: '16px 0',
          borderRadius: VANTA_BORDERS.radius.md,
          overflow: state.isHovered ? 'visible' : 'hidden',
          border: state.isSelected
            ? `1px solid ${badgeColors.border}`
            : `1px solid ${VANTA_COLORS.surface.border}`,
          transition: VANTA_ANIMATION.transition.colors,
          outline: 'none',
          display: settingsExpanded ? 'flex' : undefined,
          flexDirection: settingsExpanded ? 'column' : undefined,
          minHeight: settingsExpanded ? effectiveExpandedHeight + 100 : undefined,
        }}
      >
        <Header
          badge={badge}
          badgeColors={badgeColors}
          showControls={showControls}
          foldState={state.foldState}
          settingsOpen={state.settingsOpen}
          allowMinimize={allowMinimize}
          hasTabs={tabs.length > 0}
          customName={customName}
          showDragHandle={showDragHandle}
          showFocusButton={showFocusButton}
          onToggleFold={actions.toggleFold}
          onMinimize={actions.minimize}
          onToggleSettings={actions.toggleSettings}
          onEnterFocus={onEnterFocus}
          onDelete={onDelete}
        />

        <div
          style={{
            position: 'relative',
            height: settingsExpanded
              ? 0
              : state.foldState === 'minimized'
              ? 0
              : contentExpanded
              ? effectiveExpandedHeight
              : collapsedHeight,
            overflow: 'hidden',
            transition: 'height 200ms ease',
          }}
        >
          <div
            style={{
              position: state.foldState === 'minimized' ? 'absolute' : 'relative',
              top: 0,
              left: 0,
              width: '100%',
              height:
                state.foldState === 'minimized'
                  ? collapsedHeight
                  : contentExpanded
                  ? effectiveExpandedHeight
                  : collapsedHeight,
              visibility: state.foldState === 'minimized' ? 'hidden' : 'visible',
              pointerEvents: state.foldState === 'minimized' ? 'none' : 'auto',
              opacity: contentExpanded ? 1 : 0.6,
              transition: 'opacity 200ms ease',
            }}
          >
            {children}
          </div>

          {/* Resize handle - only show when expanded */}
          {contentExpanded && (
            <ResizeHandle
              onResize={handleResize}
              onResizeEnd={handleResizeEnd}
              minHeight={80}
              maxHeight={800}
            />
          )}
        </div>

        {state.settingsOpen && tabs.length > 0 && (
          <SettingsPanel
            tabs={tabs}
            activeTab={state.activeTab}
            onTabChange={actions.setActiveTab}
            expanded={settingsExpanded}
            onToggleExpanded={actions.toggleSettingsExpanded}
          />
        )}
      </div>
    </FoldablePanelProvider>
  );
}

// =============================================================================
// HeaderButton Sub-component
// =============================================================================

interface HeaderButtonProps {
  onClick: () => void;
  title: string;
  isActive?: boolean;
  activeColor?: string;
  activeBg?: string;
  children: ReactNode;
}

function HeaderButton({
  onClick,
  title,
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
  };

  const handleMouseUp = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPressed) {
      onClick();
    }
    setIsPressed(false);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (isPressed) {
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
  badge: PanelBadge;
  badgeColors: { bg: string; text: string; border: string };
  showControls: boolean;
  foldState: FoldState;
  settingsOpen: boolean;
  allowMinimize: boolean;
  hasTabs: boolean;
  customName?: string;
  showDragHandle?: boolean;
  showFocusButton?: boolean;
  onToggleFold: () => void;
  onMinimize: () => void;
  onToggleSettings: () => void;
  onEnterFocus?: () => void;
  onDelete?: () => void;
}

function Header({
  badge,
  badgeColors,
  showControls,
  foldState,
  settingsOpen,
  allowMinimize,
  hasTabs,
  customName,
  showDragHandle = true,
  showFocusButton = false,
  onToggleFold,
  onMinimize,
  onToggleSettings,
  onEnterFocus,
  onDelete,
}: HeaderProps) {
  const Icon = badge.icon;

  // Handle click on header area (not on control buttons)
  const handleHeaderClick = useCallback(
    (e: MouseEvent) => {
      // Don't toggle if clicking on a button or drag handle
      const target = e.target as HTMLElement;
      if (
        target.closest('button') ||
        target.closest('[data-drag-handle]')
      ) {
        return;
      }
      onToggleFold();
    },
    [onToggleFold]
  );

  return (
    <div
      onClick={handleHeaderClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
        background: VANTA_COLORS.surface.elevated,
        borderBottom: `1px solid ${VANTA_COLORS.surface.border}`,
        opacity: showControls ? 1 : 0.6,
        transition: 'opacity 150ms ease',
        cursor: 'pointer',
        userSelect: 'none',
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
        {showDragHandle && (
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
        )}

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

        {/* Custom name */}
        {customName && (
          <span
            style={{
              ...VANTA_TYPOGRAPHY.preset.label,
              color: VANTA_COLORS.text.secondary,
            }}
          >
            {customName}
          </span>
        )}
      </div>

      {/* Right: Controls (stop propagation handled by HeaderButton) */}
      <div style={{ display: 'flex', gap: VANTA_SPACING['1'] }}>
        {/* Focus/Expand button */}
        {showFocusButton && onEnterFocus && (
          <HeaderButton
            onClick={onEnterFocus}
            title="Focus mode (expand to full viewport)"
          >
            <Maximize2 size={14} />
          </HeaderButton>
        )}

        {/* Fold toggle */}
        <HeaderButton
          onClick={onToggleFold}
          title={foldState === 'expanded' ? 'Collapse' : 'Expand'}
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
          >
            <Minus size={14} />
          </HeaderButton>
        )}

        {/* Settings toggle */}
        {hasTabs && (
          <HeaderButton
            onClick={onToggleSettings}
            title="Settings"
            isActive={settingsOpen}
            activeColor={badgeColors.text}
            activeBg={badgeColors.bg}
          >
            <Settings size={14} />
          </HeaderButton>
        )}

        {/* Delete button */}
        {onDelete && (
          <HeaderButton
            onClick={onDelete}
            title="Delete panel"
            activeColor={VANTA_COLORS.accent.rose}
            activeBg={VANTA_COLORS.accent.roseGlow}
          >
            <Trash2 size={14} />
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
  const tabListRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll state
  const updateScrollIndicators = useCallback(() => {
    const el = tabListRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  // Update on mount and resize
  useEffect(() => {
    updateScrollIndicators();

    const el = tabListRef.current;
    if (!el) return;

    el.addEventListener('scroll', updateScrollIndicators);
    const resizeObserver = new ResizeObserver(updateScrollIndicators);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', updateScrollIndicators);
      resizeObserver.disconnect();
    };
  }, [updateScrollIndicators, tabs.length]);

  // Scroll by amount
  const scrollBy = useCallback((direction: 'left' | 'right') => {
    const el = tabListRef.current;
    if (!el) return;

    const scrollAmount = direction === 'left' ? -120 : 120;
    el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  }, []);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
        {/* Tab bar container with scroll indicators */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            borderBottom: `1px solid ${VANTA_COLORS.surface.border}`,
          }}
        >
          {/* Left scroll indicator */}
          <div
            onClick={() => scrollBy('left')}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `linear-gradient(to right, ${VANTA_COLORS.surface.default} 60%, transparent)`,
              zIndex: 2,
              cursor: canScrollLeft ? 'pointer' : 'default',
              opacity: canScrollLeft ? 1 : 0,
              pointerEvents: canScrollLeft ? 'auto' : 'none',
              transition: `opacity ${VANTA_ANIMATION.duration.fast}`,
            }}
          >
            <ChevronDown
              size={12}
              style={{
                transform: 'rotate(90deg)',
                color: VANTA_COLORS.text.muted,
              }}
            />
          </div>

          {/* Scrollable tab list */}
          <Tabs.List
            ref={tabListRef}
            style={{
              display: 'flex',
              flex: 1,
              overflowX: 'auto',
              overflowY: 'hidden',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              paddingLeft: canScrollLeft ? '20px' : 0,
              paddingRight: '36px',
              opacity: isHovered ? 1 : 0.5,
              transition: `opacity ${VANTA_ANIMATION.duration.normal}`,
            }}
          >
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
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
                  {TabIcon && <TabIcon size={12} />}
                  {tab.label}
                </Tabs.Trigger>
              );
            })}
          </Tabs.List>

          {/* Right scroll indicator */}
          <div
            onClick={() => scrollBy('right')}
            style={{
              position: 'absolute',
              right: '32px',
              top: 0,
              bottom: 0,
              width: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `linear-gradient(to left, ${VANTA_COLORS.surface.default} 60%, transparent)`,
              zIndex: 2,
              cursor: canScrollRight ? 'pointer' : 'default',
              opacity: canScrollRight ? 1 : 0,
              pointerEvents: canScrollRight ? 'auto' : 'none',
              transition: `opacity ${VANTA_ANIMATION.duration.fast}`,
            }}
          >
            <ChevronDown
              size={12}
              style={{
                transform: 'rotate(-90deg)',
                color: VANTA_COLORS.text.muted,
              }}
            />
          </div>

          {/* Sticky Expand/Collapse button */}
          {onToggleExpanded && (
            <button
              onClick={onToggleExpanded}
              title={expanded ? 'Collapse settings' : 'Expand settings to full panel'}
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                padding: `0 ${VANTA_SPACING['2']}`,
                background: VANTA_COLORS.surface.default,
                borderLeft: `1px solid ${VANTA_COLORS.surface.border}`,
                border: 'none',
                color: expanded
                  ? VANTA_COLORS.accent.cyan
                  : VANTA_COLORS.text.muted,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 3,
                ...VANTA_TYPOGRAPHY.preset.label,
                transition: VANTA_ANIMATION.transition.colors,
              }}
            >
              {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          )}
        </div>

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

export default FoldablePanel;
