/**
 * TheiaPanel
 *
 * Embeddable Theia IDE panel with iframe integration.
 * Manages server lifecycle and provides controls for bounce/unbounce.
 *
 * @module lib/theia/TheiaPanel
 */

import * as React from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import { RegistryContext } from '@effect-atom/atom-react';
import {
  theiaRegistry,
  theiaOps,
  getTheiaAtoms,
  getTheiaPanelAtoms,
  type TheiaStatus,
} from './theia-stx';

// =============================================================================
// Types
// =============================================================================

export interface TheiaPanelProps {
  /** Unique panel identifier for state isolation */
  panelId: string;
  /** Optional workspace path to open */
  workspace?: string;
  /** Auto-start server on mount */
  autoStart?: boolean;
  /** CSS class for container */
  className?: string;
  /** Inline styles for container */
  style?: React.CSSProperties;
}

// =============================================================================
// Status Indicator
// =============================================================================

function StatusIndicator({ status }: { status: TheiaStatus }) {
  const colors: Record<TheiaStatus, string> = {
    stopped: '#6b7280', // gray
    starting: '#f59e0b', // amber
    running: '#22c55e', // green
    error: '#ef4444', // red
  };

  const labels: Record<TheiaStatus, string> = {
    stopped: 'Stopped',
    starting: 'Starting...',
    running: 'Running',
    error: 'Error',
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className="w-2 h-2 rounded-full"
        style={{
          backgroundColor: colors[status],
          boxShadow:
            status === 'running' ? `0 0 8px ${colors[status]}` : 'none',
        }}
      />
      <span
        className="font-mono"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {labels[status]}
      </span>
    </div>
  );
}

// =============================================================================
// Controls
// =============================================================================

interface ControlsProps {
  status: TheiaStatus;
  panelId: string;
  bounced: boolean;
}

function Controls({ status, panelId, bounced }: ControlsProps) {
  const handleStart = React.useCallback(() => {
    theiaOps.start().catch(console.error);
  }, []);

  const handleStop = React.useCallback(() => {
    theiaOps.stop().catch(console.error);
  }, []);

  const handleRestart = React.useCallback(() => {
    theiaOps.restart().catch(console.error);
  }, []);

  const handleBounce = React.useCallback(() => {
    if (bounced) {
      theiaOps.unbounce(panelId).catch(console.error);
    } else {
      theiaOps.bounce(panelId).catch(console.error);
    }
  }, [panelId, bounced]);

  const buttonClass =
    'px-2 py-1 rounded font-mono transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const buttonStyle: React.CSSProperties = {
    fontSize: 'var(--tmnl-text-xs, 12px)',
    backgroundColor: 'var(--tmnl-surface-2, #1a1a1a)',
    border: '1px solid var(--tmnl-border, #333)',
  };

  return (
    <div className="flex items-center gap-2">
      <StatusIndicator status={status} />

      <div className="flex items-center gap-1 ml-auto">
        {status === 'stopped' && (
          <button
            className={buttonClass}
            style={buttonStyle}
            onClick={handleStart}
          >
            Start
          </button>
        )}

        {status === 'running' && (
          <>
            <button
              className={buttonClass}
              style={buttonStyle}
              onClick={handleRestart}
            >
              Restart
            </button>
            <button
              className={buttonClass}
              style={buttonStyle}
              onClick={handleStop}
            >
              Stop
            </button>
            <button
              className={buttonClass}
              style={buttonStyle}
              onClick={handleBounce}
              title={bounced ? 'Return to panel' : 'Open in new window'}
            >
              {bounced ? '↩' : '↗'}
            </button>
          </>
        )}

        {status === 'starting' && (
          <span
            className="font-mono text-amber-400"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Loading...
          </span>
        )}

        {status === 'error' && (
          <button
            className={buttonClass}
            style={buttonStyle}
            onClick={handleStart}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// IDE Iframe
// =============================================================================

interface IdeFrameProps {
  url: string;
  panelId: string;
  workspace?: string;
}

function IdeFrame({ url, panelId, workspace }: IdeFrameProps) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  // Build URL with optional workspace query param
  const iframeSrc = React.useMemo(() => {
    if (!workspace) return url;
    const u = new URL(url);
    u.searchParams.set('folder', workspace);
    return u.toString();
  }, [url, workspace]);

  const handleLoad = React.useCallback(() => {
    theiaOps.setLoaded(panelId, true);
    console.log('[TheiaPanel] iframe loaded:', panelId);
  }, [panelId]);

  return (
    <iframe
      ref={iframeRef}
      src={iframeSrc}
      className="w-full h-full border-0"
      style={{
        backgroundColor: 'var(--tmnl-void, #000)',
      }}
      onLoad={handleLoad}
      // Sandbox with necessary permissions for Theia
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      // Allow clipboard access
      allow="clipboard-read; clipboard-write"
    />
  );
}

// =============================================================================
// Placeholder
// =============================================================================

function Placeholder({
  status,
  error,
}: {
  status: TheiaStatus;
  error: string | null;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-4"
      style={{
        backgroundColor: 'var(--tmnl-void, #000)',
        color: 'var(--tmnl-text-muted, #666)',
      }}
    >
      {status === 'stopped' && (
        <>
          <div
            className="font-mono"
            style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
          >
            Theia IDE
          </div>
          <div
            className="font-mono"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            Click Start to launch the IDE server
          </div>
        </>
      )}

      {status === 'starting' && (
        <>
          <div
            className="font-mono animate-pulse"
            style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
          >
            Starting Theia IDE...
          </div>
          <div
            className="font-mono text-amber-400"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            This may take a few seconds
          </div>
        </>
      )}

      {status === 'error' && (
        <>
          <div
            className="font-mono text-red-400"
            style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
          >
            Failed to start Theia IDE
          </div>
          {error && (
            <div
              className="font-mono text-red-300 max-w-md text-center"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

function TheiaPanelInner({
  panelId,
  workspace,
  autoStart = false,
  className = '',
  style,
}: TheiaPanelProps) {
  const atoms = getTheiaAtoms();
  const panelAtoms = getTheiaPanelAtoms(panelId);

  const status = useAtomValue(atoms.status);
  const url = useAtomValue(atoms.url);
  const error = useAtomValue(atoms.error);
  const bounced = useAtomValue(panelAtoms.bounced);

  // Auto-start on mount if requested
  React.useEffect(() => {
    if (autoStart && status === 'stopped') {
      theiaOps.start().catch(console.error);
    }
  }, [autoStart, status]);

  // Refresh status on mount
  React.useEffect(() => {
    theiaOps.refreshStatus().catch(console.error);
  }, []);

  // Set workspace when it changes
  React.useEffect(() => {
    theiaOps.setWorkspace(panelId, workspace ?? null);
  }, [panelId, workspace]);

  // Don't render iframe if bounced to separate window
  if (bounced) {
    return (
      <div
        className={`flex flex-col ${className}`}
        style={{
          backgroundColor: 'var(--tmnl-surface-1, #0a0a0a)',
          border: '1px solid var(--tmnl-border, #333)',
          ...style,
        }}
      >
        <div
          className="p-2 border-b"
          style={{ borderColor: 'var(--tmnl-border, #333)' }}
        >
          <Controls status={status} panelId={panelId} bounced={bounced} />
        </div>
        <div
          className="flex-1 flex items-center justify-center"
          style={{ color: 'var(--tmnl-text-muted, #666)' }}
        >
          <span
            className="font-mono"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            IDE opened in separate window
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col ${className}`}
      style={{
        backgroundColor: 'var(--tmnl-surface-1, #0a0a0a)',
        border: '1px solid var(--tmnl-border, #333)',
        ...style,
      }}
    >
      {/* Header */}
      <div
        className="p-2 border-b"
        style={{ borderColor: 'var(--tmnl-border, #333)' }}
      >
        <Controls status={status} panelId={panelId} bounced={bounced} />
      </div>

      {/* Content */}
      <div className="flex-1 relative">
        {status === 'running' && url ? (
          <IdeFrame url={url} panelId={panelId} workspace={workspace} />
        ) : (
          <Placeholder status={status} error={error} />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Export with Registry Provider
// =============================================================================

export function TheiaPanel(props: TheiaPanelProps) {
  return (
    <RegistryContext.Provider value={theiaRegistry as any}>
      <TheiaPanelInner {...props} />
    </RegistryContext.Provider>
  );
}

export default TheiaPanel;
