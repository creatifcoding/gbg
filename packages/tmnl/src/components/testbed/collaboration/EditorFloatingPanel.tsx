/**
 * EditorFloatingPanel
 *
 * Collaborative Tiptap editor wrapped in a floating panel.
 * Supports drag, resize, maximize, and dock operations.
 *
 * ARCHITECTURE (BEAD-2+3):
 * - FloatingPanel is a STABLE container (never unmounts on reconnect)
 * - EditorContentWithState handles all connection states internally
 * - Panel position/size preserved across reconnects
 *
 * @module testbed/collaboration/EditorFloatingPanel
 */

import { useEffect, useCallback, useRef } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import type { ClientToken } from '@y-sweet/sdk';
import {
  FloatingPanel,
  registerPanel,
  unregisterPanel,
  useFloatingDimensions,
} from '@/lib/floating';
import {
  CollaborativeTiptapEditor,
  clientTokenAtom,
  collaborationStatusAtom,
  collaborationErrorAtom,
  type CollaborationUser,
} from '@/lib/editor/v3';
import { COLORS } from '@/lib/capabilities/tokens';

// =============================================================================
// Types
// =============================================================================

export interface EditorFloatingPanelProps {
  /** Unique panel ID */
  panelId: string;
  /** User info for this editor instance */
  user: CollaborationUser;
  /** Display label (e.g., "Editor A") */
  label: string;
  /** Initial position */
  initialPosition?: { x: number; y: number };
  /** Initial dimensions */
  initialDimensions?: { width: number; height: number };
  /** Callback when panel is closed */
  onClose?: () => void;
}

// =============================================================================
// Panel Config Factory
// =============================================================================

const createPanelConfig = (
  id: string,
  title: string,
  position?: { x: number; y: number },
  dimensions?: { width: number; height: number }
) => ({
  id,
  title,
  mode: 'floating' as const,
  initialPosition: position ?? { x: 100, y: 100 },
  initialDimensions: dimensions ?? { width: 480, height: 400 },
  constraints: {
    minWidth: 320,
    minHeight: 200,
    maxWidth: 1200,
    maxHeight: 900,
  },
  closable: true,
  minimizable: true,
  resizable: true,
});

// =============================================================================
// Connection Status Types
// =============================================================================

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// =============================================================================
// Editor Content With State (handles all connection states)
// =============================================================================

interface EditorContentWithStateProps {
  user: CollaborationUser;
}

function EditorContentWithState({ user }: EditorContentWithStateProps) {
  const { width, height, layout } = useFloatingDimensions();

  // Track connection status and token
  // @ts-expect-error — version mismatch in monorepo, works at runtime
  const status = useAtomValue(collaborationStatusAtom) as ConnectionStatus;
  // @ts-expect-error — version mismatch in monorepo, works at runtime
  const clientToken = useAtomValue(clientTokenAtom) as ClientToken | null;
  // @ts-expect-error — version mismatch in monorepo, works at runtime
  const error = useAtomValue(collaborationErrorAtom) as string | null;

  // Cache the last valid token so we don't unmount editor during brief reconnects
  const lastTokenRef = useRef<ClientToken | null>(null);
  if (clientToken) {
    lastTokenRef.current = clientToken;
  }

  // Use cached token if we're reconnecting (status is connecting but we had a token)
  const effectiveToken = clientToken ?? lastTokenRef.current;
  const isReconnecting =
    status === 'connecting' && lastTokenRef.current !== null;

  // Adapt editor placeholder based on layout
  const placeholder =
    layout === 'compact' ? `${user.name}...` : `${user.name} is typing...`;

  // Render different states
  if (status === 'error') {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: COLORS.neutral[950],
          padding: '20px',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            maxWidth: '300px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: `${COLORS.accent.red.base}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <span style={{ color: COLORS.accent.red.base, fontSize: '20px' }}>
              !
            </span>
          </div>
          <div
            style={{
              color: COLORS.accent.red.base,
              fontFamily: 'var(--tmnl-font-mono, monospace)',
              fontSize: 'var(--tmnl-text-sm, 14px)',
              fontWeight: 600,
              marginBottom: '8px',
            }}
          >
            Connection Error
          </div>
          <div
            style={{
              color: COLORS.neutral[400],
              fontFamily: 'var(--tmnl-font-mono, monospace)',
              fontSize: 'var(--tmnl-text-xs, 12px)',
              lineHeight: 1.4,
            }}
          >
            {error ?? 'Failed to connect to collaboration server'}
          </div>
        </div>
      </div>
    );
  }

  if (status === 'disconnected' && !effectiveToken) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: COLORS.neutral[950],
          padding: '20px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              color: COLORS.neutral[500],
              fontFamily: 'var(--tmnl-font-mono, monospace)',
              fontSize: 'var(--tmnl-text-sm, 14px)',
              marginBottom: '8px',
            }}
          >
            Not Connected
          </div>
          <div
            style={{
              color: COLORS.neutral[600],
              fontFamily: 'var(--tmnl-font-mono, monospace)',
              fontSize: 'var(--tmnl-text-xs, 12px)',
            }}
          >
            Connect to a document to start editing
          </div>
        </div>
      </div>
    );
  }

  if (status === 'connecting' && !effectiveToken) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: COLORS.neutral[950],
          color: COLORS.neutral[500],
          fontFamily: 'var(--tmnl-font-mono, monospace)',
          fontSize: 'var(--tmnl-text-sm, 14px)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              border: `2px solid ${COLORS.neutral[700]}`,
              borderTopColor: COLORS.accent.cyan.base,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 12px',
            }}
          />
          Connecting...
        </div>
      </div>
    );
  }

  // Connected (or reconnecting with cached token)
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* User indicator bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: COLORS.neutral[900],
          borderBottom: `1px solid ${COLORS.neutral[800]}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: user.color,
            boxShadow: `0 0 6px ${user.color}`,
          }}
        />
        <span
          style={{
            color: COLORS.neutral[300],
            fontFamily: 'var(--tmnl-font-mono, monospace)',
            fontSize: 'var(--tmnl-text-xs, 12px)',
            fontWeight: 500,
          }}
        >
          {user.name}
        </span>

        {/* Reconnecting indicator */}
        {isReconnecting && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginLeft: '8px',
              color: COLORS.accent.amber.base,
              fontFamily: 'var(--tmnl-font-mono, monospace)',
              fontSize: 'var(--tmnl-text-xs, 12px)',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                border: `1.5px solid ${COLORS.accent.amber.base}`,
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            Reconnecting...
          </span>
        )}

        {layout !== 'compact' && (
          <span
            style={{
              marginLeft: 'auto',
              color: COLORS.neutral[600],
              fontFamily: 'var(--tmnl-font-mono, monospace)',
              fontSize: 'var(--tmnl-text-xs, 12px)',
            }}
          >
            {width}×{height}
          </span>
        )}
      </div>

      {/* Editor */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {effectiveToken && (
          <CollaborativeTiptapEditor
            clientToken={effectiveToken}
            user={user}
            placeholder={placeholder}
            style={{
              height: '100%',
              fontSize:
                layout === 'compact'
                  ? 'var(--tmnl-text-xs, 12px)'
                  : 'var(--tmnl-text-sm, 14px)',
            }}
          />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function EditorFloatingPanel({
  panelId,
  user,
  label,
  initialPosition,
  initialDimensions,
  onClose,
}: EditorFloatingPanelProps) {
  // Register panel on mount (STABLE - never depends on connection status)
  useEffect(() => {
    const config = createPanelConfig(
      panelId,
      `${label} — ${user.name}`,
      initialPosition,
      initialDimensions
    );
    registerPanel(config);

    return () => {
      unregisterPanel(panelId);
    };
  }, [panelId, label, user.name, initialPosition, initialDimensions]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  return (
    <FloatingPanel
      id={panelId}
      title={`${label} — ${user.name}`}
      onClose={handleClose}
    >
      <EditorContentWithState user={user} />
    </FloatingPanel>
  );
}

export default EditorFloatingPanel;
