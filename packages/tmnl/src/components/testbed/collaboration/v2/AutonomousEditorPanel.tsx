/**
 * AutonomousEditorPanel
 *
 * Self-contained editor panel that owns its entire lifecycle:
 * - Document selection (via drawer, not modal)
 * - Connection management (connect/disconnect/reconnect)
 * - Presence display (avatars in header)
 * - Contextual toolbar that morphs based on state
 *
 * CRITICAL: Uses panel-scoped atoms from panel-stx.ts for STATE ISOLATION.
 * Each panel has its own atoms keyed by panelId — NO SHARED GLOBAL STATE.
 *
 * Document persistence is handled by NATS-backed DocumentRegistryService.
 * The panel integrates with useDocumentManager hooks for CRUD operations.
 *
 * @module testbed/collaboration/v2/AutonomousEditorPanel
 */

import { useEffect, useCallback, useRef, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ClientToken } from '@y-sweet/sdk';
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react';

import {
  CollaborativeTiptapEditor,
  type CollaborationUser,
} from '@/lib/editor/v3';
import {
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
  VANTA_SPACING,
  VANTA_BORDERS,
  VANTA_ANIMATION,
} from '@/components/portal/tokens';

import { ContextualToolbar, type ToolbarState } from './ContextualToolbar';
import { DocumentDrawer } from './DocumentDrawer';
import { PresenceAvatars, type User } from './PresenceAvatars';

// Import panel-scoped atoms (connection state, drawer state)
import {
  getPanelAtoms,
  createPanelArgs,
  panelOps,
  generatePetName,
  type ConnectionStatus,
  type RecentDoc,
} from './panel-stx';

// Import NATS-backed document hooks
import {
  useDocuments,
  useDocumentOpsWithRegistry,
} from '@/lib/editor/v3/hooks';
import type { DocumentId, IdentityId } from '@/lib/editor/v3/schemas/document';

// Import panelRegistry for registry-bound operations
import { panelRegistry } from './panel-stx';

// =============================================================================
// Types
// =============================================================================

export interface AutonomousEditorPanelProps {
  /** Unique panel ID — CRITICAL for state isolation */
  panelId: string;
  /** User info for this editor instance */
  user: CollaborationUser;
  /** Display label (e.g., "Editor A") */
  label: string;
  /** Initial document ID to connect to (optional) */
  initialDocId?: string;
  /** Callback when panel requests close */
  onClose?: () => void;
  /** Use NATS-backed document persistence (vs localStorage) */
  useNatsPersistence?: boolean;
}

// =============================================================================
// Helper: Map connection status to toolbar state
// =============================================================================

function getToolbarState(
  status: ConnectionStatus,
  isDrawerOpen: boolean
): ToolbarState {
  if (isDrawerOpen) return 'selecting';
  switch (status) {
    case 'connected':
      return 'connected';
    case 'connecting':
      return 'connecting';
    default:
      return 'disconnected';
  }
}

// =============================================================================
// Main Component
// =============================================================================

export function AutonomousEditorPanel({
  panelId,
  user,
  label,
  initialDocId,
  onClose,
  useNatsPersistence = true,
}: AutonomousEditorPanelProps) {
  // ---------------------------------------------------------------------------
  // Panel-Scoped Atoms (ISOLATED STATE per panelId)
  // ---------------------------------------------------------------------------
  const atoms = useMemo(() => getPanelAtoms(panelId), [panelId]);
  const args = useMemo(() => createPanelArgs(panelId), [panelId]);

  // Read panel-specific state (types from PanelAtoms interface)
  const status = useAtomValue(atoms.status);
  const clientToken = useAtomValue(atoms.clientToken);
  const error = useAtomValue(atoms.error);
  const connectedUsers = useAtomValue(atoms.users);
  const currentPetName = useAtomValue(atoms.petName);
  const isDrawerOpen = useAtomValue(atoms.drawerOpen);
  const recentDocs = useAtomValue(atoms.recentDocs);

  // Operation dispatchers (panel-scoped)
  const doConnect = useAtomSet(panelOps.connect as any);
  const doDisconnect = useAtomSet(panelOps.disconnect as any);
  const doSetPetName = useAtomSet(panelOps.setPetName as any);
  const doOpenDrawer = useAtomSet(panelOps.openDrawer as any);
  const doCloseDrawer = useAtomSet(panelOps.closeDrawer as any);
  const doAddToRecent = useAtomSet(panelOps.addToRecentDocs as any);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // ---------------------------------------------------------------------------
  // NATS-Backed Document State
  // ---------------------------------------------------------------------------
  // Read document list from atoms (via panelRegistry context)
  const { documentList, error: documentsError } = useDocuments();

  // Use registry-bound operations so atoms update in panelRegistry
  // (which PanelRegistryProvider injects into React context)
  const {
    create: createDocument,
    purge: purgeDocument,
    loadList,
    isLoading: isDocumentsLoading,
  } = useDocumentOpsWithRegistry(panelRegistry);

  // Track if we've loaded the document list
  const [hasLoadedList, setHasLoadedList] = useState(false);

  // ---------------------------------------------------------------------------
  // Local State (UI-only, not shared)
  // ---------------------------------------------------------------------------
  const lastTokenRef = useRef<ClientToken | null>(null);

  // Cache the last valid token for reconnect resilience
  if (clientToken) {
    lastTokenRef.current = clientToken;
  }

  const effectiveToken = clientToken ?? lastTokenRef.current;
  const isReconnecting =
    status === 'connecting' && lastTokenRef.current !== null;

  // ---------------------------------------------------------------------------
  // Connection Handlers
  // ---------------------------------------------------------------------------

  const handleConnect = useCallback(
    (docId: string, title?: string) => {
      const name = title ?? generatePetName();
      doCloseDrawer(args.closeDrawer());
      doSetPetName(args.setPetName(name));
      doConnect(args.connect(docId));

      // Add to recent docs
      doAddToRecent({ docId, petName: name });
    },
    [doConnect, doCloseDrawer, doSetPetName, doAddToRecent, args]
  );

  const handleDisconnect = useCallback(() => {
    doDisconnect(args.disconnect());
    lastTokenRef.current = null;
  }, [doDisconnect, args]);

  const handleNewDocument = useCallback(async () => {
    if (useNatsPersistence) {
      try {
        // Create via NATS-backed service
        const { metadata } = await createDocument(
          { title: generatePetName(), visibility: 'private' },
          user.name as IdentityId
        );
        // Connect to the newly created document
        doCloseDrawer(args.closeDrawer());
        doSetPetName(args.setPetName(metadata.title));
        // Use the returned token directly to set panel state
        // Note: panelOps.connect fetches token, but we already have it
        // For now, just use the standard connect flow
        doConnect(args.connect(metadata.id as string));
      } catch (err) {
        console.error(
          '[AutonomousEditorPanel] Failed to create document:',
          err
        );
      }
    } else {
      // Legacy: create ephemeral document
      const newDocId = `doc-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const newPetName = generatePetName();
      handleConnect(newDocId, newPetName);
    }
  }, [
    useNatsPersistence,
    createDocument,
    user.name,
    doCloseDrawer,
    doSetPetName,
    doConnect,
    args,
    handleConnect,
  ]);

  const handleSelectFromDrawer = useCallback(
    (docId: string) => {
      if (useNatsPersistence) {
        // Find the document in the list to get its title
        const doc = documentList.find((d) => d.id === docId);
        handleConnect(docId, doc?.title);
      } else {
        handleConnect(docId);
      }
    },
    [useNatsPersistence, documentList, handleConnect]
  );

  const handleDeleteDoc = useCallback(
    async (docId: string) => {
      if (useNatsPersistence) {
        // purgeDocument returns a Promise that runs Effect internally
        // Errors propagate as rejected promises
        await purgeDocument(docId as DocumentId);
        // No need to refresh - documentListAtom auto-derives from documentsAtom
      }
    },
    [useNatsPersistence, purgeDocument]
  );

  const handleOpenDrawer = useCallback(() => {
    doOpenDrawer(args.openDrawer());
  }, [doOpenDrawer, args]);

  const handleCloseDrawer = useCallback(() => {
    doCloseDrawer(args.closeDrawer());
  }, [doCloseDrawer, args]);

  // Load document list on drawer open (NATS mode)
  useEffect(() => {
    if (isDrawerOpen && useNatsPersistence && !hasLoadedList) {
      loadList()
        .then(() => setHasLoadedList(true))
        .catch((err) => {
          console.error(
            '[AutonomousEditorPanel] Failed to load document list:',
            err
          );
        });
    }
  }, [isDrawerOpen, useNatsPersistence, hasLoadedList, loadList]);

  // Connect to initial doc on mount
  useEffect(() => {
    if (initialDocId) {
      handleConnect(initialDocId);
    }
    return () => {
      doDisconnect(args.disconnect());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Derived State
  // ---------------------------------------------------------------------------

  const toolbarState = getToolbarState(status, isDrawerOpen);

  // Map connected users to presence avatars format
  const presenceUsers: User[] = connectedUsers.map((u) => ({
    id: u.name,
    name: u.name,
    color: u.color,
    isOnline: true,
  }));

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: VANTA_COLORS.gradient.surface,
        borderRadius: VANTA_BORDERS.radius.md,
        overflow: 'hidden',
        position: 'relative',
        fontFamily: VANTA_TYPOGRAPHY.family.sans,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['3']}`,
          borderBottom: VANTA_BORDERS.style.hairline,
          backgroundColor: VANTA_COLORS.surface.elevated,
          gap: VANTA_SPACING['3'],
          minHeight: 48,
        }}
      >
        {/* Left: User indicator + label */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: VANTA_SPACING['2'],
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: user.color,
              boxShadow: `0 0 6px ${user.color}`,
            }}
          />
          <span
            style={{
              ...VANTA_TYPOGRAPHY.preset.label,
              color: VANTA_COLORS.text.secondary,
            }}
          >
            {label}
          </span>
          {/* NATS indicator */}
          {useNatsPersistence && (
            <span
              style={{
                fontSize: 9,
                padding: '1px 4px',
                borderRadius: 3,
                backgroundColor: 'rgba(34, 211, 238, 0.15)',
                color: '#22d3ee',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              NATS
            </span>
          )}
        </div>

        {/* Center: Contextual Toolbar */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <ContextualToolbar
            id={panelId}
            state={toolbarState}
            documentName={currentPetName ?? undefined}
            recentDocs={recentDocs}
            onOpenDocPicker={handleOpenDrawer}
            onNewDocument={handleNewDocument}
            onDisconnect={handleDisconnect}
            onSelectDoc={handleSelectFromDrawer}
          >
            {/* Presence avatars shown when connected */}
            {status === 'connected' && presenceUsers.length > 0 && (
              <PresenceAvatars users={presenceUsers} maxVisible={3} size="sm" />
            )}
          </ContextualToolbar>
        </div>

        {/* Right: Close button */}
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: VANTA_COLORS.text.muted,
              cursor: 'pointer',
              padding: VANTA_SPACING['1'],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: VANTA_BORDERS.radius.sm,
              transition: VANTA_ANIMATION.transition.colors,
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = VANTA_COLORS.text.primary;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = VANTA_COLORS.text.muted;
            }}
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Editor or State Content */}
        <AnimatePresence mode="wait">
          {status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: VANTA_COLORS.surface.base,
                padding: VANTA_SPACING['6'],
              }}
            >
              <div style={{ textAlign: 'center', maxWidth: 280 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    backgroundColor: VANTA_COLORS.accent.roseGlow,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                  }}
                >
                  <span
                    style={{ color: VANTA_COLORS.accent.rose, fontSize: 18 }}
                  >
                    !
                  </span>
                </div>
                <div
                  style={{
                    color: VANTA_COLORS.accent.rose,
                    ...VANTA_TYPOGRAPHY.preset.cardTitle,
                    marginBottom: VANTA_SPACING['1.5'],
                  }}
                >
                  Connection Error
                </div>
                <div
                  style={{
                    color: VANTA_COLORS.text.muted,
                    ...VANTA_TYPOGRAPHY.preset.cardSubtitle,
                  }}
                >
                  {error ??
                    documentsError ??
                    'Failed to connect to collaboration server'}
                </div>
              </div>
            </motion.div>
          )}

          {status === 'disconnected' && !effectiveToken && (
            <motion.div
              key="disconnected"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: VANTA_COLORS.surface.base,
                padding: VANTA_SPACING['6'],
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    color: VANTA_COLORS.text.secondary,
                    ...VANTA_TYPOGRAPHY.preset.cardSubtitle,
                    marginBottom: VANTA_SPACING['2'],
                  }}
                >
                  No Document Open
                </div>
                <div
                  style={{
                    color: VANTA_COLORS.text.muted,
                    ...VANTA_TYPOGRAPHY.preset.micro,
                  }}
                >
                  Select a document or create a new one
                </div>
              </div>
            </motion.div>
          )}

          {status === 'connecting' && !effectiveToken && (
            <motion.div
              key="connecting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: VANTA_COLORS.surface.base,
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{
                    width: 24,
                    height: 24,
                    border: `2px solid ${VANTA_COLORS.surface.border}`,
                    borderTopColor: VANTA_COLORS.accent.cyan,
                    borderRadius: '50%',
                    margin: '0 auto 12px',
                  }}
                />
                <span
                  style={{
                    color: VANTA_COLORS.text.secondary,
                    ...VANTA_TYPOGRAPHY.preset.micro,
                  }}
                >
                  Connecting...
                </span>
              </div>
            </motion.div>
          )}

          {(status === 'connected' || effectiveToken) && (
            <motion.div
              key="editor"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Reconnecting indicator */}
              {isReconnecting && (
                <div
                  style={{
                    padding: `${VANTA_SPACING['1.5']} ${VANTA_SPACING['3']}`,
                    backgroundColor: VANTA_COLORS.accent.amberGlow,
                    borderBottom: `1px solid ${VANTA_COLORS.accent.amberMuted}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: VANTA_SPACING['2'],
                  }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                    style={{
                      width: 10,
                      height: 10,
                      border: `1.5px solid ${VANTA_COLORS.accent.amber}`,
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                    }}
                  />
                  <span
                    style={{
                      ...VANTA_TYPOGRAPHY.preset.micro,
                      color: VANTA_COLORS.accent.amber,
                    }}
                  >
                    Reconnecting...
                  </span>
                </div>
              )}

              {/* Tiptap Editor */}
              <div style={{ flex: 1, minHeight: 0 }}>
                {effectiveToken && (
                  <CollaborativeTiptapEditor
                    clientToken={effectiveToken}
                    user={user}
                    placeholder={`${user.name} is typing...`}
                    style={{ height: '100%' }}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Document Drawer (slides from left within panel bounds) */}
        <DocumentDrawer
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
          onSelectDoc={handleSelectFromDrawer}
          onCreateNew={handleNewDocument}
          onConnectById={(docId) => handleConnect(docId)}
          documents={useNatsPersistence ? documentList : undefined}
          onDeleteDoc={useNatsPersistence ? handleDeleteDoc : undefined}
          isLoading={isDocumentsLoading}
        />
      </div>
    </motion.div>
  );
}

// =============================================================================
// Icons
// =============================================================================

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default AutonomousEditorPanel;
