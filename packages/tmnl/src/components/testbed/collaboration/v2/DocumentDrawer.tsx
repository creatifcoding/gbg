/**
 * Panel-native document drawer
 * Slides from the panel edge, not a modal overlay
 *
 * Enhanced to work with DocumentListItem from NATS-backed persistence.
 * Displays status badges, visibility indicators, and richer metadata.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo } from 'react';
import type {
  DocumentListItem,
  DocumentStatus,
  DocumentVisibility,
} from '@/lib/editor/v3/schemas/document';

// =============================================================================
// Design Tokens
// =============================================================================

const COLORS = {
  bg: {
    primary: 'rgba(23, 23, 23, 0.98)',
    secondary: 'rgba(38, 38, 38, 0.95)',
    hover: 'rgba(50, 50, 50, 0.95)',
    input: 'rgba(30, 30, 30, 0.95)',
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
  status: {
    draft: { bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24' }, // amber
    published: { bg: 'rgba(74, 222, 128, 0.15)', text: '#4ade80' }, // green
    archived: { bg: 'rgba(163, 163, 163, 0.15)', text: '#a3a3a3' }, // gray
    deleted: { bg: 'rgba(251, 113, 133, 0.15)', text: '#fb7185' }, // rose
  },
  visibility: {
    private: '#a78bfa', // violet
    team: '#22d3ee', // cyan
    organization: '#4ade80', // green
    public: '#fbbf24', // amber
  },
} as const;

// =============================================================================
// Types
// =============================================================================

/**
 * Legacy RecentDoc format for backwards compatibility.
 * @deprecated Use DocumentListItem instead
 */
export interface RecentDoc {
  docId: string;
  petName: string;
  lastAccessed: number;
}

interface DocumentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDoc: (docId: string) => void;
  onCreateNew: () => void;
  onConnectById: (docId: string) => void;
  onDeleteDoc?: (docId: string) => void;
  /** NATS-backed document list (preferred) */
  documents?: readonly DocumentListItem[];
  /** Legacy localStorage-based recent docs (deprecated) */
  recentDocs?: readonly RecentDoc[];
  /** @deprecated Use onDeleteDoc instead */
  onRemoveDoc?: (docId: string) => void;
  /** Loading state for document list */
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

function getStatusStyle(status: DocumentStatus) {
  return COLORS.status[status];
}

function getVisibilityColor(visibility: DocumentVisibility) {
  return COLORS.visibility[visibility];
}

function getVisibilityLabel(visibility: DocumentVisibility): string {
  switch (visibility) {
    case 'private':
      return 'Private';
    case 'team':
      return 'Team';
    case 'organization':
      return 'Org';
    case 'public':
      return 'Public';
  }
}

// =============================================================================
// Sub-components
// =============================================================================

function StatusBadge({ status }: { status: DocumentStatus }) {
  const style = getStatusStyle(status);
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        padding: '2px 5px',
        borderRadius: 3,
        backgroundColor: style.bg,
        color: style.text,
      }}
    >
      {status}
    </span>
  );
}

function VisibilityIndicator({
  visibility,
}: {
  visibility: DocumentVisibility;
}) {
  const color = getVisibilityColor(visibility);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
      title={getVisibilityLabel(visibility)}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: color,
          opacity: 0.8,
        }}
      />
      <span
        style={{
          fontSize: 9,
          color: COLORS.text.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {getVisibilityLabel(visibility)}
      </span>
    </div>
  );
}

function DocumentCard({
  doc,
  onSelect,
  onDelete,
}: {
  doc: DocumentListItem;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      whileHover={{ scale: 1.01 }}
      style={{
        padding: '10px 12px',
        backgroundColor: COLORS.bg.secondary,
        borderRadius: 6,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
      onClick={onSelect}
    >
      {/* Header: Title + Delete */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
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
            {doc.title}
          </div>
        </div>
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              background: 'none',
              border: 'none',
              color: COLORS.text.muted,
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              opacity: 0.4,
              transition: 'opacity 0.15s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.color = COLORS.accent.rose;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.opacity = '0.4';
              e.currentTarget.style.color = COLORS.text.muted;
            }}
          >
            <TrashIcon />
          </button>
        )}
      </div>

      {/* Meta row: Status + Visibility + Time */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <StatusBadge status={doc.status} />
          <VisibilityIndicator visibility={doc.visibility} />
        </div>
        <span
          style={{
            fontSize: 10,
            color: COLORS.text.muted,
          }}
        >
          {formatTimeAgo(doc.updatedAt)}
        </span>
      </div>

      {/* Tags (if any) */}
      {doc.tags && doc.tags.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            marginTop: 2,
          }}
        >
          {doc.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 9,
                padding: '1px 5px',
                borderRadius: 3,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: COLORS.text.muted,
              }}
            >
              {tag}
            </span>
          ))}
          {doc.tags.length > 3 && (
            <span
              style={{
                fontSize: 9,
                color: COLORS.text.muted,
              }}
            >
              +{doc.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* ID (truncated) */}
      <div
        style={{
          fontSize: 9,
          color: COLORS.text.muted,
          fontFamily: 'ui-monospace, monospace',
          opacity: 0.6,
        }}
      >
        {(doc.id as string).slice(0, 16)}...
      </div>
    </motion.div>
  );
}

/**
 * Legacy card for RecentDoc format (backwards compatibility)
 */
function LegacyDocCard({
  doc,
  onSelect,
  onRemove,
}: {
  doc: RecentDoc;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      whileHover={{ scale: 1.01 }}
      style={{
        padding: '10px 12px',
        backgroundColor: COLORS.bg.secondary,
        borderRadius: 6,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}
      onClick={onSelect}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: COLORS.text.primary,
            marginBottom: 2,
          }}
        >
          {doc.petName}
        </div>
        <div
          style={{
            fontSize: 10,
            color: COLORS.text.muted,
            fontFamily: 'ui-monospace, monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {doc.docId.slice(0, 12)}...
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: COLORS.text.muted,
          }}
        >
          {formatTimeAgo(doc.lastAccessed)}
        </span>
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            style={{
              background: 'none',
              border: 'none',
              color: COLORS.text.muted,
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              opacity: 0.5,
              transition: 'opacity 0.15s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.opacity = '0.5';
            }}
          >
            <TrashIcon />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function DocumentDrawer({
  isOpen,
  onClose,
  onSelectDoc,
  onCreateNew,
  onConnectById,
  onDeleteDoc,
  documents,
  recentDocs,
  onRemoveDoc,
  isLoading = false,
}: DocumentDrawerProps) {
  const [search, setSearch] = useState('');
  const [manualId, setManualId] = useState('');
  const [mode, setMode] = useState<'browse' | 'manual'>('browse');

  // Determine which data source to use
  const useNativeDocuments = documents !== undefined && documents.length > 0;

  // Filter documents based on search
  const filteredDocuments = useMemo(() => {
    if (!documents) return [];
    if (!search) return documents;
    const lower = search.toLowerCase();
    return documents.filter(
      (d) =>
        d.title.toLowerCase().includes(lower) ||
        (d.id as string).toLowerCase().includes(lower) ||
        d.tags?.some((t) => t.toLowerCase().includes(lower))
    );
  }, [documents, search]);

  // Filter legacy docs based on search
  const filteredLegacyDocs = useMemo(() => {
    if (!recentDocs) return [];
    if (!search) return recentDocs;
    const lower = search.toLowerCase();
    return recentDocs.filter(
      (d) =>
        d.petName.toLowerCase().includes(lower) ||
        d.docId.toLowerCase().includes(lower)
    );
  }, [recentDocs, search]);

  const handleConnect = () => {
    if (manualId.trim()) {
      onConnectById(manualId.trim());
      setManualId('');
      setMode('browse');
    }
  };

  const isEmpty = useNativeDocuments
    ? filteredDocuments.length === 0
    : filteredLegacyDocs.length === 0;

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
              width: 300,
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
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: COLORS.text.primary,
                }}
              >
                Documents
              </span>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: COLORS.text.muted,
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CloseIcon />
              </button>
            </div>

            {/* Mode tabs */}
            <div
              style={{
                display: 'flex',
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              <button
                onClick={() => setMode('browse')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: mode === 'browse' ? 600 : 400,
                  color:
                    mode === 'browse'
                      ? COLORS.accent.cyan
                      : COLORS.text.secondary,
                  backgroundColor:
                    mode === 'browse' ? COLORS.bg.secondary : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderBottom:
                    mode === 'browse'
                      ? `2px solid ${COLORS.accent.cyan}`
                      : '2px solid transparent',
                }}
              >
                {useNativeDocuments ? 'All Documents' : 'Recent'}
              </button>
              <button
                onClick={() => setMode('manual')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: mode === 'manual' ? 600 : 400,
                  color:
                    mode === 'manual'
                      ? COLORS.accent.cyan
                      : COLORS.text.secondary,
                  backgroundColor:
                    mode === 'manual' ? COLORS.bg.secondary : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderBottom:
                    mode === 'manual'
                      ? `2px solid ${COLORS.accent.cyan}`
                      : '2px solid transparent',
                }}
              >
                Connect by ID
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              <AnimatePresence mode="wait">
                {mode === 'browse' ? (
                  <motion.div
                    key="browse"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.15 }}
                  >
                    {/* Search */}
                    <div style={{ marginBottom: 12 }}>
                      <input
                        type="text"
                        placeholder="Search documents..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: 12,
                          backgroundColor: COLORS.bg.input,
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: 6,
                          color: COLORS.text.primary,
                          outline: 'none',
                        }}
                      />
                    </div>

                    {/* New document button */}
                    <button
                      onClick={onCreateNew}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        marginBottom: 12,
                        fontSize: 12,
                        fontWeight: 500,
                        color: COLORS.text.primary,
                        backgroundColor: COLORS.bg.secondary,
                        border: `1px dashed ${COLORS.border}`,
                        borderRadius: 6,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = COLORS.accent.cyan;
                        e.currentTarget.style.color = COLORS.accent.cyan;
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = COLORS.border;
                        e.currentTarget.style.color = COLORS.text.primary;
                      }}
                    >
                      <PlusIcon />
                      New Document
                    </button>

                    {/* Loading state */}
                    {isLoading && (
                      <div
                        style={{
                          textAlign: 'center',
                          padding: 20,
                          color: COLORS.text.muted,
                          fontSize: 12,
                        }}
                      >
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            ease: 'linear',
                          }}
                          style={{
                            width: 16,
                            height: 16,
                            border: `2px solid ${COLORS.border}`,
                            borderTopColor: COLORS.accent.cyan,
                            borderRadius: '50%',
                            margin: '0 auto 8px',
                          }}
                        />
                        Loading documents...
                      </div>
                    )}

                    {/* Empty state */}
                    {!isLoading && isEmpty && (
                      <div
                        style={{
                          textAlign: 'center',
                          padding: 20,
                          color: COLORS.text.muted,
                          fontSize: 12,
                        }}
                      >
                        {search ? 'No matching documents' : 'No documents yet'}
                      </div>
                    )}

                    {/* Document list */}
                    {!isLoading && !isEmpty && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        {useNativeDocuments
                          ? filteredDocuments.map((doc) => (
                              <DocumentCard
                                key={doc.id}
                                doc={doc}
                                onSelect={() => onSelectDoc(doc.id as string)}
                                onDelete={
                                  onDeleteDoc
                                    ? () => onDeleteDoc(doc.id as string)
                                    : undefined
                                }
                              />
                            ))
                          : filteredLegacyDocs.map((doc) => (
                              <LegacyDocCard
                                key={doc.docId}
                                doc={doc}
                                onSelect={() => onSelectDoc(doc.docId)}
                                onRemove={
                                  onRemoveDoc
                                    ? () => onRemoveDoc(doc.docId)
                                    : undefined
                                }
                              />
                            ))}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="manual"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.15 }}
                  >
                    <p
                      style={{
                        fontSize: 12,
                        color: COLORS.text.secondary,
                        marginBottom: 12,
                        lineHeight: 1.5,
                      }}
                    >
                      Enter a document ID to connect directly.
                    </p>
                    <input
                      type="text"
                      placeholder="Document ID..."
                      value={manualId}
                      onChange={(e) => setManualId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleConnect();
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: 12,
                        backgroundColor: COLORS.bg.input,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 6,
                        color: COLORS.text.primary,
                        outline: 'none',
                        fontFamily: 'ui-monospace, monospace',
                        marginBottom: 12,
                      }}
                    />
                    <button
                      onClick={handleConnect}
                      disabled={!manualId.trim()}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: 12,
                        fontWeight: 500,
                        color: manualId.trim()
                          ? COLORS.bg.primary
                          : COLORS.text.muted,
                        backgroundColor: manualId.trim()
                          ? COLORS.accent.cyan
                          : COLORS.bg.secondary,
                        border: 'none',
                        borderRadius: 6,
                        cursor: manualId.trim() ? 'pointer' : 'not-allowed',
                        opacity: manualId.trim() ? 1 : 0.5,
                      }}
                    >
                      Connect
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
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

function PlusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
