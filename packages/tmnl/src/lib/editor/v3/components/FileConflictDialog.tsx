/**
 * FileConflictDialog
 *
 * Modal dialog for resolving file conflicts between local editor content
 * and external file changes.
 *
 * Features:
 * - Side-by-side content preview (local vs external)
 * - Resolution options: Keep Local, Keep External, Save As
 * - Visual diff highlighting (future enhancement)
 * - Keyboard navigation (Tab to switch, Enter to confirm)
 *
 * @module editor/v3/components/FileConflictDialog
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Download, Copy, AlertTriangle } from 'lucide-react';
import { Label } from '@/components/primitives';
import type { FilePath } from '../services/FileDocumentMappingService';
import type {
  FileConflict,
  ConflictResolution,
} from '../services/FileDocumentService';

// =============================================================================
// Types
// =============================================================================

export interface FileConflictDialogProps {
  /**
   * The conflict to resolve. When null, dialog is closed.
   */
  conflict: FileConflict | null;

  /**
   * Callback when user resolves the conflict.
   * For 'save_as', newPath will contain the chosen path.
   */
  onResolve: (
    resolution: ConflictResolution,
    newPath?: FilePath
  ) => void | Promise<void>;

  /**
   * Callback when user dismisses without resolving.
   * This keeps the conflict state, allowing retry later.
   */
  onDismiss?: () => void;

  /**
   * Whether resolution is in progress.
   */
  isLoading?: boolean;
}

type TabId = 'local' | 'external';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Format a date for display.
 */
const formatDate = (date: Date): string => {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Get line count of content.
 */
const getLineCount = (content: string): number => {
  return content.split('\n').length;
};

/**
 * Get word count of content.
 */
const getWordCount = (content: string): number => {
  return content.split(/\s+/).filter(Boolean).length;
};

/**
 * Truncate path for display.
 */
const truncatePath = (path: string, maxLen: number = 40): string => {
  if (path.length <= maxLen) return path;
  const parts = path.split('/');
  if (parts.length <= 2) return path.slice(-maxLen);
  return `.../${parts.slice(-2).join('/')}`;
};

// =============================================================================
// Sub-components
// =============================================================================

interface ContentPreviewProps {
  content: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  stats: { lines: number; words: number };
}

const ContentPreview = ({
  content,
  label,
  icon,
  isActive,
  stats,
}: ContentPreviewProps) => (
  <div
    className={`
      flex-1 flex flex-col overflow-hidden rounded border transition-colors
      ${
        isActive
          ? 'border-cyan-500/50 bg-neutral-900/50'
          : 'border-neutral-800 bg-neutral-900/30'
      }
    `}
  >
    {/* Header */}
    <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800 bg-neutral-900/50">
      <span className={isActive ? 'text-cyan-400' : 'text-neutral-500'}>
        {icon}
      </span>
      <span
        className={`text-xs font-medium ${
          isActive ? 'text-cyan-400' : 'text-neutral-400'
        }`}
      >
        {label}
      </span>
      <span className="ml-auto text-[10px] text-neutral-600">
        {stats.lines} lines • {stats.words} words
      </span>
    </div>

    {/* Content */}
    <pre
      className="
        flex-1 overflow-auto p-3 text-xs font-mono text-neutral-300
        whitespace-pre-wrap break-words leading-relaxed
      "
      style={{ maxHeight: '200px' }}
    >
      {content || '(empty)'}
    </pre>
  </div>
);

interface ResolutionButtonProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  variant: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

const ResolutionButton = ({
  icon,
  label,
  description,
  onClick,
  variant,
  disabled,
}: ResolutionButtonProps) => {
  const variantStyles = {
    primary:
      'bg-cyan-500/10 border-cyan-500/30 hover:border-cyan-500/50 hover:bg-cyan-500/20 text-cyan-400',
    secondary:
      'bg-neutral-800/50 border-neutral-700 hover:border-neutral-600 hover:bg-neutral-800 text-neutral-300',
    danger:
      'bg-red-500/10 border-red-500/30 hover:border-red-500/50 hover:bg-red-500/20 text-red-400',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-3 p-3 rounded border text-left transition-all
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
      `}
    >
      <span className="flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[10px] text-neutral-500 mt-0.5">{description}</div>
      </div>
    </button>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const FileConflictDialog = ({
  conflict,
  onResolve,
  onDismiss,
  isLoading = false,
}: FileConflictDialogProps) => {
  const [activeTab, setActiveTab] = useState<TabId>('local');
  const [showSaveAsInput, setShowSaveAsInput] = useState(false);
  const [saveAsPath, setSaveAsPath] = useState('');

  const isOpen = conflict !== null;

  // Reset state when dialog opens
  useEffect(() => {
    if (conflict) {
      setActiveTab('local');
      setShowSaveAsInput(false);
      // Suggest a new filename based on original
      const basePath = conflict.path.replace(/\.md$/, '');
      setSaveAsPath(`${basePath}_backup.md`);
    }
  }, [conflict]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSaveAsInput) {
          setShowSaveAsInput(false);
        } else {
          onDismiss?.();
        }
        return;
      }

      if (e.key === 'Tab' && !showSaveAsInput) {
        e.preventDefault();
        setActiveTab((prev) => (prev === 'local' ? 'external' : 'local'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showSaveAsInput, onDismiss]);

  // Content stats
  const localStats = useMemo(() => {
    if (!conflict) return { lines: 0, words: 0 };
    return {
      lines: getLineCount(conflict.localContent),
      words: getWordCount(conflict.localContent),
    };
  }, [conflict?.localContent]);

  const externalStats = useMemo(() => {
    if (!conflict) return { lines: 0, words: 0 };
    return {
      lines: getLineCount(conflict.externalContent),
      words: getWordCount(conflict.externalContent),
    };
  }, [conflict?.externalContent]);

  // Handlers
  const handleKeepLocal = useCallback(() => {
    if (isLoading) return;
    onResolve('keep_local');
  }, [onResolve, isLoading]);

  const handleKeepExternal = useCallback(() => {
    if (isLoading) return;
    onResolve('keep_external');
  }, [onResolve, isLoading]);

  const handleSaveAs = useCallback(() => {
    if (isLoading || !saveAsPath.trim()) return;
    onResolve('save_as', saveAsPath.trim() as FilePath);
    setShowSaveAsInput(false);
  }, [onResolve, saveAsPath, isLoading]);

  const handleDismiss = useCallback(() => {
    if (isLoading) return;
    onDismiss?.();
  }, [onDismiss, isLoading]);

  if (!conflict) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
          />

          {/* Dialog */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-black border border-neutral-800 w-full max-w-2xl pointer-events-auto"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <div className="flex-1">
                  <Label className="text-amber-400">
                    File Conflict Detected
                  </Label>
                  <div className="text-[10px] text-neutral-500 mt-0.5">
                    {truncatePath(conflict.path)} • Last synced{' '}
                    {formatDate(conflict.lastSyncedAt)}
                  </div>
                </div>
                <button
                  onClick={handleDismiss}
                  disabled={isLoading}
                  className="text-neutral-600 hover:text-white transition-colors disabled:opacity-50"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Explanation */}
                <p className="text-xs text-neutral-400">
                  The file on disk has been modified externally since your last
                  save. Choose how to resolve this conflict:
                </p>

                {/* Tab buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('local')}
                    className={`
                      flex-1 px-3 py-2 text-xs font-medium rounded border transition-colors
                      ${
                        activeTab === 'local'
                          ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                          : 'bg-neutral-900/30 border-neutral-800 text-neutral-500 hover:text-neutral-300'
                      }
                    `}
                  >
                    <Upload className="w-3 h-3 inline mr-1.5" />
                    Your Changes
                  </button>
                  <button
                    onClick={() => setActiveTab('external')}
                    className={`
                      flex-1 px-3 py-2 text-xs font-medium rounded border transition-colors
                      ${
                        activeTab === 'external'
                          ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                          : 'bg-neutral-900/30 border-neutral-800 text-neutral-500 hover:text-neutral-300'
                      }
                    `}
                  >
                    <Download className="w-3 h-3 inline mr-1.5" />
                    External Changes
                  </button>
                </div>

                {/* Content previews */}
                <div className="flex gap-3">
                  <ContentPreview
                    content={conflict.localContent}
                    label="Your Changes"
                    icon={<Upload className="w-3 h-3" />}
                    isActive={activeTab === 'local'}
                    stats={localStats}
                  />
                  <ContentPreview
                    content={conflict.externalContent}
                    label="External"
                    icon={<Download className="w-3 h-3" />}
                    isActive={activeTab === 'external'}
                    stats={externalStats}
                  />
                </div>

                {/* Save As input */}
                {showSaveAsInput && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={saveAsPath}
                      onChange={(e) => setSaveAsPath(e.target.value)}
                      placeholder="Enter new file path..."
                      className="
                        flex-1 px-3 py-2 text-xs font-mono
                        bg-neutral-900 border border-neutral-700 rounded
                        text-neutral-200 placeholder:text-neutral-600
                        focus:outline-none focus:border-cyan-500/50
                      "
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveAs();
                        if (e.key === 'Escape') setShowSaveAsInput(false);
                      }}
                    />
                    <button
                      onClick={handleSaveAs}
                      disabled={!saveAsPath.trim() || isLoading}
                      className="
                        px-4 py-2 text-xs font-medium
                        bg-cyan-500/20 border border-cyan-500/30 rounded
                        text-cyan-400 hover:bg-cyan-500/30
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-colors
                      "
                    >
                      Save
                    </button>
                  </motion.div>
                )}

                {/* Resolution buttons */}
                <div className="grid grid-cols-1 gap-2">
                  <ResolutionButton
                    icon={<Upload className="w-4 h-4" />}
                    label="Keep Your Changes"
                    description="Overwrite the file with your local changes"
                    onClick={handleKeepLocal}
                    variant="primary"
                    disabled={isLoading}
                  />
                  <ResolutionButton
                    icon={<Download className="w-4 h-4" />}
                    label="Keep External Changes"
                    description="Discard your changes and reload from disk"
                    onClick={handleKeepExternal}
                    variant="danger"
                    disabled={isLoading}
                  />
                  <ResolutionButton
                    icon={<Copy className="w-4 h-4" />}
                    label="Save Your Changes As..."
                    description="Save your changes to a new file, keep external version"
                    onClick={() => setShowSaveAsInput(true)}
                    variant="secondary"
                    disabled={isLoading || showSaveAsInput}
                  />
                </div>

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex items-center justify-center gap-2 py-2 text-xs text-neutral-500">
                    <motion.div
                      className="w-3 h-3 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                    />
                    Resolving conflict...
                  </div>
                )}
              </div>

              {/* Footer hint */}
              <div className="px-4 py-2 border-t border-neutral-800 bg-neutral-900/30">
                <p className="text-[10px] text-neutral-600 text-center">
                  Press{' '}
                  <kbd className="px-1 py-0.5 bg-neutral-800 rounded text-neutral-500">
                    Tab
                  </kbd>{' '}
                  to switch views •
                  <kbd className="px-1 py-0.5 bg-neutral-800 rounded text-neutral-500 ml-1">
                    Esc
                  </kbd>{' '}
                  to dismiss
                </p>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FileConflictDialog;
