/**
 * InteractiveChartPanel Header
 *
 * Panel header with fold controls, settings toggle, and stream status.
 *
 * @module charts/interactive-panel/components/Header
 */

import { useAtomValue } from '@effect-atom/atom-react';
import {
  ChevronDown,
  ChevronUp,
  Settings,
  Minimize2,
  Maximize2,
  Loader2,
} from 'lucide-react';

import {
  VANTA_COLORS,
  VANTA_SPACING,
  VANTA_TYPOGRAPHY,
  VANTA_BORDERS,
} from '@/components/portal/tokens';
import { usePanelContext } from '../context';

export interface HeaderProps {
  /** Panel title */
  title?: string;
  /** Show fold controls */
  showFoldControls?: boolean;
  /** Show settings button */
  showSettingsButton?: boolean;
  /** Additional header content (right side) */
  children?: React.ReactNode;
}

/**
 * Header component for InteractiveChartPanel.
 *
 * Provides:
 * - Fold/expand/minimize controls
 * - Settings toggle
 * - Stream status indicator
 * - Custom header content slot
 */
export function Header({
  title,
  showFoldControls = true,
  showSettingsButton = true,
  children,
}: HeaderProps) {
  const { atoms, actions, chartId } = usePanelContext();

  const foldState = useAtomValue(atoms.foldStateAtom);
  const settingsOpen = useAtomValue(atoms.settingsOpenAtom);
  const isStreaming = useAtomValue(atoms.isStreamingAtom);
  const showControls = useAtomValue(atoms.showControlsAtom);

  const displayTitle = title ?? `Chart: ${chartId}`;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['3']}`,
        borderBottom: `1px solid ${VANTA_COLORS.surface.border}`,
        background: VANTA_COLORS.surface.elevated,
        borderRadius: `${VANTA_BORDERS.radius.md} ${VANTA_BORDERS.radius.md} 0 0`,
        minHeight: '36px',
      }}
    >
      {/* Left: Title + Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: VANTA_SPACING['2'],
        }}
      >
        <span
          style={{
            ...VANTA_TYPOGRAPHY.preset.label,
            color: VANTA_COLORS.text.primary,
          }}
        >
          {displayTitle}
        </span>

        {/* Streaming indicator */}
        {isStreaming && (
          <Loader2
            size={12}
            style={{
              color: VANTA_COLORS.accent.cyan,
              animation: 'spin 1s linear infinite',
            }}
          />
        )}
      </div>

      {/* Right: Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: VANTA_SPACING['1'],
          opacity: showControls ? 1 : 0.5,
          transition: 'opacity 150ms ease',
        }}
      >
        {/* Custom content */}
        {children}

        {/* Fold controls */}
        {showFoldControls && (
          <>
            <IconButton
              icon={foldState === 'expanded' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              onClick={actions.toggleFold}
              title={foldState === 'expanded' ? 'Collapse' : 'Expand'}
            />
            <IconButton
              icon={foldState === 'minimized' ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              onClick={foldState === 'minimized' ? actions.expand : actions.minimize}
              title={foldState === 'minimized' ? 'Restore' : 'Minimize'}
            />
          </>
        )}

        {/* Settings toggle */}
        {showSettingsButton && (
          <IconButton
            icon={<Settings size={14} />}
            onClick={actions.toggleSettings}
            active={settingsOpen}
            title="Settings"
          />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

interface IconButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
}

function IconButton({ icon, onClick, active = false, title }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '24px',
        padding: 0,
        background: active ? VANTA_COLORS.accent.cyanGlow : 'transparent',
        border: 'none',
        borderRadius: VANTA_BORDERS.radius.sm,
        color: active ? VANTA_COLORS.accent.cyan : VANTA_COLORS.text.secondary,
        cursor: 'pointer',
        transition: 'all 150ms ease',
      }}
    >
      {icon}
    </button>
  );
}

export default Header;
