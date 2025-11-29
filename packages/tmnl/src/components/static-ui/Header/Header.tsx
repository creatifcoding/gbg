/**
 * TMNL Header
 *
 * The application header bar.
 * Uses CSS custom properties from ScaleProvider.
 */

import { Crosshair, Settings, Terminal, User, Zap } from 'lucide-react';
import { Button } from '@/components/primitives';

// =============================================================================
// HEADER
// =============================================================================

export interface HeaderProps {
  /** Navigation tabs */
  navTabs: string[];
  /** Currently active tab */
  activeTab: string;
  /** Tab selection callback */
  onTabChange: (tab: string) => void;
  /** Open left drawer callback */
  onOpenLeftDrawer: () => void;
  /** Open right drawer callback */
  onOpenRightDrawer: () => void;
  /** Open command bar callback */
  onOpenCommand: () => void;
  /** Open settings callback */
  onOpenSettings: () => void;
}

export function Header({
  navTabs,
  activeTab,
  onTabChange,
  onOpenLeftDrawer,
  onOpenRightDrawer,
  onOpenCommand,
  onOpenSettings,
}: HeaderProps) {
  return (
    <header
      className="border-b border-neutral-800 flex items-center justify-between px-4 bg-black shrink-0"
      style={{ height: 'var(--tmnl-size-header, 48px)' }}
    >
      <div className="flex items-center gap-6">
        <button
          onClick={onOpenLeftDrawer}
          className="p-1 hover:bg-neutral-900 transition-colors"
        >
          <User
            className="text-neutral-600 hover:text-white"
            style={{
              width: 'var(--tmnl-text-base, 16px)',
              height: 'var(--tmnl-text-base, 16px)',
            }}
          />
        </button>

        <div className="flex items-center gap-2">
          <Crosshair
            className="text-white"
            style={{
              width: 'var(--tmnl-text-lg, 18px)',
              height: 'var(--tmnl-text-lg, 18px)',
            }}
          />
          <span
            className="text-white font-bold tracking-tight uppercase"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            TMNL_UI_KIT
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-6 ml-4">
          {navTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`tmnl-type-nav ${
                activeTab === tab ? 'tmnl-type-nav-active' : ''
              }`}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex gap-2">
        <Button size="xs" variant="outline" onClick={onOpenCommand}>
          <Terminal
            style={{
              width: 'var(--tmnl-text-xs, 12px)',
              height: 'var(--tmnl-text-xs, 12px)',
            }}
          />
          CMD
        </Button>
        <Button size="xs" variant="ghost" onClick={onOpenSettings}>
          <Settings
            style={{
              width: 'var(--tmnl-text-xs, 12px)',
              height: 'var(--tmnl-text-xs, 12px)',
            }}
          />
        </Button>
        <Button size="xs" variant="tmnl" onClick={onOpenRightDrawer}>
          <Zap
            style={{
              width: 'var(--tmnl-text-xs, 12px)',
              height: 'var(--tmnl-text-xs, 12px)',
            }}
          />
          ACTIONS
        </Button>
      </div>
    </header>
  );
}
