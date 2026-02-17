/**
 * HeaderContent
 *
 * Typography:
 * - Navigation → Orbitron (font-nav)
 * - Buttons → Orbitron (font-button)
 * - Wordmark → VT323 (font-terminal)
 *
 * @module lib/shell
 */

import { useCallback, useState } from 'react';
import { PanelLeft, Settings, Terminal, User, Zap } from 'lucide-react';
import { SelfchartersLogo } from '@/components/brand';
import { TmnlSettings } from '@/components/static-ui';
import { useDrawer, useVisualOverlay, overlayId } from '@/lib/overlays';
import { useMinibuffer } from '@/lib/minibuffer';
import { useCommandWire, useNuCmdkWire, NuCmdkShellOverlay } from '@/lib/commands';
import { useGlobalHotkeys } from '@/lib/hotkeys';
import { TESTBED_WINDOW_PROVIDER_ID } from '@/lib/tauri-windows';

// ─────────────────────────────────────────────────────────────
// Button Primitive
// ─────────────────────────────────────────────────────────────

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'outline' | 'ghost' | 'tmnl';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

function Button({
  children,
  onClick,
  variant = 'ghost',
  size = 'xs',
  className = '',
}: ButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center gap-1.5 font-button uppercase tracking-wide transition-colors disabled:opacity-50';

  const sizeClasses = {
    xs: 'px-2 py-1',
    sm: 'px-3 py-1.5',
    md: 'px-4 py-2',
  };

  const variantClasses = {
    outline:
      'border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white hover:bg-neutral-900',
    ghost: 'text-neutral-500 hover:text-white hover:bg-neutral-900',
    tmnl: 'bg-neutral-800 text-white hover:bg-neutral-700 border border-neutral-700',
  };

  return (
    <button
      data-tauri-drag-region="false"
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface HeaderContentProps {
  /** Navigation tabs */
  navTabs?: string[];
  /** Currently active tab */
  activeTab?: string;
  /** Tab change callback */
  onTabChange?: (tab: string) => void;
  /** Toggle left drawer */
  onToggleLeftDrawer?: () => void;
  /** Toggle right drawer */
  onToggleRightDrawer?: () => void;
  /** Open settings modal */
  onOpenSettings?: () => void;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function HeaderContent({
  navTabs = ['OVERVIEW', 'DATA', 'CANVAS', 'TESTBED'],
  activeTab,
  onTabChange,
  onToggleLeftDrawer,
  onToggleRightDrawer,
  onOpenSettings,
}: HeaderContentProps) {
  const drawer = useDrawer();
  const visualOverlay = useVisualOverlay();
  const minibuffer = useMinibuffer();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { isWired } = useCommandWire({
    debug: false,
  });
  const { isReady: isNuCmdkWired } = useNuCmdkWire({
    debug: false,
  });

  const useNuCmdkForCommandPalette = import.meta.env.VITE_NU_CMDK_COMMAND_PALETTE_HOST === '1';

  const openNuCmdkShell = useCallback(() => {
    const id = overlayId('nu-cmdk-shell');
    visualOverlay.open('command-palette', {
      id,
      config: {
        _tag: 'CommandPaletteConfig',
        id,
        placeholder: 'NuCmdk',
        showRecent: false,
        width: 'min(78vw, 680px)',
        maxWidth: 680,
        paddingTop: 0,
        closeOnEscape: true,
        persistence: 'ephemeral',
        zIndexOffset: 0,
      },
      content: (
        <NuCmdkShellOverlay onClose={() => visualOverlay.close(id)} />
      ),
    });
  }, [visualOverlay]);

  const openCommandPalette = useCallback(() => {
    if (useNuCmdkForCommandPalette) {
      openNuCmdkShell();
      return;
    }

    // M-x style command execution via minibuffer
    if (!isWired) {
      return
    }
    minibuffer.executeCommand();
  }, [isWired, minibuffer, openNuCmdkShell, useNuCmdkForCommandPalette]);

  const openTestbedWindowPicker = useCallback(() => {
    if (!isNuCmdkWired) {
      return
    }
    minibuffer.openCommand(TESTBED_WINDOW_PROVIDER_ID);
  }, [isNuCmdkWired, minibuffer]);

  const openSettingsFromHotkey = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  // Global hotkeys - Ctrl+, → settings, Ctrl+Shift+P/Alt+X → M-x, Ctrl+Shift+K → NuCmdk shell.
  useGlobalHotkeys({
    isWired,
    onSettings: openSettingsFromHotkey,
    onOpenCommandPalette: openCommandPalette,
    onOpenNuCmdk: openNuCmdkShell,
    onOpenTestbedWindow: openTestbedWindowPicker,
    onMinibufferCancel: () => minibuffer.cancel(),
  });

  // ─── Toggle functions ─────────────────────────────────────────

  const toggleLeftDrawer = useCallback(() => {
    onToggleLeftDrawer?.();
    // Also toggle via drawer hook
    drawer.toggle(
      {
        id: overlayId('left-panel'),
        side: 'left',
        width: 320,
        showBackdrop: false,
      },
      <div className="p-4 text-neutral-400">
        <h3
          className="text-white font-terminal mb-4"
          style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
        >
          LEFT PANEL
        </h3>
        <p style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
          Navigation, file browser, or context-sensitive tools.
        </p>
      </div>
    );
  }, [drawer, onToggleLeftDrawer]);

  const toggleRightDrawer = useCallback(() => {
    onToggleRightDrawer?.();
    // Also toggle via drawer hook
    drawer.toggle(
      {
        id: overlayId('right-actions'),
        side: 'right',
        width: 320,
        showBackdrop: false,
      },
      <div className="p-4 text-neutral-400">
        <h3
          className="text-white font-terminal mb-4"
          style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
        >
          ACTIONS
        </h3>
        <p style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
          Quick actions, properties, and contextual tools.
        </p>
      </div>
    );
  }, [drawer, onToggleRightDrawer]);

  const openCommandPaletteFromButton = useCallback(() => {
    openCommandPalette();
  }, [openCommandPalette]);

  // ─── Settings ─────────────────────────────────────────────────

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
    onOpenSettings?.();
  }, [onOpenSettings]);

  // ─── Tab Change ─────────────────────────────────────────────

  const handleTabChange = useCallback(
    (tab: string) => {
      onTabChange?.(tab);
    },
    [onTabChange]
  );

  return (
    <div
      data-tauri-drag-region
      className="h-full flex items-center"
      style={{ borderBottom: 'var(--tmnl-border-chrome)' }}
    >
      {/* Corner overlap zone - sidebar width, shows border intersection */}
      <div
        data-tauri-drag-region
        className="h-full flex items-center justify-center shrink-0"
        style={{
          width: 'var(--tmnl-size-sidebar, 48px)',
          borderRight: 'var(--tmnl-border-chrome)',
        }}
      >
        {/* Corner indicator - Selfcharters logo */}
        <SelfchartersLogo.Static
          variant="solid"
          size={32}
          fillColor="#525252"
        />
      </div>

      {/* Main header content - after sidebar zone */}
      <div
        data-tauri-drag-region
        className="flex-1 h-full flex items-center justify-between px-4"
      >
        {/* Left section */}
        <div className="flex items-center gap-4">
          {/* Left drawer toggle */}
          <Button variant="ghost" onClick={toggleLeftDrawer}>
            <PanelLeft
              style={{
                width: 'var(--tmnl-text-sm, 14px)',
                height: 'var(--tmnl-text-sm, 14px)',
              }}
            />
          </Button>

          <div className="flex items-center gap-2">
            <span
              className="text-white font-terminal"
              style={{
                fontSize: 'var(--tmnl-text-xl, 20px)',
                letterSpacing: '0.08em',
              }}
            >
              TMNL
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            {navTabs.map((tab) => (
              <button
                data-tauri-drag-region="false"
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`font-nav uppercase tracking-wide transition-colors ${
                  activeTab === tab
                    ? 'text-white'
                    : 'text-neutral-600 hover:text-neutral-300'
                }`}
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Right section */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={openCommandPaletteFromButton}>
            <Terminal
              style={{
                width: 'var(--tmnl-text-xs, 12px)',
                height: 'var(--tmnl-text-xs, 12px)',
              }}
            />
            CMD
          </Button>
          <Button variant="ghost" onClick={openSettings}>
            <Settings
              style={{
                width: 'var(--tmnl-text-xs, 12px)',
                height: 'var(--tmnl-text-xs, 12px)',
              }}
            />
          </Button>
          <Button variant="tmnl" onClick={toggleRightDrawer}>
            <Zap
              style={{
                width: 'var(--tmnl-text-xs, 12px)',
                height: 'var(--tmnl-text-xs, 12px)',
              }}
            />
            ACTIONS
          </Button>
        </div>
      </div>

      {/* Settings modal */}
      <TmnlSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

export default HeaderContent;
