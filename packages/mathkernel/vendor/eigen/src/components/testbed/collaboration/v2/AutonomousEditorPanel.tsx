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

import React, { useEffect, useCallback, useRef, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layer } from 'effect';
import type { ClientToken } from '@y-sweet/sdk';
import type { JSONContent, Editor } from '@tiptap/core';
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { prosemirrorJSONToYXmlFragment } from '@tiptap/y-tiptap';

import {
  CollaborativeTiptapEditor,
  FileDrawer,
  TableOfContents,
  DefaultFormattingToolbar,
  type CollaborativeTiptapEditorHandle,
  type CollaborationUser,
  type LocalFileEntry,
  type FileMapping,
  type YDocReadyInfo,
  type HeadingItem,
  // File document atoms and operations
  makeFileDocumentOps,
  currentFilePathAtom,
  isCurrentFileDirtyAtom,
  fileListAtom,
  fileDocumentsLoadingAtom,
  fileDocumentsErrorAtom,
  FileDocumentService,
  type FilePath,
  // Save file hook & button
  useSaveFile,
  CompactSaveButton,
  markdownOps,
  // Styles
  allEditorStyles,
  codeBlockHighlightStyles,
  // Viewport hook & components
  useEditorViewport,
  ZoomIndicator,
} from '@/lib/editor/v3';
import {
  FileAccessService,
  FileAccessServiceLive,
} from '@/lib/file-browser/services/FileAccessService';
import {
  useFileIndex,
  FileIndexLayerBase,
  type IndexedFile,
} from '@/lib/file-index';
import {
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
  VANTA_SPACING,
  VANTA_BORDERS,
  VANTA_ANIMATION,
} from '@/components/portal/tokens';
import { useVariableValue } from '@/lib/variables/v2';

import { ContextualToolbar, type ToolbarState } from './ContextualToolbar';
import { DocumentDrawer } from './DocumentDrawer';
import { PresenceAvatars, type User } from './PresenceAvatars';

// EditorAI integration (Phase 5)
import {
  EditorAIDrawer,
  EditorAIProvider,
  ReconcilerTestPanel,
  TiptapAdapter,
  // Operation atoms - use with useAtomSet to get callable functions
  registerEditorOp,
  unregisterEditorOp,
  setFocusedEditorOp,
  type EditorId,
} from '@/lib/editor-ai';
import * as Option from 'effect/Option';

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

// Import panelRegistry and provider for registry-bound operations
import { panelRegistry, PanelRegistryProvider } from './panel-stx';

// =============================================================================
// Types
// =============================================================================

/** Source mode for the panel */
type SourceMode = 'cloud' | 'local';

// =============================================================================
// EditorAI Registration Component
// =============================================================================

/**
 * Registers the editor with EditorAI atoms/services when it becomes ready.
 *
 * REFACTORED: Uses effect-atom operations instead of React context.
 * This eliminates the dependency array loop caused by context version counters.
 *
 * CRITICAL: This component must NOT subscribe to any atoms (no useAtomValue).
 * Subscribing to atoms that change as a result of registration creates a
 * cascade: register → atom updates → re-render → effect cleanup → re-register.
 *
 * The atom operations are fire-and-forget. Consumers that need to react to
 * registration changes should subscribe to the atoms themselves.
 */
function EditorAIRegistration({
  editorId,
  editorInstanceRef,
  editorInstance,
}: {
  editorId: EditorId;
  editorInstanceRef: React.RefObject<Editor | null>;
  editorInstance: Editor | null;
}) {
  // Get callable functions from operation atoms via useAtomSet
  const registerEditor = useAtomSet(registerEditorOp);
  const unregisterEditor = useAtomSet(unregisterEditorOp);
  const setFocusedEditor = useAtomSet(setFocusedEditorOp);

  // Track registration to prevent double-registration on strict mode remounts
  // and to ensure we don't re-register on unrelated re-renders
  const isRegisteredRef = useRef(false);
  const registeredEditorIdRef = useRef<EditorId | null>(null);

  // Store unregister in ref so cleanup can access latest version without stale closure
  const unregisterEditorRef = useRef(unregisterEditor);
  unregisterEditorRef.current = unregisterEditor;

  useEffect(() => {
    // Guard: Skip if no editor instance yet
    if (!editorInstance) {
      return;
    }

    // Guard: Skip if already registered for this exact editor ID
    // This handles strict mode double-invoke AND prevents re-registration
    // when the component re-renders but the editor hasn't changed
    if (isRegisteredRef.current && registeredEditorIdRef.current === editorId) {
      return;
    }

    // If we were registered with a different ID, unregister first
    if (isRegisteredRef.current && registeredEditorIdRef.current !== editorId) {
      console.log('[EditorAIRegistration] Editor ID changed, re-registering');
      unregisterEditorRef.current({ id: registeredEditorIdRef.current! });
    }

    console.log('[EditorAIRegistration] Registering editor:', editorId);

    // Create EditorOperations adapter for this TipTap editor
    const operations = TiptapAdapter.createOperations(editorInstanceRef, editorId);

    // Register via atom operations (fire-and-forget, state updates reactively)
    registerEditor({ id: editorId, operations });
    setFocusedEditor({ id: editorId });

    isRegisteredRef.current = true;
    registeredEditorIdRef.current = editorId;

    // Cleanup: Unregister on unmount ONLY
    // We do NOT unregister on dep changes - that's handled above
    return () => {
      if (isRegisteredRef.current) {
        console.log('[EditorAIRegistration] Unmounting, unregistering:', registeredEditorIdRef.current);
        unregisterEditorRef.current({ id: registeredEditorIdRef.current! });
        isRegisteredRef.current = false;
        registeredEditorIdRef.current = null;
      }
    };
  }, [editorId, editorInstance, registerEditor, setFocusedEditor]);

  return null;
}

// =============================================================================
// EditorMapContext Registration Component
// =============================================================================

import {
  setEditorMapContext,
  type EditorMapContext,
} from '@/lib/commands/defaults';
import type { MapBlockMarker } from '@/lib/editor/v3/extensions/blocks/MapBlock';

/**
 * Registers the editor with EditorMapContext for tool-to-editor map insertion.
 *
 * When this editor has focus, setEditorMapContext is called with the insertMap
 * implementation that invokes the TipTap mapBlock.insertMap command.
 */
function EditorMapContextRegistration({
  editorInstanceRef,
  editorInstance,
}: {
  editorInstanceRef: React.RefObject<Editor | null>;
  editorInstance: Editor | null;
}) {
  const isRegisteredRef = useRef(false);

  useEffect(() => {
    if (!editorInstance) {
      return;
    }

    // Skip if already registered for this editor
    if (isRegisteredRef.current) {
      return;
    }

    console.log('[EditorMapContextRegistration] Registering map context');

    // Create EditorMapContext adapter for this TipTap editor
    const mapContext: EditorMapContext = {
      insertMap: (data) => {
        const editor = editorInstanceRef.current;
        if (!editor) return false;

        try {
          // Convert markers from DetectedMapData format to MapBlockMarker format
          const markers: MapBlockMarker[] = (data.markers ?? []).map((m) => ({
            position: [m.position[0], m.position[1]] as [number, number],
            color: [255, 100, 100] as [number, number, number], // Default red
          }));

          // Insert the map block with markers and viewState
          const result = editor.commands.insertMap({
            markers,
            viewState: data.viewState
              ? {
                  longitude: data.viewState.longitude,
                  latitude: data.viewState.latitude,
                  zoom: data.viewState.zoom ?? 10,
                }
              : undefined,
          });

          return result;
        } catch (e) {
          console.error('[EditorMapContextRegistration] insertMap failed:', e);
          return false;
        }
      },
      focus: () => {
        editorInstanceRef.current?.commands.focus();
      },
      isAvailable: () => {
        return editorInstanceRef.current !== null;
      },
    };

    setEditorMapContext(mapContext);
    isRegisteredRef.current = true;

    // Cleanup: Clear context on unmount
    return () => {
      if (isRegisteredRef.current) {
        console.log('[EditorMapContextRegistration] Unmounting, clearing map context');
        setEditorMapContext(null);
        isRegisteredRef.current = false;
      }
    };
  }, [editorInstance, editorInstanceRef]);

  return null;
}

export interface AutonomousEditorPanelProps {
  /** Unique panel ID — CRITICAL for state isolation */
  panelId: string;
  /** User info for this editor instance */
  user: CollaborationUser;
  /** Display label (e.g., "Editor A") */
  label: string;
  /** Initial document ID to connect to (optional) */
  initialDocId?: string;
  /** Initial local file path to open (optional) */
  initialFilePath?: FilePath;
  /** Callback when panel requests close */
  onClose?: () => void;
  /** Use NATS-backed document persistence (vs localStorage) */
  useNatsPersistence?: boolean;
  /** Enable local file support (via FileAccessService) */
  enableLocalFiles?: boolean;
  /** Default source mode */
  defaultSourceMode?: SourceMode;
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
  initialFilePath,
  onClose,
  useNatsPersistence = true,
  enableLocalFiles = true, // Default to true to show local files
  defaultSourceMode = 'local', // Default to local mode
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

  // ---------------------------------------------------------------------------
  // Local File State (via Atom-as-State pattern)
  // ---------------------------------------------------------------------------

  // Create FileDocumentLayer with FileAccessService provided
  const fileDocumentLayer = useMemo(
    () =>
      FileDocumentService.Default.pipe(Layer.provide(FileAccessServiceLive)),
    []
  );

  // Create registry-bound file operations
  const fileOps = useMemo(
    () => makeFileDocumentOps(panelRegistry, fileDocumentLayer),
    [fileDocumentLayer]
  );

  // Read file-related atoms (from panelRegistry context)
  const currentFilePath = useAtomValue(currentFilePathAtom);
  const isFileDirty = useAtomValue(isCurrentFileDirtyAtom);
  const fileList = useAtomValue(fileListAtom) as readonly FileMapping[];
  const isFileLoading = useAtomValue(fileDocumentsLoadingAtom);
  const fileError = useAtomValue(fileDocumentsErrorAtom);

  // UI-only state (not shared, ok for useState)
  const [sourceMode, setSourceMode] = useState<SourceMode>(defaultSourceMode);
  const [isAIDrawerOpen, setIsAIDrawerOpen] = useState(false);
  const [isReconcilerPanelOpen, setIsReconcilerPanelOpen] = useState(false);

  // EditorAI integration: generate stable editorId from panelId
  const editorId = useMemo(() => `editor-${panelId}` as EditorId, [panelId]);

  // Focus tracking: call setFocusedEditor when editor gains focus
  const setFocusedEditor = useAtomSet(setFocusedEditorOp);
  const handleEditorFocus = useCallback(() => {
    console.log('[AutonomousEditorPanel] Editor focused, setting:', editorId);
    setFocusedEditor({ id: editorId });
  }, [editorId, setFocusedEditor]);

  // Track editor instance for TOC binding
  // STALE CLOSURE FIX: We use BOTH state (for re-renders) and ref (for fresh access)
  // - editorInstance (state): triggers re-render when editor is ready
  // - editorInstanceRef (ref): provides fresh reference for TOC click handlers
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const editorInstanceRef = useRef<Editor | null>(null);
  const [showToc, setShowToc] = useState(true);

  // Viewport refs for zoom/scroll management
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Viewport hook for scroll/focus AND transform-based zoom
  // Uses CSS transform: scale() which works universally on all content
  // NOTE: Motion blur removed for performance (caused stutter when zoomed)
  const viewport = useEditorViewport({
    editor: editorInstance,
    scrollContainerRef,
    config: {
      zoom: {
        min: 0.5,
        max: 2.0,
        step: 0.1,
        animationMs: 150,
        easing: 'ease-out',
      },
    },
  });

  // ---------------------------------------------------------------------------
  // File Discovery (scans filesystem for .md/.mdx files)
  // ---------------------------------------------------------------------------
  // Scan root from Variables v2 (user-configurable, defaults to $HOME)
  const scanRoot = useVariableValue<string>('fileIndex.scanRoot');

  const fileIndex = useFileIndex({
    registry: panelRegistry,
    fileAccessLayer: FileAccessServiceLive,
    initialRootPath: enableLocalFiles && scanRoot ? scanRoot : undefined,
    autoScan: enableLocalFiles && !!scanRoot,
  });

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
  // Editor Ref (for content access)
  // ---------------------------------------------------------------------------
  const editorRef = useRef<CollaborativeTiptapEditorHandle>(null);

  // ---------------------------------------------------------------------------
  // Markdown Serialization (JSON → Markdown for saving)
  // ---------------------------------------------------------------------------

  // Operation atom dispatcher for markdown serialization
  const doSerializeMarkdown = useAtomSet(markdownOps.serialize);

  /**
   * Get current editor content as markdown.
   * Uses markdownOps.serialize to convert Tiptap JSON to markdown.
   */
  const getMarkdownContent = useCallback(async (): Promise<string> => {
    const editor = editorRef.current;
    if (!editor) {
      console.warn('[AutonomousEditorPanel] No editor ref for getContent');
      return '';
    }

    const json = editor.getJSON();
    try {
      const markdown = await doSerializeMarkdown({ json });
      return markdown ?? '';
    } catch (err) {
      console.error(
        '[AutonomousEditorPanel] Failed to serialize markdown:',
        err
      );
      // Fallback to plain text if serialization fails
      return editor.getText();
    }
  }, [doSerializeMarkdown]);

  // Sync wrapper for useSaveFile (it expects () => string, not async)
  // We cache the last serialized content for Ctrl+S
  const lastSerializedRef = useRef<string>('');

  const getContentSync = useCallback((): string => {
    // Return cached content — async serialization happens on explicit save
    return lastSerializedRef.current;
  }, []);

  // ---------------------------------------------------------------------------
  // Save File Hook (Ctrl+S support)
  // ---------------------------------------------------------------------------

  const saveFile = useSaveFile({
    registry: panelRegistry,
    fileDocumentLayer,
    savedDisplayDuration: 2000,
    enableKeyboardShortcut: enableLocalFiles && !!currentFilePath,
    getContent: getContentSync,
    onSaveStart: (path) => {
      console.log(`[AutonomousEditorPanel] Saving ${path}...`);
    },
    onSaveSuccess: (result) => {
      console.log(
        `[AutonomousEditorPanel] Saved ${result.mapping.path} (${result.bytesWritten} bytes)`
      );
    },
    onSaveError: (error) => {
      console.error(`[AutonomousEditorPanel] Save failed: ${error.message}`);
    },
  });

  /**
   * Handle save button click — async serialize then save.
   */
  const handleSave = useCallback(async () => {
    if (!currentFilePath) {
      console.warn('[AutonomousEditorPanel] No current file to save');
      return;
    }

    // Serialize content first
    const markdown = await getMarkdownContent();
    lastSerializedRef.current = markdown;

    // Trigger save
    await saveFile.save(markdown);
  }, [currentFilePath, getMarkdownContent, saveFile]);

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

  // ---------------------------------------------------------------------------
  // Local File Handlers (when enableLocalFiles is true)
  // ---------------------------------------------------------------------------

  /**
   * Pending JSON content to seed into Y.Doc after connection.
   * Set when loading a local file, cleared after seeding.
   *
   * CRITICAL: We store JSON (not markdown) because `prosemirrorJSONToYXmlFragment`
   * requires a ProseMirror-compatible JSON structure.
   */
  const pendingJsonRef = useRef<JSONContent | null>(null);

  const handleSelectLocalFile = useCallback(
    async (path: FilePath) => {
      if (!enableLocalFiles) return;

      // CRITICAL: Normalize path ONCE at entry point (backslash → forward slash)
      // This ensures consistent Map key lookups throughout the system
      const normalizedPath = path.replace(/\\/g, '/') as FilePath;

      try {
        // 1. Load file via FileDocumentService
        //    This creates/retrieves the mapping (path → documentId)
        //    and caches BOTH markdown + parsed JSON
        const result = await fileOps.loadFile(
          normalizedPath,
          user.name as IdentityId
        );

        // 2. Use JSON content directly from the result (don't rely on cache)
        //    BUG FIX: registry.set() inside Effect doesn't flush to registry.get() outside Effect
        //    This is an effect-atom architecture issue - atoms updated inside runtime.runPromise()
        //    don't immediately reflect in synchronous registry.get() calls
        if (result.json) {
          pendingJsonRef.current = result.json;
        } else {
          console.warn(
            '[AutonomousEditorPanel] No JSON content in loadFile result for:',
            normalizedPath
          );
          pendingJsonRef.current = null;
        }

        // 4. Extract filename for pet name
        const filename =
          normalizedPath.split('/').pop()?.replace(/\.md$/, '') ?? 'Untitled';

        // 5. Close drawer and set pet name
        doCloseDrawer(args.closeDrawer());
        doSetPetName(args.setPetName(filename));

        // 6. Connect to y-sweet using the documentId from the mapping
        //    This triggers clientToken to be set, which renders the editor
        doConnect(args.connect(result.mapping.documentId));

        // 7. Add to recent docs for quick access
        doAddToRecent({
          docId: result.mapping.documentId,
          petName: filename,
        });

        console.log(
          `[AutonomousEditorPanel] Loaded local file: ${normalizedPath} → docId: ${result.mapping.documentId}`
        );
      } catch (err) {
        console.error(
          '[AutonomousEditorPanel] Failed to load local file:',
          err
        );
        // Error is already captured in fileDocumentsErrorAtom via fileOps
      }
    },
    [
      enableLocalFiles,
      fileOps,
      user.name,
      doCloseDrawer,
      doSetPetName,
      doConnect,
      doAddToRecent,
      args,
    ]
  );

  const handleSelectCloudDoc = useCallback(
    (docId: string) => {
      // Cloud doc selection — reuse existing connection logic
      handleSelectFromDrawer(docId);
    },
    [handleSelectFromDrawer]
  );

  const handleBrowseFiles = useCallback(() => {
    // TODO: Open native file picker via FileAccessService
    console.log('[AutonomousEditorPanel] Browse files not yet implemented');
  }, []);

  const handleRefreshFiles = useCallback(async () => {
    if (!enableLocalFiles) return;

    // Rescan the current root path for files
    await fileIndex.rescan();
  }, [enableLocalFiles, fileIndex]);

  // ---------------------------------------------------------------------------
  // Effects: Load data
  // ---------------------------------------------------------------------------

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

  // Convert discovered files + loaded files to LocalFileEntry[] for FileDrawer
  // Discovered files from file index, enriched with mapping info if available
  const localFilesForDrawer: LocalFileEntry[] = useMemo(() => {
    // Create a map of path -> mapping for quick lookup
    const mappingByPath = new Map<FilePath, FileMapping>();
    for (const mapping of fileList) {
      mappingByPath.set(mapping.path, mapping);
    }

    // If we have discovered files from file index, use those
    if (fileIndex.files.length > 0) {
      return fileIndex.files.map((indexed: IndexedFile) => ({
        path: indexed.path as FilePath,
        name: indexed.name.replace(/\.(md|mdx)$/, ''),
        modifiedAt: new Date(indexed.modifiedAt),
        size: indexed.size,
        mapping: mappingByPath.get(indexed.path as FilePath),
      }));
    }

    // Fallback: use loaded files if no discovered files yet
    return fileList.map((mapping: FileMapping) => ({
      path: mapping.path,
      name: mapping.path.split('/').pop()?.replace(/\.md$/, '') ?? 'Untitled',
      modifiedAt: mapping.updatedAt ?? new Date(),
      size: 0,
      mapping,
    }));
  }, [fileIndex.files, fileList]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <PanelRegistryProvider>
      <EditorAIProvider>
        {/* Register editor with EditorAI system for reconciler access */}
        <EditorAIRegistration
          editorId={editorId}
          editorInstanceRef={editorInstanceRef}
          editorInstance={editorInstance}
        />
        {/* Register editor with EditorMapContext for tool-to-editor map insertion */}
        <EditorMapContextRegistration
          editorInstanceRef={editorInstanceRef}
          editorInstance={editorInstance}
        />
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

        {/* Right: Save button + Close button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: VANTA_SPACING['2'],
          }}
        >
          {/* Save button — only shown when local files are enabled and a file is open */}
          {enableLocalFiles && currentFilePath && (
            <CompactSaveButton
              state={saveFile.state}
              isDirty={saveFile.isDirty}
              disabled={!saveFile.canSave}
              onClick={handleSave}
            />
          )}

          {/* AI Assistant toggle — shown when connected */}
          {status === 'connected' && (
            <button
              onClick={() => setIsAIDrawerOpen(!isAIDrawerOpen)}
              style={{
                background: isAIDrawerOpen
                  ? 'rgba(34, 211, 238, 0.15)'
                  : 'none',
                border: 'none',
                color: isAIDrawerOpen
                  ? VANTA_COLORS.accent.cyan
                  : VANTA_COLORS.text.muted,
                cursor: 'pointer',
                padding: VANTA_SPACING['1'],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: VANTA_BORDERS.radius.sm,
                transition: VANTA_ANIMATION.transition.colors,
              }}
              onMouseOver={(e) => {
                if (!isAIDrawerOpen) {
                  e.currentTarget.style.color = VANTA_COLORS.text.primary;
                }
              }}
              onMouseOut={(e) => {
                if (!isAIDrawerOpen) {
                  e.currentTarget.style.color = VANTA_COLORS.text.muted;
                }
              }}
              title={isAIDrawerOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
            >
              <AIAssistantIcon />
            </button>
          )}

          {/* Reconciler Test toggle — shown when connected */}
          {status === 'connected' && (
            <button
              onClick={() => setIsReconcilerPanelOpen(!isReconcilerPanelOpen)}
              style={{
                background: isReconcilerPanelOpen
                  ? 'rgba(167, 139, 250, 0.15)'
                  : 'none',
                border: 'none',
                color: isReconcilerPanelOpen
                  ? 'oklch(0.7 0.15 280)'
                  : VANTA_COLORS.text.muted,
                cursor: 'pointer',
                padding: VANTA_SPACING['1'],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: VANTA_BORDERS.radius.sm,
                transition: VANTA_ANIMATION.transition.colors,
              }}
              onMouseOver={(e) => {
                if (!isReconcilerPanelOpen) {
                  e.currentTarget.style.color = VANTA_COLORS.text.primary;
                }
              }}
              onMouseOut={(e) => {
                if (!isReconcilerPanelOpen) {
                  e.currentTarget.style.color = VANTA_COLORS.text.muted;
                }
              }}
              title={isReconcilerPanelOpen ? 'Close Reconciler Test' : 'Open Reconciler Test'}
            >
              <ReconcilerIcon />
            </button>
          )}

          {/* Close button */}
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
      </div>

      {/* Formatting Toolbar - shown when connected and editor exists */}
      {status === 'connected' && editorInstance && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: `${VANTA_SPACING['1.5']} ${VANTA_SPACING['3']}`,
            borderBottom: VANTA_BORDERS.style.hairline,
            backgroundColor: VANTA_COLORS.surface.base,
          }}
        >
          <DefaultFormattingToolbar editor={editorInstance} />
        </div>
      )}

      {/* Content Area + AI Drawer Wrapper (horizontal flex for split pane) */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        {/* Main Content Area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
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

              {/* Editor Layout: TOC Sidebar + Main Content */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  position: 'relative',
                }}
              >
                {/* TOC Sidebar (collapsible) */}
                <AnimatePresence>
                  {showToc && (
                    <motion.div
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 200, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{
                        height: '100%',
                        borderRight: VANTA_BORDERS.style.hairline,
                        backgroundColor: VANTA_COLORS.surface.void,
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          padding: VANTA_SPACING['3'],
                          height: '100%',
                          overflowY: 'auto',
                        }}
                      >
                        <div
                          style={{
                            ...VANTA_TYPOGRAPHY.preset.label,
                            color: VANTA_COLORS.text.muted,
                            marginBottom: VANTA_SPACING['2'],
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            fontSize: 10,
                          }}
                        >
                          Contents
                        </div>
                        <TableOfContents maxLevel={3} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* TOC Toggle Button */}
                <div
                  style={{
                    position: 'absolute',
                    left: showToc ? 192 : 8,
                    top: 8,
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'left 0.2s ease',
                  }}
                >
                  {/* TOC Toggle */}
                  <button
                    onClick={() => setShowToc(!showToc)}
                    style={{
                      background: VANTA_COLORS.surface.elevated,
                      border: VANTA_BORDERS.style.hairline,
                      borderRadius: VANTA_BORDERS.radius.sm,
                      padding: '4px 6px',
                      cursor: 'pointer',
                      color: VANTA_COLORS.text.muted,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                    }}
                    title={
                      showToc
                        ? 'Hide table of contents'
                        : 'Show table of contents'
                    }
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        transform: showToc ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }}
                    >
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                </div>

                {/* ZoomIndicator - shows briefly on zoom change (Ctrl+=/Ctrl+-/Ctrl+0) */}
                <ZoomIndicator
                  zoom={viewport.zoom.current}
                  isZooming={viewport.state.zoom.isAnimating}
                  hideDelay={2000}
                />

                {/* Main Editor Content - scroll container with transform zoom */}
                <div
                  ref={scrollContainerRef}
                  className="tmnl-editor-content"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: '100%',
                    overflow: 'auto',
                  }}
                  tabIndex={0}
                  onFocus={viewport.focus}
                  onBlur={viewport.blur}
                >
                  {/* Content Container with transform: scale zoom */}
                  <div ref={contentRef} style={viewport.zoomStyle}>
                    {effectiveToken && (
                      <CollaborativeTiptapEditor
                        ref={editorRef}
                        clientToken={effectiveToken}
                        user={user}
                        registry={panelRegistry}
                        placeholder={`${user.name} is typing...`}
                        style={{ height: '100%' }}
                        onFocus={handleEditorFocus}
                        onReady={(editor) => {
                          // Set both state (for re-renders) and ref (for fresh access in closures)
                          setEditorInstance(editor);
                          editorInstanceRef.current = editor;
                        }}
                        onYDocReady={(info) => {
                          // Seed Y.Doc with pending JSON content if:
                          // 1. We have pending content from a local file load
                          // 2. The Y.Doc fragment is empty (info.isEmpty === true)
                          const pendingJson = pendingJsonRef.current;

                          if (pendingJson && info.isEmpty) {
                            console.log(
                              '[AutonomousEditorPanel] Seeding Y.Doc with local file content',
                              {
                                fragmentLength: info.fragment.length,
                                isEmpty: info.isEmpty,
                              }
                            );

                            try {
                              // Get the editor to access its schema
                              const editor = editorRef.current?.getEditor();
                              if (!editor) {
                                console.error(
                                  '[AutonomousEditorPanel] Editor not available for seeding'
                                );
                                return;
                              }

                              // Seed the Y.XmlFragment directly using prosemirrorJSONToYXmlFragment
                              // This is the CORRECT way to populate a collaborative Y.Doc
                              prosemirrorJSONToYXmlFragment(
                                editor.schema,
                                pendingJson,
                                info.fragment
                              );

                              console.log(
                                '[AutonomousEditorPanel] Y.Doc seeded successfully'
                              );
                              pendingJsonRef.current = null;
                            } catch (err) {
                              console.error(
                                '[AutonomousEditorPanel] Failed to seed Y.Doc:',
                                err
                              );
                            }
                          } else if (!info.isEmpty) {
                            console.log(
                              '[AutonomousEditorPanel] Y.Doc already has content, skipping seed'
                            );
                          }
                        }}
                      />
                    )}
                  </div>
                  {/* End Zoom Container */}
                </div>

                {/* Inject IGGY-style prose styles */}
                <style>{allEditorStyles}</style>
                <style>{codeBlockHighlightStyles}</style>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>

        {/* EditorAI Drawer (split pane from right) */}
        <EditorAIDrawer
          editorId={editorId}
          isOpen={isAIDrawerOpen}
          onClose={() => setIsAIDrawerOpen(false)}
          width={360}
        />

        {/* Reconciler Test Panel (split pane from right) */}
        <ReconcilerTestPanel
          editorId={editorId}
          isOpen={isReconcilerPanelOpen}
          onToggle={() => setIsReconcilerPanelOpen(!isReconcilerPanelOpen)}
          width={400}
        />
      </div>

        {/* Drawer: FileDrawer (unified) when enableLocalFiles, else DocumentDrawer */}
        {enableLocalFiles ? (
          <FileDrawer
            isOpen={isDrawerOpen}
            onClose={handleCloseDrawer}
            onSelectLocalFile={handleSelectLocalFile}
            onSelectCloudDoc={handleSelectCloudDoc}
            onCreateNew={handleNewDocument}
            onBrowseFiles={handleBrowseFiles}
            onRefresh={handleRefreshFiles}
            localFiles={localFilesForDrawer}
            cloudDocs={useNatsPersistence ? documentList : undefined}
            currentPath={currentFilePath}
            currentDocId={undefined} // TODO: track current cloud doc ID if needed
            isLoading={
              isFileLoading || isDocumentsLoading || fileIndex.isScanning
            }
          />
        ) : (
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
        )}
      </motion.div>
      </EditorAIProvider>
    </PanelRegistryProvider>
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

function AIAssistantIcon() {
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
      <path d="M12 3v2" />
      <path d="M12 19v2" />
      <path d="M5.6 5.6l1.4 1.4" />
      <path d="M17 17l1.4 1.4" />
      <path d="M3 12h2" />
      <path d="M19 12h2" />
      <path d="M5.6 18.4l1.4-1.4" />
      <path d="M17 7l1.4-1.4" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function ReconcilerIcon() {
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
      {/* JSON/Code brackets */}
      <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
      {/* Sync arrows */}
      <path d="M8 12h8" />
      <path d="M12 8l4 4-4 4" />
    </svg>
  );
}

export default AutonomousEditorPanel;
