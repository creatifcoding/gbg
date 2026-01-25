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
import { EditorFloatingPanel } from './collaboration/EditorFloatingPanel';
import { UserPresenceList } from './collaboration/UserPresenceList';

// =============================================================================
// Design Tokens (TMNL Design System)
// =============================================================================

const colors = {
  bg: {
    base: '#0a0a0b',
    elevated: '#111113',
    surface: '#18181b',
    hover: '#27272a',
  },
  border: {
    subtle: '#27272a',
    default: '#3f3f46',
    focus: '#52525b',
  },
  text: {
    primary: '#fafafa',
    secondary: '#a1a1aa',
    tertiary: '#71717a',
    muted: '#52525b',
  },
  accent: {
    cyan: '#22d3ee',
    cyanMuted: 'rgba(34, 211, 238, 0.15)',
    green: '#4ade80',
    greenMuted: 'rgba(74, 222, 128, 0.15)',
    amber: '#fbbf24',
    amberMuted: 'rgba(251, 191, 36, 0.15)',
    red: '#f87171',
    redMuted: 'rgba(248, 113, 113, 0.15)',
  },
};

const typography = {
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontMono: "'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace",
  sizes: {
    xs: '12px',
    sm: '13px',
    base: '14px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
  },
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.625,
  },
};

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
// localStorage Keys
// =============================================================================

const STORAGE_KEY_DOC_ID = 'tmnl:collab:docId';
const STORAGE_KEY_PET_NAME = 'tmnl:collab:petName';

// =============================================================================
// Icon Components
// =============================================================================

function IconPlus({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconFolder({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </svg>
  );
}

function IconSearch({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconX({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconDocument({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function IconTrash({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function IconRefresh({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

// =============================================================================
// Button Components
// =============================================================================

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
  disabled?: boolean;
  icon?: React.ReactNode;
}

function Button({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  disabled,
  icon,
}: ButtonProps) {
  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.medium,
    borderRadius: '6px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.15s ease',
    border: 'none',
  };

  const sizeStyles: React.CSSProperties =
    size === 'sm'
      ? { padding: '6px 10px', fontSize: typography.sizes.xs }
      : { padding: '8px 14px', fontSize: typography.sizes.sm };

  const variantStyles: React.CSSProperties =
    variant === 'primary'
      ? {
          background: colors.accent.cyan,
          color: colors.bg.base,
        }
      : variant === 'ghost'
      ? {
          background: 'transparent',
          color: colors.text.secondary,
        }
      : {
          background: colors.bg.surface,
          color: colors.text.primary,
          border: `1px solid ${colors.border.subtle}`,
        };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...baseStyles, ...sizeStyles, ...variantStyles }}
    >
      {icon}
      {children}
    </button>
  );
}

// =============================================================================
// User Spawn Button
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
        padding: '8px 14px',
        background: disabled ? colors.bg.elevated : colors.bg.surface,
        border: `1px solid ${
          disabled ? colors.border.subtle : colors.border.default
        }`,
        borderRadius: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s ease',
      }}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: user.color,
          boxShadow: `0 0 8px ${user.color}`,
        }}
      />
      <span
        style={{
          color: colors.text.primary,
          fontFamily: typography.fontFamily,
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.medium,
        }}
      >
        {user.name}
      </span>
    </button>
  );
}

// =============================================================================
// Document Picker Drawer
// =============================================================================

interface DocumentPickerProps {
  isOpen: boolean;
  currentDocId: string;
  onSelectDoc: (docId: string, petName: string) => void;
  onClose: () => void;
  onNewDoc: () => void;
}

function DocumentPicker({
  isOpen,
  currentDocId,
  onSelectDoc,
  onClose,
  onNewDoc,
}: DocumentPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [manualDocId, setManualDocId] = useState('');

  // @ts-expect-error — version mismatch in monorepo, works at runtime
  const recentDocs = useAtomValue(recentDocsAtom) as readonly RecentDoc[];
  const removeFromRecentDocs = useAtomSet(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collaborationOps.removeFromRecentDocs as any
  );
  const loadRecentDocs = useAtomSet(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collaborationOps.loadRecentDocs as any
  );

  // Load recent docs on mount
  useEffect(() => {
    if (isOpen) {
      loadRecentDocs(undefined);
    }
  }, [isOpen, loadRecentDocs]);

  // Filter docs by search
  const filteredDocs = useMemo(() => {
    if (!searchQuery.trim()) return recentDocs;
    const q = searchQuery.toLowerCase();
    return recentDocs.filter(
      (doc) =>
        doc.petName.toLowerCase().includes(q) ||
        doc.docId.toLowerCase().includes(q)
    );
  }, [recentDocs, searchQuery]);

  const handleDelete = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeFromRecentDocs({ docId });
  };

  const handleConnectManual = () => {
    if (manualDocId.trim()) {
      const petName = generatePetName();
      onSelectDoc(manualDocId.trim(), petName);
      setManualDocId('');
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: colors.bg.elevated,
          border: `1px solid ${colors.border.subtle}`,
          borderRadius: '12px',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: `1px solid ${colors.border.subtle}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <IconFolder size={18} />
            <h2
              style={{
                margin: 0,
                color: colors.text.primary,
                fontFamily: typography.fontFamily,
                fontSize: typography.sizes.lg,
                fontWeight: typography.weights.semibold,
              }}
            >
              Documents
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: colors.text.tertiary,
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
            }}
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Search & Actions */}
        <div
          style={{
            padding: '12px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            borderBottom: `1px solid ${colors.border.subtle}`,
          }}
        >
          {/* Search Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              background: colors.bg.base,
              borderRadius: '8px',
              border: `1px solid ${colors.border.subtle}`,
            }}
          >
            <IconSearch size={16} />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: colors.text.primary,
                fontFamily: typography.fontFamily,
                fontSize: typography.sizes.sm,
              }}
            />
          </div>

          {/* Connect by ID */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
            }}
          >
            <input
              type="text"
              placeholder="Enter document ID..."
              value={manualDocId}
              onChange={(e) => setManualDocId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConnectManual()}
              style={{
                flex: 1,
                padding: '10px 12px',
                background: colors.bg.base,
                border: `1px solid ${colors.border.subtle}`,
                borderRadius: '8px',
                color: colors.text.primary,
                fontFamily: typography.fontMono,
                fontSize: typography.sizes.xs,
                outline: 'none',
              }}
            />
            <Button
              onClick={handleConnectManual}
              disabled={!manualDocId.trim()}
              size="md"
            >
              Connect
            </Button>
          </div>

          {/* New Document */}
          <Button
            onClick={onNewDoc}
            variant="primary"
            icon={<IconPlus size={14} />}
          >
            New Document
          </Button>
        </div>

        {/* Document List */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '8px',
          }}
        >
          {filteredDocs.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: colors.text.tertiary,
                fontFamily: typography.fontFamily,
                fontSize: typography.sizes.sm,
              }}
            >
              {searchQuery
                ? 'No documents match your search'
                : 'No recent documents'}
            </div>
          ) : (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
            >
              {filteredDocs.map((doc) => {
                const isActive = doc.docId === currentDocId;
                return (
                  <div
                    key={doc.docId}
                    onClick={() => onSelectDoc(doc.docId, doc.petName)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      background: isActive
                        ? colors.accent.cyanMuted
                        : 'transparent',
                      border: `1px solid ${
                        isActive ? colors.accent.cyan : 'transparent'
                      }`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.1s ease',
                    }}
                  >
                    <div
                      style={{
                        color: isActive
                          ? colors.accent.cyan
                          : colors.text.tertiary,
                      }}
                    >
                      <IconDocument size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          color: isActive
                            ? colors.accent.cyan
                            : colors.text.primary,
                          fontFamily: typography.fontFamily,
                          fontSize: typography.sizes.sm,
                          fontWeight: typography.weights.medium,
                          marginBottom: '2px',
                        }}
                      >
                        {doc.petName}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span
                          style={{
                            color: colors.text.muted,
                            fontFamily: typography.fontMono,
                            fontSize: typography.sizes.xs,
                          }}
                        >
                          {doc.docId.slice(-12)}
                        </span>
                        <span
                          style={{
                            color: colors.text.muted,
                            fontSize: typography.sizes.xs,
                          }}
                        >
                          ·
                        </span>
                        <span
                          style={{
                            color: colors.text.muted,
                            fontFamily: typography.fontFamily,
                            fontSize: typography.sizes.xs,
                          }}
                        >
                          {formatTime(doc.lastAccessed)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(doc.docId, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: colors.text.muted,
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '4px',
                        display: 'flex',
                        opacity: 0.6,
                        transition: 'opacity 0.1s',
                      }}
                      title="Remove from recent"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Status Indicator
// =============================================================================

function StatusIndicator({ status }: { status: string }) {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return { color: colors.accent.green, label: 'Connected' };
      case 'connecting':
        return { color: colors.accent.amber, label: 'Connecting...' };
      case 'error':
        return { color: colors.accent.red, label: 'Error' };
      default:
        return { color: colors.text.muted, label: 'Disconnected' };
    }
  };

  const config = getStatusConfig();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: config.color,
          boxShadow:
            status === 'connected' ? `0 0 8px ${config.color}` : 'none',
        }}
      />
      <span
        style={{
          color: colors.text.secondary,
          fontFamily: typography.fontFamily,
          fontSize: typography.sizes.sm,
        }}
      >
        {config.label}
      </span>
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addToRecentDocs = useAtomSet(collaborationOps.addToRecentDocs as any);

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

  // Track document in recent docs on connect
  useEffect(() => {
    if (status === 'connected') {
      addToRecentDocs({ docId, petName });
    }
  }, [status, docId, petName, addToRecentDocs]);

  // Calculate next spawn position (cascade)
  const getNextPosition = useCallback((index: number) => {
    const baseX = 80;
    const baseY = 80;
    const offsetX = 50;
    const offsetY = 50;
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
    setShowDocPicker(false);
  }, [disconnect]);

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

  // Spawn default editors on first connect (only once)
  useEffect(() => {
    if (status === 'connected' && !hasAutoSpawned) {
      setHasAutoSpawned(true);
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
          background: colors.bg.base,
          fontFamily: typography.fontFamily,
        }}
      >
        {/* Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            padding: '14px 24px',
            borderBottom: `1px solid ${colors.border.subtle}`,
            background: colors.bg.elevated,
          }}
        >
          {/* Title */}
          <h1
            style={{
              margin: 0,
              fontSize: typography.sizes.lg,
              fontWeight: typography.weights.semibold,
              color: colors.text.primary,
              fontFamily: typography.fontFamily,
            }}
          >
            Collaboration
          </h1>

          {/* Document Badge */}
          <button
            onClick={() => setShowDocPicker(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 12px',
              background: colors.bg.surface,
              border: `1px solid ${colors.border.subtle}`,
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <IconDocument size={14} />
            <span
              style={{
                color: colors.accent.cyan,
                fontFamily: typography.fontFamily,
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.medium,
              }}
            >
              {petName}
            </span>
            <span
              style={{
                color: colors.text.muted,
                fontFamily: typography.fontMono,
                fontSize: typography.sizes.xs,
              }}
            >
              {docId.slice(-8)}
            </span>
          </button>

          {/* Status */}
          <StatusIndicator status={status} />

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button
              onClick={handleReconnect}
              size="sm"
              icon={<IconRefresh size={14} />}
            >
              Reconnect
            </Button>
            <Button
              onClick={() => setShowDocPicker(true)}
              size="sm"
              icon={<IconFolder size={14} />}
            >
              Documents
            </Button>
          </div>
        </header>

        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '12px 24px',
            borderBottom: `1px solid ${colors.border.subtle}`,
          }}
        >
          {/* Spawn Buttons */}
          <span
            style={{
              color: colors.text.tertiary,
              fontSize: typography.sizes.sm,
            }}
          >
            Add Editor:
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

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Connected Users */}
          <UserPresenceList direction="horizontal" maxVisible={6} />
        </div>

        {/* Error Banner */}
        {error && (
          <div
            style={{
              padding: '10px 24px',
              background: colors.accent.redMuted,
              borderBottom: `1px solid ${colors.accent.red}`,
              color: colors.accent.red,
              fontFamily: typography.fontFamily,
              fontSize: typography.sizes.sm,
            }}
          >
            Connection error: {error}
          </div>
        )}

        {/* Canvas Area */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            background: colors.bg.base,
          }}
        >
          <FloatingBoundsProvider
            padding={16}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `
                linear-gradient(${colors.border.subtle}30 1px, transparent 1px),
                linear-gradient(90deg, ${colors.border.subtle}30 1px, transparent 1px)
              `,
              backgroundSize: '48px 48px',
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
                initialDimensions={{ width: 520, height: 420 }}
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
                }}
              >
                <div
                  style={{
                    color: colors.text.secondary,
                    fontSize: typography.sizes.base,
                    marginBottom: '8px',
                  }}
                >
                  No editors open
                </div>
                <div
                  style={{
                    color: colors.text.muted,
                    fontSize: typography.sizes.sm,
                  }}
                >
                  Click a user above to spawn an editor panel
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
                  color: colors.accent.amber,
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    border: `2px solid ${colors.border.default}`,
                    borderTopColor: colors.accent.cyan,
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 16px',
                  }}
                />
                <span style={{ fontSize: typography.sizes.sm }}>
                  Connecting to server...
                </span>
              </div>
            )}
          </FloatingBoundsProvider>
        </div>

        {/* Footer */}
        <footer
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 24px',
            borderTop: `1px solid ${colors.border.subtle}`,
            background: colors.bg.elevated,
          }}
        >
          <span
            style={{
              color: colors.text.muted,
              fontFamily: typography.fontMono,
              fontSize: typography.sizes.xs,
            }}
          >
            y-sweet · localhost:8080
          </span>
          <span
            style={{
              color: colors.text.muted,
              fontFamily: typography.fontFamily,
              fontSize: typography.sizes.xs,
            }}
          >
            Yjs + Tiptap + Effect
          </span>
        </footer>
      </div>

      {/* Document Picker Modal */}
      <DocumentPicker
        isOpen={showDocPicker}
        currentDocId={docId}
        onSelectDoc={handleSelectDoc}
        onClose={() => setShowDocPicker(false)}
        onNewDoc={handleNewDocument}
      />

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
