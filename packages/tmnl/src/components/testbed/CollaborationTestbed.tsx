/**
 * CollaborationTestbed
 *
 * Demonstrates y-sweet real-time collaboration with floating editor panels.
 * Multiple editors connect to the same document, showing live sync with
 * draggable, resizable panels.
 *
 * @module testbed/CollaborationTestbed
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import {
  collaborationOps,
  collaborationStatusAtom,
  collaborationErrorAtom,
  generateUserColor,
  CollaborationRegistryProvider,
  recentDocsAtom,
  generatePetName,
  type CollaborationUser,
  type RecentDoc,
} from '@/lib/editor/v3';
import { FloatingPanelProvider, FloatingBoundsProvider } from '@/lib/floating';
import { COLORS } from '@/lib/capabilities/tokens';
import { EditorFloatingPanel } from './collaboration/EditorFloatingPanel';
import { CollaborationStatusBar } from './collaboration/CollaborationStatusBar';
import { UserPresenceList } from './collaboration/UserPresenceList';

// =============================================================================
// Types
// =============================================================================

interface SpawnedEditor {
  id: string;
  user: CollaborationUser;
  label: string;
  position: { x: number; y: number };
}

// =============================================================================
// User Presets
// =============================================================================

const USER_PRESETS: CollaborationUser[] = [
  { name: 'Alice', color: generateUserColor('Alice') },
  { name: 'Bob', color: generateUserColor('Bob') },
  { name: 'Charlie', color: generateUserColor('Charlie') },
  { name: 'Diana', color: generateUserColor('Diana') },
];

// =============================================================================
// Spawn Button
// =============================================================================

interface SpawnButtonProps {
  user: CollaborationUser;
  onClick: () => void;
  disabled?: boolean;
}

function SpawnButton({ user, onClick, disabled }: SpawnButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        background: disabled ? COLORS.neutral[900] : COLORS.neutral[850],
        border: `1px solid ${
          disabled ? COLORS.neutral[800] : COLORS.neutral[700]
        }`,
        borderRadius: '6px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s ease',
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
        + {user.name}
      </span>
    </button>
  );
}

// =============================================================================
// Instructions Panel
// =============================================================================

function InstructionsPanel() {
  return (
    <div
      style={{
        padding: '12px 16px',
        background: COLORS.neutral[900],
        borderRadius: '8px',
        borderLeft: `3px solid ${COLORS.accent.cyan.base}`,
      }}
    >
      <div
        style={{
          color: COLORS.neutral[200],
          fontFamily: 'var(--tmnl-font-mono, monospace)',
          fontSize: 'var(--tmnl-text-sm, 14px)',
          fontWeight: 600,
          marginBottom: '6px',
        }}
      >
        Real-time Collaboration Demo
      </div>
      <div
        style={{
          color: COLORS.neutral[400],
          fontFamily: 'var(--tmnl-font-mono, monospace)',
          fontSize: 'var(--tmnl-text-xs, 12px)',
          lineHeight: 1.5,
        }}
      >
        Spawn multiple editor panels — all share the same Yjs document via
        y-sweet.
        <br />
        Drag panels to reposition, resize from edges. Changes sync instantly.
      </div>
    </div>
  );
}

// =============================================================================
// localStorage Keys
// =============================================================================

const STORAGE_KEY_DOC_ID = 'tmnl:collab:docId';
const STORAGE_KEY_PET_NAME = 'tmnl:collab:petName';
const STORAGE_KEY_RECENT_DOCS = 'tmnl:collab:recentDocs';

// NOTE: RecentDoc type, generatePetName, and registry operations are now
// imported from @/lib/editor/v3 atoms (collaborationOps)

// =============================================================================
// Document Picker Component
// =============================================================================

interface DocumentPickerProps {
  currentDocId: string;
  onSelectDoc: (docId: string, petName: string) => void;
  onClose: () => void;
}

function DocumentPicker({
  currentDocId,
  onSelectDoc,
  onClose,
}: DocumentPickerProps) {
  // @ts-expect-error — version mismatch in monorepo, works at runtime
  const recentDocs = useAtomValue(recentDocsAtom) as readonly RecentDoc[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const removeFromRecentDocs = useAtomSet(
    collaborationOps.removeFromRecentDocs as any
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadRecentDocs = useAtomSet(collaborationOps.loadRecentDocs as any);

  // Load recent docs on mount
  useEffect(() => {
    loadRecentDocs(undefined);
  }, [loadRecentDocs]);

  const handleDelete = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeFromRecentDocs({ docId });
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: COLORS.neutral[900],
          border: `1px solid ${COLORS.neutral[700]}`,
          borderRadius: '8px',
          padding: '20px',
          minWidth: '400px',
          maxWidth: '500px',
          maxHeight: '70vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <h2
            style={{
              margin: 0,
              color: COLORS.neutral[200],
              fontFamily: 'var(--tmnl-font-mono, monospace)',
              fontSize: 'var(--tmnl-text-base, 16px)',
              fontWeight: 600,
            }}
          >
            Recent Documents
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: COLORS.neutral[500],
              cursor: 'pointer',
              fontSize: 'var(--tmnl-text-lg, 18px)',
            }}
          >
            ×
          </button>
        </div>

        {recentDocs.length === 0 ? (
          <div
            style={{
              color: COLORS.neutral[500],
              fontFamily: 'var(--tmnl-font-mono, monospace)',
              fontSize: 'var(--tmnl-text-sm, 14px)',
              textAlign: 'center',
              padding: '20px',
            }}
          >
            No recent documents
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentDocs.map((doc) => (
              <div
                key={doc.docId}
                onClick={() => onSelectDoc(doc.docId, doc.petName)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background:
                    doc.docId === currentDocId
                      ? COLORS.accent.cyan.base + '20'
                      : COLORS.neutral[850],
                  border: `1px solid ${
                    doc.docId === currentDocId
                      ? COLORS.accent.cyan.base
                      : COLORS.neutral[700]
                  }`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                <div>
                  <div
                    style={{
                      color:
                        doc.docId === currentDocId
                          ? COLORS.accent.cyan.base
                          : COLORS.neutral[200],
                      fontFamily: 'var(--tmnl-font-mono, monospace)',
                      fontSize: 'var(--tmnl-text-sm, 14px)',
                      fontWeight: 500,
                    }}
                  >
                    {doc.petName}
                  </div>
                  <div
                    style={{
                      color: COLORS.neutral[600],
                      fontFamily: 'var(--tmnl-font-mono, monospace)',
                      fontSize: 'var(--tmnl-text-xs, 12px)',
                    }}
                  >
                    {doc.docId.slice(-12)}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(doc.docId, e)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: COLORS.neutral[600],
                    cursor: 'pointer',
                    padding: '4px',
                    fontSize: 'var(--tmnl-text-sm, 14px)',
                  }}
                  title="Remove from recent"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Inner Testbed (needs CollaborationRegistryProvider)
// =============================================================================

function CollaborationTestbedInner() {
  // Initialize docId from localStorage or generate new
  const [docId, setDocId] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_DOC_ID);
    return stored ?? `testbed-${Date.now()}`;
  });

  // Pet name for the document
  const [petName, setPetName] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_PET_NAME);
    return stored ?? generatePetName();
  });

  const [spawnedEditors, setSpawnedEditors] = useState<SpawnedEditor[]>([]);
  const [nextEditorIndex, setNextEditorIndex] = useState(0);
  const [hasAutoSpawned, setHasAutoSpawned] = useState(false);
  const [showDocPicker, setShowDocPicker] = useState(false);

  // @ts-expect-error — version mismatch in monorepo, works at runtime
  const status = useAtomValue(collaborationStatusAtom) as string;
  // @ts-expect-error — version mismatch in monorepo, works at runtime
  const error = useAtomValue(collaborationErrorAtom) as string | null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connect = useAtomSet(collaborationOps.connect as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const disconnect = useAtomSet(collaborationOps.disconnect as any);

  // Persist docId and petName to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DOC_ID, docId);
  }, [docId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PET_NAME, petName);
  }, [petName]);

  // Connect on mount
  useEffect(() => {
    connect({ docId });
    return () => {
      disconnect(undefined);
    };
  }, [docId, connect, disconnect]);

  // Calculate next spawn position (cascade)
  const getNextPosition = useCallback((index: number) => {
    const baseX = 100;
    const baseY = 150;
    const offsetX = 40;
    const offsetY = 40;
    return {
      x: baseX + (index % 4) * offsetX,
      y: baseY + (index % 4) * offsetY,
    };
  }, []);

  // Spawn a new editor panel
  const spawnEditor = useCallback(
    (user: CollaborationUser) => {
      const id = `editor-${nextEditorIndex}`;
      const position = getNextPosition(nextEditorIndex);
      const label = `Editor ${String.fromCharCode(
        65 + (nextEditorIndex % 26)
      )}`;

      setSpawnedEditors((prev) => [...prev, { id, user, label, position }]);
      setNextEditorIndex((prev) => prev + 1);
    },
    [nextEditorIndex, getNextPosition]
  );

  // Close an editor panel
  const closeEditor = useCallback((id: string) => {
    setSpawnedEditors((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // Reconnect handler
  const handleReconnect = useCallback(async () => {
    await disconnect(undefined);
    await connect({ docId });
  }, [docId, connect, disconnect]);

  // Create new document
  const handleNewDocument = useCallback(async () => {
    await disconnect(undefined);
    const newDocId = `testbed-${Date.now()}`;
    const newPetName = generatePetName();
    setDocId(newDocId);
    setPetName(newPetName);
    setSpawnedEditors([]);
    setNextEditorIndex(0);
    setHasAutoSpawned(false);
  }, [disconnect]);

  // Clear persisted document (start fresh on next visit)
  const handleClearPersisted = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_DOC_ID);
    localStorage.removeItem(STORAGE_KEY_PET_NAME);
  }, []);

  // Select document from picker
  const handleSelectDoc = useCallback(
    async (selectedDocId: string, selectedPetName: string) => {
      await disconnect(undefined);
      setDocId(selectedDocId);
      setPetName(selectedPetName);
      setSpawnedEditors([]);
      setNextEditorIndex(0);
      setHasAutoSpawned(false);
      setShowDocPicker(false);
    },
    [disconnect]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addToRecentDocs = useAtomSet(collaborationOps.addToRecentDocs as any);

  // Track document in recent docs on connect
  useEffect(() => {
    if (status === 'connected') {
      addToRecentDocs({ docId, petName });
    }
  }, [status, docId, petName, addToRecentDocs]);

  // Spawn default editors on first connect (only once)
  useEffect(() => {
    if (status === 'connected' && !hasAutoSpawned) {
      setHasAutoSpawned(true);
      // Spawn Alice and Bob by default
      spawnEditor(USER_PRESETS[0]);
      setTimeout(() => spawnEditor(USER_PRESETS[1]), 100);
    }
  }, [status, hasAutoSpawned, spawnEditor]);

  // Which users are already spawned
  const spawnedUserNames = useMemo(
    () => new Set(spawnedEditors.map((e) => e.user.name)),
    [spawnedEditors]
  );

  return (
    <FloatingPanelProvider>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: COLORS.neutral[950],
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px 20px',
            borderBottom: `1px solid ${COLORS.neutral[800]}`,
            flexShrink: 0,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 'var(--tmnl-text-lg, 18px)',
              fontWeight: 600,
              color: COLORS.neutral[200],
              fontFamily: 'var(--tmnl-font-mono, monospace)',
            }}
          >
            Collaboration Testbed
          </h1>

          {/* Document Info */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 10px',
              background: COLORS.neutral[900],
              borderRadius: '4px',
              border: `1px solid ${COLORS.neutral[800]}`,
            }}
          >
            <span
              style={{
                color: COLORS.accent.cyan.base,
                fontFamily: 'var(--tmnl-font-mono, monospace)',
                fontSize: 'var(--tmnl-text-sm, 14px)',
                fontWeight: 600,
              }}
            >
              {petName}
            </span>
            <span
              style={{
                color: COLORS.neutral[600],
                fontFamily: 'var(--tmnl-font-mono, monospace)',
                fontSize: 'var(--tmnl-text-xs, 12px)',
              }}
              title={docId}
            >
              ({docId.slice(-8)})
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button
              onClick={handleNewDocument}
              style={{
                padding: '6px 12px',
                background: COLORS.accent.cyan.base + '20',
                border: `1px solid ${COLORS.accent.cyan.base}`,
                borderRadius: '4px',
                color: COLORS.accent.cyan.base,
                fontFamily: 'var(--tmnl-font-mono, monospace)',
                fontSize: 'var(--tmnl-text-xs, 12px)',
                cursor: 'pointer',
              }}
            >
              + New Doc
            </button>
            <button
              onClick={handleReconnect}
              style={{
                padding: '6px 12px',
                background: COLORS.neutral[850],
                border: `1px solid ${COLORS.neutral[700]}`,
                borderRadius: '4px',
                color: COLORS.neutral[300],
                fontFamily: 'var(--tmnl-font-mono, monospace)',
                fontSize: 'var(--tmnl-text-xs, 12px)',
                cursor: 'pointer',
              }}
            >
              Reconnect
            </button>
            <button
              onClick={handleClearPersisted}
              style={{
                padding: '6px 12px',
                background: COLORS.neutral[850],
                border: `1px solid ${COLORS.neutral[700]}`,
                borderRadius: '4px',
                color: COLORS.neutral[500],
                fontFamily: 'var(--tmnl-font-mono, monospace)',
                fontSize: 'var(--tmnl-text-xs, 12px)',
                cursor: 'pointer',
              }}
              title="Clear persisted document ID (start fresh on next visit)"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Control Panel */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '16px 20px',
            borderBottom: `1px solid ${COLORS.neutral[800]}`,
            flexShrink: 0,
          }}
        >
          {/* Status + Users Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <CollaborationStatusBar />
            <div style={{ marginLeft: 'auto' }}>
              <UserPresenceList direction="horizontal" maxVisible={6} />
            </div>
          </div>

          {/* Spawn Buttons Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                color: COLORS.neutral[500],
                fontFamily: 'var(--tmnl-font-mono, monospace)',
                fontSize: 'var(--tmnl-text-xs, 12px)',
                marginRight: '8px',
              }}
            >
              Spawn Editor:
            </span>
            {USER_PRESETS.map((user) => (
              <SpawnButton
                key={user.name}
                user={user}
                onClick={() => spawnEditor(user)}
                disabled={
                  status !== 'connected' || spawnedUserNames.has(user.name)
                }
              />
            ))}
          </div>

          {/* Instructions */}
          <InstructionsPanel />

          {/* Error Display */}
          {error && (
            <div
              style={{
                padding: '8px 12px',
                background: COLORS.accent.red.base + '20',
                border: `1px solid ${COLORS.accent.red.base}`,
                borderRadius: '4px',
                color: COLORS.accent.red.base,
                fontFamily: 'var(--tmnl-font-mono, monospace)',
                fontSize: 'var(--tmnl-text-xs, 12px)',
              }}
            >
              Error: {error}
            </div>
          )}
        </div>

        {/* Canvas Area (for floating panels) */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            background: `linear-gradient(${COLORS.neutral[950]}, ${COLORS.neutral[900]})`,
          }}
        >
          {/* Grid area - the visual bounds for floating panels */}
          <FloatingBoundsProvider
            padding={8}
            style={{
              position: 'absolute',
              inset: 16,
              backgroundImage: `
                linear-gradient(${COLORS.neutral[800]}40 1px, transparent 1px),
                linear-gradient(90deg, ${COLORS.neutral[800]}40 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
            }}
          >
            {/* Floating Editor Panels */}
            {spawnedEditors.map((editor) => (
              <EditorFloatingPanel
                key={editor.id}
                panelId={editor.id}
                user={editor.user}
                label={editor.label}
                initialPosition={editor.position}
                initialDimensions={{ width: 500, height: 400 }}
                onClose={() => closeEditor(editor.id)}
              />
            ))}

            {/* Empty State */}
            {spawnedEditors.length === 0 && status === 'connected' && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  color: COLORS.neutral[500],
                  fontFamily: 'var(--tmnl-font-mono, monospace)',
                  fontSize: 'var(--tmnl-text-sm, 14px)',
                }}
              >
                <div style={{ marginBottom: '8px' }}>No editors spawned</div>
                <div style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                  Click a user button above to spawn an editor panel
                </div>
              </div>
            )}

            {/* Connecting State */}
            {status === 'connecting' && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  color: COLORS.accent.amber.base,
                  fontFamily: 'var(--tmnl-font-mono, monospace)',
                  fontSize: 'var(--tmnl-text-sm, 14px)',
                }}
              >
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
                Connecting to y-sweet...
              </div>
            )}
          </FloatingBoundsProvider>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 20px',
            borderTop: `1px solid ${COLORS.neutral[800]}`,
            background: COLORS.neutral[900],
            flexShrink: 0,
          }}
        >
          <span
            style={{
              color: COLORS.neutral[600],
              fontFamily: 'var(--tmnl-font-mono, monospace)',
              fontSize: 'var(--tmnl-text-xs, 12px)',
            }}
          >
            y-sweet server: localhost:8080
          </span>
          <span
            style={{
              color: COLORS.neutral[600],
              fontFamily: 'var(--tmnl-font-mono, monospace)',
              fontSize: 'var(--tmnl-text-xs, 12px)',
            }}
          >
            Yjs + Tiptap + Effect + FloatingPanel
          </span>
        </div>
      </div>

      {/* Keyframe for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </FloatingPanelProvider>
  );
}

// =============================================================================
// Main Export (wraps with CollaborationRegistryProvider)
// =============================================================================

export function CollaborationTestbed() {
  return (
    <CollaborationRegistryProvider>
      <CollaborationTestbedInner />
    </CollaborationRegistryProvider>
  );
}

export default CollaborationTestbed;
