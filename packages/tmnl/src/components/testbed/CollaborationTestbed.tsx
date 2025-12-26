/**
 * CollaborationTestbed
 *
 * Demonstrates y-sweet real-time collaboration with two side-by-side editors.
 * Both editors connect to the same document, showing live sync.
 *
 * @module testbed/CollaborationTestbed
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import {
  CollaborativeTiptapEditor,
  collaborationOps,
  collaborationStatusAtom,
  clientTokenAtom,
  collaborationErrorAtom,
  connectedUsersAtom,
  generateUserColor,
  type CollaborationUser,
} from '@/lib/editor/v3';

// =============================================================================
// Types
// =============================================================================

interface EditorPanelProps {
  user: CollaborationUser;
  label: string;
}

// =============================================================================
// Editor Panel
// =============================================================================

const EditorPanel: React.FC<EditorPanelProps> = ({ user, label }) => {
  const clientToken = useAtomValue(clientTokenAtom);

  if (!clientToken) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--tmnl-surface-1, #1e1e1e)',
          borderRadius: '8px',
          color: 'var(--tmnl-text-muted, #666)',
        }}
      >
        Waiting for connection...
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: 'var(--tmnl-surface-2, #2a2a2a)',
          borderRadius: '6px',
        }}
      >
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: user.color,
            boxShadow: `0 0 8px ${user.color}`,
          }}
        />
        <span style={{ color: 'var(--tmnl-text-primary, #e0e0e0)', fontWeight: 500 }}>
          {label}
        </span>
        <span style={{ color: 'var(--tmnl-text-muted, #666)', fontSize: '12px' }}>
          ({user.name})
        </span>
      </div>
      <CollaborativeTiptapEditor
        clientToken={clientToken}
        user={user}
        placeholder={`${user.name} is typing...`}
        autoFocus={label === 'Editor A'}
        style={{ flex: 1 }}
      />
    </div>
  );
};

// =============================================================================
// Status Bar
// =============================================================================

const StatusBar: React.FC = () => {
  const status = useAtomValue(collaborationStatusAtom);
  const error = useAtomValue(collaborationErrorAtom);
  const users = useAtomValue(connectedUsersAtom);

  const statusColor = {
    disconnected: 'var(--tmnl-text-muted, #666)',
    connecting: 'var(--tmnl-accent-gold, #ffcc5c)',
    connected: 'var(--tmnl-status-success, #4ade80)',
    error: 'var(--tmnl-status-error, #ef4444)',
  }[status];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '12px 16px',
        background: 'var(--tmnl-surface-1, #1e1e1e)',
        borderRadius: '8px',
        fontSize: '14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: statusColor,
            boxShadow: status === 'connected' ? `0 0 8px ${statusColor}` : 'none',
          }}
        />
        <span style={{ color: 'var(--tmnl-text-secondary, #a0a0a0)' }}>
          Status: <strong style={{ color: statusColor }}>{status}</strong>
        </span>
      </div>

      {error && (
        <span style={{ color: 'var(--tmnl-status-error, #ef4444)' }}>
          Error: {error}
        </span>
      )}

      <div style={{ marginLeft: 'auto', color: 'var(--tmnl-text-muted, #666)' }}>
        {users.length} user{users.length !== 1 ? 's' : ''} connected
      </div>
    </div>
  );
};

// =============================================================================
// Main Testbed
// =============================================================================

export const CollaborationTestbed: React.FC = () => {
  const [docId] = useState(() => `testbed-${Date.now()}`);
  const status = useAtomValue(collaborationStatusAtom);

  // Get callable functions from fn atoms via useAtomSet
  // runtimeAtom.fn<T>()() returns a Writable, not a callable function
  const connect = useAtomSet(collaborationOps.connect, { mode: 'promise' });
  const disconnect = useAtomSet(collaborationOps.disconnect, { mode: 'promise' });

  // Define two users for the demo
  const userA: CollaborationUser = {
    name: 'Alice',
    color: generateUserColor('Alice'),
  };

  const userB: CollaborationUser = {
    name: 'Bob',
    color: generateUserColor('Bob'),
  };

  // Connect on mount
  useEffect(() => {
    connect({ docId });

    return () => {
      disconnect(undefined);
    };
  }, [docId, connect, disconnect]);

  const handleReconnect = useCallback(async () => {
    await disconnect(undefined);
    await connect({ docId });
  }, [docId, connect, disconnect]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '24px',
        height: '100%',
        background: 'var(--tmnl-surface-0, #1a1a1a)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h1
          style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 600,
            color: 'var(--tmnl-text-primary, #e0e0e0)',
          }}
        >
          Collaboration Testbed
        </h1>
        <span
          style={{
            padding: '4px 8px',
            background: 'var(--tmnl-surface-2, #2a2a2a)',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'var(--tmnl-font-mono, monospace)',
            color: 'var(--tmnl-accent-cyan, #4ecdc4)',
          }}
        >
          doc: {docId}
        </span>
        <button
          onClick={handleReconnect}
          style={{
            marginLeft: 'auto',
            padding: '8px 16px',
            background: 'var(--tmnl-surface-2, #2a2a2a)',
            border: '1px solid var(--tmnl-surface-3, #3a3a3a)',
            borderRadius: '6px',
            color: 'var(--tmnl-text-primary, #e0e0e0)',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Reconnect
        </button>
      </div>

      {/* Status */}
      <StatusBar />

      {/* Instructions */}
      <div
        style={{
          padding: '12px 16px',
          background: 'var(--tmnl-surface-1, #1e1e1e)',
          borderRadius: '8px',
          borderLeft: '3px solid var(--tmnl-accent-cyan, #4ecdc4)',
          fontSize: '14px',
          color: 'var(--tmnl-text-secondary, #a0a0a0)',
        }}
      >
        <strong style={{ color: 'var(--tmnl-text-primary, #e0e0e0)' }}>
          Real-time sync demo:
        </strong>{' '}
        Type in either editor — changes appear instantly in the other.
        Both editors share the same Yjs document via y-sweet.
      </div>

      {/* Editors */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: '16px',
          minHeight: 0,
        }}
      >
        <EditorPanel user={userA} label="Editor A" />
        <EditorPanel user={userB} label="Editor B" />
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'var(--tmnl-surface-1, #1e1e1e)',
          borderRadius: '6px',
          fontSize: '12px',
          color: 'var(--tmnl-text-muted, #666)',
        }}
      >
        <span>y-sweet server: localhost:8080</span>
        <span>Yjs + Tiptap + Effect</span>
      </div>
    </div>
  );
};

export default CollaborationTestbed;
