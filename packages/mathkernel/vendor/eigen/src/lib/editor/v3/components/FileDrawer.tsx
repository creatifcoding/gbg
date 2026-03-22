/**
 * FileDrawer
 *
 * Unified drawer for selecting markdown content from any source:
 * - Local .md files (via FileAccessService)
 * - Collaborative documents (via NATS-backed persistence)
 * - Files with active collaborative mappings
 *
 * Slides from panel edge, follows DocumentDrawer pattern.
 *
 * Uses TanStack Virtual for efficient rendering of 10k+ files at 60fps.
 * Local files are virtualized; cloud docs (typically < 100) are not.
 *
 * @module editor/v3/components/FileDrawer
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  FileText,
  Cloud,
  HardDrive,
  Search,
  Plus,
  FolderOpen,
  RefreshCw,
  X,
  Circle,
  CloudOff,
  Link2,
} from 'lucide-react';
import type { DocumentListItem } from '../schemas/document';
import type {
  FilePath,
  FileMapping,
  FileSyncStatus,
} from '../services/FileDocumentMappingService';

// =============================================================================
// Design Tokens
// =============================================================================

const COLORS = {
  bg: {
    primary: 'rgba(23, 23, 23, 0.98)',
    secondary: 'rgba(38, 38, 38, 0.95)',
    hover: 'rgba(50, 50, 50, 0.95)',
    input: 'rgba(30, 30, 30, 0.95)',
    active: 'rgba(34, 211, 238, 0.1)',
  },
  border: 'rgba(63, 63, 63, 0.6)',
  text: {
    primary: 'rgba(250, 250, 250, 0.95)',
    secondary: 'rgba(163, 163, 163, 0.9)',
    muted: 'rgba(115, 115, 115, 0.8)',
  },
  accent: {
    cyan: '#22d3ee',
    green: '#4ade80',
    amber: '#fbbf24',
    violet: '#a78bfa',
    rose: '#fb7185',
  },
  sync: {
    synced: '#4ade80',
    dirty: '#fbbf24',
    conflict: '#fb7185',
    untracked: '#a3a3a3',
  },
} as const;

// =============================================================================
// Virtualization Constants
// =============================================================================

/** Row height for virtualized file list - fixed for performance */
const VIRTUAL_ROW_HEIGHT = 56;

/** Overscan count - extra rows rendered outside viewport for smooth scrolling */
const VIRTUAL_OVERSCAN = 10;

// =============================================================================
// Types
// =============================================================================

type SourceTab = 'all' | 'local' | 'cloud';

/**
 * Local file entry from file system scan.
 */
export interface LocalFileEntry {
  readonly path: FilePath;
  readonly name: string;
  readonly modifiedAt: Date;
  readonly size: number;
  /** If mapped to a collaborative document */
  readonly mapping?: FileMapping;
}

/**
 * Unified entry that could be local, cloud, or both.
 */
export interface UnifiedFileEntry {
  readonly id: string;
  readonly type: 'local' | 'cloud' | 'mapped';
  readonly title: string;
  readonly subtitle: string;
  readonly modifiedAt: Date;
  /** Creation time (only available for cloud docs) */
  readonly createdAt?: Date;
  readonly syncStatus?: FileSyncStatus;
  /** Original local file if applicable */
  readonly localFile?: LocalFileEntry;
  /** Original cloud document if applicable */
  readonly cloudDoc?: DocumentListItem;
}

export interface FileDrawerProps {
  isOpen: boolean;
  onClose: () => void;

  /** Select a local file by path */
  onSelectLocalFile: (path: FilePath) => void;

  /** Select a cloud document by ID */
  onSelectCloudDoc: (docId: string) => void;

  /** Create a new document */
  onCreateNew: () => void;

  /** Open file browser to select a file */
  onBrowseFiles?: () => void;

  /** Refresh file lists */
  onRefresh?: () => void;

  /** Local files from file system */
  localFiles?: readonly LocalFileEntry[];

  /** Cloud documents from persistence */
  cloudDocs?: readonly DocumentListItem[];

  /** Currently open file path (for highlighting) */
  currentPath?: FilePath | null;

  /** Currently open document ID (for highlighting) */
  currentDocId?: string | null;

  /** Loading state */
  isLoading?: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

function formatTimeAgo(date: Date | number): string {
  const timestamp = typeof date === 'number' ? date : date.getTime();
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Format full date for tooltips.
 * e.g., "Dec 29, 2025 at 3:45 PM"
 */
function formatFullDate(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Check if two dates are more than 1 minute apart.
 * Used to determine if updatedAt should be shown separately from createdAt.
 */
function wasModified(createdAt: Date, updatedAt: Date): boolean {
  const diff = Math.abs(updatedAt.getTime() - createdAt.getTime());
  return diff > 60000; // More than 1 minute apart
}

function getSyncStatusColor(status?: FileSyncStatus): string {
  if (!status) return COLORS.sync.untracked;
  switch (status) {
    case 'synced':
      return COLORS.sync.synced;
    case 'dirty':
      return COLORS.sync.dirty;
    case 'conflict':
      return COLORS.sync.conflict;
    default:
      return COLORS.sync.untracked;
  }
}

function getSyncStatusLabel(status?: FileSyncStatus): string {
  if (!status) return 'Not synced';
  switch (status) {
    case 'synced':
      return 'Synced';
    case 'dirty':
      return 'Unsaved changes';
    case 'conflict':
      return 'Conflict';
    default:
      return 'Unknown';
  }
}

function truncatePath(path: string, maxLen = 30): string {
  if (path.length <= maxLen) return path;
  const parts = path.split('/');
  if (parts.length <= 2) return '...' + path.slice(-maxLen);
  return '.../' + parts.slice(-2).join('/');
}

// =============================================================================
// Sub-components
// =============================================================================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}

function TabButton({ active, onClick, icon, label, count }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '8px 12px',
        background: active ? COLORS.bg.active : 'transparent',
        border: 'none',
        borderBottom: active
          ? `2px solid ${COLORS.accent.cyan}`
          : '2px solid transparent',
        color: active ? COLORS.accent.cyan : COLORS.text.secondary,
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: 500,
        transition: 'all 0.15s',
      }}
    >
      {icon}
      {label}
      {count !== undefined && (
        <span
          style={{
            fontSize: 9,
            padding: '1px 5px',
            borderRadius: 8,
            backgroundColor: active
              ? 'rgba(34, 211, 238, 0.2)'
              : 'rgba(255, 255, 255, 0.1)',
            color: active ? COLORS.accent.cyan : COLORS.text.muted,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

interface SyncIndicatorProps {
  status?: FileSyncStatus;
}

function SyncIndicator({ status }: SyncIndicatorProps) {
  const color = getSyncStatusColor(status);
  const label = getSyncStatusLabel(status);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
      title={label}
    >
      <Circle size={6} fill={color} color={color} style={{ opacity: 0.9 }} />
    </div>
  );
}

/**
 * Displays timestamps with context for file entries.
 * For cloud docs: Shows "Modified: Xh ago" vs "Created: Xh ago" with indicator dot.
 * For local files: Shows just the modified time (no created time available).
 * Includes tooltip with full date on hover.
 */
interface TimestampDisplayProps {
  modifiedAt: Date;
  createdAt?: Date;
  isCloud: boolean;
}

function TimestampDisplay({
  modifiedAt,
  createdAt,
  isCloud,
}: TimestampDisplayProps) {
  // For cloud docs with both timestamps, show Modified vs Created
  if (isCloud && createdAt) {
    const modified = wasModified(createdAt, modifiedAt);
    const displayDate = modified ? modifiedAt : createdAt;
    const label = modified ? 'Modified' : 'Created';
    const tooltipText = modified
      ? `Modified: ${formatFullDate(modifiedAt)}\nCreated: ${formatFullDate(createdAt)}`
      : `Created: ${formatFullDate(createdAt)}`;

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
        title={tooltipText}
      >
        {/* Modified indicator dot */}
        {modified && (
          <div
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              backgroundColor: COLORS.accent.cyan,
              opacity: 0.7,
            }}
          />
        )}
        <span
          style={{
            fontSize: 10,
            color: modified ? COLORS.text.secondary : COLORS.text.muted,
          }}
        >
          {label}: {formatTimeAgo(displayDate)}
        </span>
      </div>
    );
  }

  // For local files, just show modification time
  return (
    <span
      style={{
        fontSize: 10,
        color: COLORS.text.muted,
        flexShrink: 0,
      }}
      title={formatFullDate(modifiedAt)}
    >
      {formatTimeAgo(modifiedAt)}
    </span>
  );
}

interface FileCardProps {
  entry: UnifiedFileEntry;
  isActive: boolean;
  onSelect: () => void;
}

function FileCard({ entry, isActive, onSelect }: FileCardProps) {
  const TypeIcon =
    entry.type === 'cloud'
      ? Cloud
      : entry.type === 'mapped'
      ? Link2
      : HardDrive;
  const typeColor =
    entry.type === 'cloud'
      ? COLORS.accent.cyan
      : entry.type === 'mapped'
      ? COLORS.accent.violet
      : COLORS.text.muted;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      onClick={onSelect}
      style={{
        padding: '10px 12px',
        backgroundColor: isActive ? COLORS.bg.active : COLORS.bg.secondary,
        borderRadius: 6,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        border: isActive
          ? `1px solid ${COLORS.accent.cyan}40`
          : '1px solid transparent',
        transition: 'background-color 0.15s, border-color 0.15s',
      }}
    >
      {/* Header: Icon + Title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <TypeIcon size={14} color={typeColor} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: COLORS.text.primary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.title}
          </div>
        </div>
        {entry.syncStatus && <SyncIndicator status={entry.syncStatus} />}
      </div>

      {/* Subtitle + Time */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: COLORS.text.muted,
            fontFamily: 'ui-monospace, monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {entry.subtitle}
        </span>
        <TimestampDisplay
          modifiedAt={entry.modifiedAt}
          createdAt={entry.createdAt}
          isCloud={entry.type === 'cloud'}
        />
      </div>
    </motion.div>
  );
}

// =============================================================================
// Virtualized File List (TanStack Virtual)
// =============================================================================

interface VirtualizedFileListProps {
  entries: UnifiedFileEntry[];
  isEntryActive: (entry: UnifiedFileEntry) => boolean;
  onSelect: (entry: UnifiedFileEntry) => void;
  /** Container height for virtualization. If not provided, uses flex: 1 */
  height?: number;
}

/**
 * Virtualized file list for rendering 10k+ files efficiently.
 * Uses TanStack Virtual with fixed row heights for optimal performance.
 *
 * Renders FileCard components positioned absolutely within a scrollable container.
 *
 * When `height` is not provided, component uses flex: 1 and measures
 * its own height via ResizeObserver for responsive layouts.
 */
function VirtualizedFileList({
  entries,
  isEntryActive,
  onSelect,
  height,
}: VirtualizedFileListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => VIRTUAL_ROW_HEIGHT,
    overscan: VIRTUAL_OVERSCAN,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (entries.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next =
              prev === null ? 0 : Math.min(prev + 1, entries.length - 1);
            virtualizer.scrollToIndex(next, { align: 'auto' });
            return next;
          });
          break;

        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next =
              prev === null ? entries.length - 1 : Math.max(prev - 1, 0);
            virtualizer.scrollToIndex(next, { align: 'auto' });
            return next;
          });
          break;

        case 'Enter':
          if (focusedIndex !== null) {
            onSelect(entries[focusedIndex]);
          }
          break;

        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          virtualizer.scrollToIndex(0);
          break;

        case 'End':
          e.preventDefault();
          setFocusedIndex(entries.length - 1);
          virtualizer.scrollToIndex(entries.length - 1);
          break;
      }
    },
    [entries, focusedIndex, onSelect, virtualizer]
  );

  return (
    <div
      ref={parentRef}
      style={{
        height: height ?? '100%',
        flex: height === undefined ? 1 : undefined,
        minHeight: 0, // Required for flex child to shrink
        overflowY: 'auto',
        outline: 'none',
      }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="listbox"
      aria-label="File list"
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const entry = entries[virtualItem.index];
          const isActive = isEntryActive(entry);
          const isFocused = focusedIndex === virtualItem.index;

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              role="option"
              aria-selected={isActive}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: VIRTUAL_ROW_HEIGHT,
                transform: `translateY(${virtualItem.start}px)`,
                // Focus ring styling for keyboard nav
                outline: isFocused
                  ? `2px solid ${COLORS.accent.cyan}60`
                  : 'none',
                outlineOffset: -2,
                borderRadius: 6,
              }}
              onClick={() => {
                setFocusedIndex(virtualItem.index);
              }}
            >
              <FileCard
                entry={entry}
                isActive={isActive}
                onSelect={() => onSelect(entry)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function FileDrawer({
  isOpen,
  onClose,
  onSelectLocalFile,
  onSelectCloudDoc,
  onCreateNew,
  onBrowseFiles,
  onRefresh,
  localFiles = [],
  cloudDocs = [],
  currentPath,
  currentDocId,
  isLoading = false,
}: FileDrawerProps) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<SourceTab>('all');

  // Transform local files to unified entries
  const localEntries = useMemo<UnifiedFileEntry[]>(() => {
    return localFiles.map((file) => ({
      id: `local:${file.path}`,
      type: file.mapping ? 'mapped' : 'local',
      title: file.name,
      subtitle: truncatePath(file.path),
      modifiedAt: file.modifiedAt,
      syncStatus: file.mapping?.syncStatus,
      localFile: file,
    }));
  }, [localFiles]);

  // Transform cloud docs to unified entries
  const cloudEntries = useMemo<UnifiedFileEntry[]>(() => {
    return cloudDocs.map((doc) => ({
      id: `cloud:${doc.id}`,
      type: 'cloud',
      title: doc.title,
      subtitle: (doc.id as string).slice(0, 16) + '...',
      modifiedAt: doc.updatedAt,
      createdAt: doc.createdAt,
      cloudDoc: doc,
    }));
  }, [cloudDocs]);

  // Combined and filtered entries
  const allEntries = useMemo<UnifiedFileEntry[]>(() => {
    let entries: UnifiedFileEntry[] = [];

    if (activeTab === 'all' || activeTab === 'local') {
      entries = [...entries, ...localEntries];
    }
    if (activeTab === 'all' || activeTab === 'cloud') {
      entries = [...entries, ...cloudEntries];
    }

    // Filter by search
    if (search) {
      const lower = search.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.title.toLowerCase().includes(lower) ||
          e.subtitle.toLowerCase().includes(lower)
      );
    }

    // Sort by modified date (newest first)
    entries.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());

    return entries;
  }, [localEntries, cloudEntries, activeTab, search]);

  const handleSelect = useCallback(
    (entry: UnifiedFileEntry) => {
      if (entry.localFile) {
        onSelectLocalFile(entry.localFile.path);
      } else if (entry.cloudDoc) {
        onSelectCloudDoc(entry.cloudDoc.id as string);
      }
      onClose();
    },
    [onSelectLocalFile, onSelectCloudDoc, onClose]
  );

  const isEntryActive = useCallback(
    (entry: UnifiedFileEntry): boolean => {
      if (entry.localFile && currentPath) {
        return entry.localFile.path === currentPath;
      }
      if (entry.cloudDoc && currentDocId) {
        return entry.cloudDoc.id === currentDocId;
      }
      return false;
    },
    [currentPath, currentDocId]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(2px)',
              zIndex: 10,
            }}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: 320,
              backgroundColor: COLORS.bg.primary,
              borderRight: `1px solid ${COLORS.border}`,
              display: 'flex',
              flexDirection: 'column',
              zIndex: 20,
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${COLORS.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={14} color={COLORS.accent.cyan} />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: COLORS.text.primary,
                  }}
                >
                  Open File
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    disabled={isLoading}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: COLORS.text.muted,
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      opacity: isLoading ? 0.5 : 0.7,
                      transition: 'opacity 0.15s',
                    }}
                    title="Refresh"
                  >
                    <RefreshCw
                      size={14}
                      className={isLoading ? 'animate-spin' : ''}
                    />
                  </button>
                )}
                <button
                  onClick={onClose}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: COLORS.text.muted,
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    opacity: 0.7,
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div
              style={{
                display: 'flex',
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              <TabButton
                active={activeTab === 'all'}
                onClick={() => setActiveTab('all')}
                icon={<FileText size={12} />}
                label="All"
                count={localEntries.length + cloudEntries.length}
              />
              <TabButton
                active={activeTab === 'local'}
                onClick={() => setActiveTab('local')}
                icon={<HardDrive size={12} />}
                label="Local"
                count={localEntries.length}
              />
              <TabButton
                active={activeTab === 'cloud'}
                onClick={() => setActiveTab('cloud')}
                icon={<Cloud size={12} />}
                label="Cloud"
                count={cloudEntries.length}
              />
            </div>

            {/* Search */}
            <div style={{ padding: '12px 16px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  backgroundColor: COLORS.bg.input,
                  borderRadius: 6,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <Search size={14} color={COLORS.text.muted} />
                <input
                  type="text"
                  placeholder="Search files..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    color: COLORS.text.primary,
                    fontSize: 12,
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: COLORS.text.muted,
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Actions */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                padding: '0 16px 12px',
              }}
            >
              <button
                onClick={onCreateNew}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  backgroundColor: COLORS.bg.secondary,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 6,
                  color: COLORS.text.secondary,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 500,
                  transition: 'all 0.15s',
                }}
              >
                <Plus size={12} />
                New Document
              </button>
              {onBrowseFiles && (
                <button
                  onClick={onBrowseFiles}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '8px 12px',
                    backgroundColor: COLORS.bg.secondary,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 6,
                    color: COLORS.text.secondary,
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 500,
                    transition: 'all 0.15s',
                  }}
                >
                  <FolderOpen size={12} />
                  Browse...
                </button>
              )}
            </div>

            {/* File List */}
            <div
              style={{
                flex: 1,
                overflowY: 'hidden',
                padding: '0 16px 16px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {isLoading ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    padding: 32,
                    color: COLORS.text.muted,
                  }}
                >
                  <RefreshCw size={20} className="animate-spin" />
                  <span style={{ fontSize: 12 }}>Loading files...</span>
                </div>
              ) : allEntries.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    padding: 32,
                    color: COLORS.text.muted,
                  }}
                >
                  <CloudOff size={24} style={{ opacity: 0.5 }} />
                  <span style={{ fontSize: 12 }}>
                    {search ? 'No matching files' : 'No files yet'}
                  </span>
                </div>
              ) : (
                <VirtualizedFileList
                  entries={allEntries}
                  isEntryActive={isEntryActive}
                  onSelect={handleSelect}
                />
              )}
            </div>

            {/* Footer hint */}
            <div
              style={{
                padding: '8px 16px',
                borderTop: `1px solid ${COLORS.border}`,
                backgroundColor: COLORS.bg.secondary,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  fontSize: 10,
                  color: COLORS.text.muted,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <HardDrive size={10} /> Local
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Cloud size={10} /> Cloud
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Link2 size={10} /> Mapped
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default FileDrawer;
