/**
 * DocumentWatchProvider
 *
 * Provides real-time document synchronization via NATS KV watch.
 * Wraps components that need live updates from document changes.
 *
 * Features:
 * - Subscribes to NATS KV document changes on mount
 * - Applies PUT/DEL/PURGE events to documentsAtom
 * - Exposes watch state via context (isWatching, eventCount, etc.)
 * - Displays optional sync indicator
 *
 * @module testbed/collaboration/v2/DocumentWatchProvider
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { useDocumentWatch } from '@/lib/editor/v3/hooks/useDocuments';
import type { DocumentWatchEvent } from '@/lib/editor/v3/atoms/documents';
import { panelRegistry } from './panel-stx';
import {
  VANTA_COLORS,
  VANTA_SPACING,
  VANTA_TYPOGRAPHY,
} from '@/components/portal/tokens';

// =============================================================================
// Context
// =============================================================================

export interface DocumentWatchState {
  /** Whether the watch stream is active */
  isWatching: boolean;
  /** Whether the watch atom is still initializing */
  isInitializing: boolean;
  /** Error if watch failed to start */
  error: unknown | null;
  /** Number of events received since mount */
  eventCount: number;
  /** Most recent event received */
  lastEvent: DocumentWatchEvent | null;
}

const DocumentWatchContext = createContext<DocumentWatchState | null>(null);

/**
 * Hook to access document watch state from any child component.
 *
 * @throws If used outside of DocumentWatchProvider
 *
 * @example
 * ```tsx
 * function SyncIndicator() {
 *   const { isWatching, eventCount } = useDocumentWatchState()
 *   return <span>{isWatching ? `Synced (${eventCount})` : 'Offline'}</span>
 * }
 * ```
 */
export function useDocumentWatchState(): DocumentWatchState {
  const ctx = useContext(DocumentWatchContext);
  if (!ctx) {
    throw new Error(
      'useDocumentWatchState must be used within a DocumentWatchProvider'
    );
  }
  return ctx;
}

/**
 * Hook to access document watch state, returns null if outside provider.
 * Use this for optional integration.
 */
export function useOptionalDocumentWatchState(): DocumentWatchState | null {
  return useContext(DocumentWatchContext);
}

// =============================================================================
// Sync Indicator Component
// =============================================================================

interface SyncIndicatorProps {
  state: DocumentWatchState;
  /** Position on screen */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Show event count */
  showCount?: boolean;
}

function SyncIndicator({
  state,
  position = 'top-right',
  showCount = false,
}: SyncIndicatorProps) {
  const { isWatching, isInitializing, error, eventCount } = state;

  // Position styles
  const positionStyles: Record<string, React.CSSProperties> = {
    'top-right': { top: VANTA_SPACING['2'], right: VANTA_SPACING['2'] },
    'top-left': { top: VANTA_SPACING['2'], left: VANTA_SPACING['2'] },
    'bottom-right': { bottom: VANTA_SPACING['2'], right: VANTA_SPACING['2'] },
    'bottom-left': { bottom: VANTA_SPACING['2'], left: VANTA_SPACING['2'] },
  };

  // Determine status
  let statusColor: string = VANTA_COLORS.text.muted;
  let statusText = 'Offline';
  let pulseAnimation = false;

  if (error) {
    statusColor = VANTA_COLORS.accent.rose;
    statusText = 'Error';
  } else if (isInitializing) {
    statusColor = VANTA_COLORS.accent.amber;
    statusText = 'Connecting...';
    pulseAnimation = true;
  } else if (isWatching) {
    statusColor = VANTA_COLORS.accent.emerald;
    statusText = showCount ? `Synced (${eventCount})` : 'Synced';
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      style={{
        position: 'absolute',
        ...positionStyles[position],
        display: 'flex',
        alignItems: 'center',
        gap: VANTA_SPACING['1'],
        padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: 4,
        fontSize: 11,
        fontFamily: VANTA_TYPOGRAPHY.family.mono,
        color: VANTA_COLORS.text.secondary,
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      {/* Status dot */}
      <motion.div
        animate={
          pulseAnimation
            ? {
                scale: [1, 1.2, 1],
                opacity: [1, 0.7, 1],
              }
            : {}
        }
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: statusColor,
          boxShadow: `0 0 4px ${statusColor}`,
        }}
      />
      <span>{statusText}</span>
    </motion.div>
  );
}

// =============================================================================
// Provider Component
// =============================================================================

export interface DocumentWatchProviderProps {
  children: ReactNode;
  /** Enable debug logging */
  debug?: boolean;
  /** Show sync indicator */
  showIndicator?: boolean;
  /** Indicator position */
  indicatorPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Show event count in indicator */
  showEventCount?: boolean;
  /** Called when an event is received */
  onEvent?: (event: DocumentWatchEvent) => void;
}

/**
 * Provider that enables real-time document synchronization.
 *
 * Wraps your component tree and:
 * 1. Subscribes to NATS KV document changes
 * 2. Applies changes to documentsAtom (PUT → upsert, DEL/PURGE → remove)
 * 3. Exposes watch state via useDocumentWatchState() hook
 * 4. Optionally displays a sync indicator
 *
 * @example
 * ```tsx
 * // Basic usage
 * <DocumentWatchProvider>
 *   <AutonomousEditorPanel ... />
 * </DocumentWatchProvider>
 *
 * // With indicator
 * <DocumentWatchProvider showIndicator indicatorPosition="bottom-right">
 *   <AutonomousEditorPanel ... />
 * </DocumentWatchProvider>
 *
 * // With event callback
 * <DocumentWatchProvider onEvent={(e) => console.log('Doc changed:', e.key)}>
 *   <AutonomousEditorPanel ... />
 * </DocumentWatchProvider>
 * ```
 */
export function DocumentWatchProvider({
  children,
  debug = false,
  showIndicator = false,
  indicatorPosition = 'top-right',
  showEventCount = false,
  onEvent,
}: DocumentWatchProviderProps) {
  // Subscribe to document watch stream
  const watchState = useDocumentWatch(panelRegistry, {
    debug,
    onEvent,
  });

  // Memoize context value
  const contextValue = useMemo<DocumentWatchState>(
    () => ({
      isWatching: watchState.isWatching,
      isInitializing: watchState.isInitializing,
      error: watchState.error,
      eventCount: watchState.eventCount,
      lastEvent: watchState.lastEvent,
    }),
    [
      watchState.isWatching,
      watchState.isInitializing,
      watchState.error,
      watchState.eventCount,
      watchState.lastEvent,
    ]
  );

  return (
    <DocumentWatchContext.Provider value={contextValue}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {children}
        <AnimatePresence>
          {showIndicator && (
            <SyncIndicator
              state={contextValue}
              position={indicatorPosition}
              showCount={showEventCount}
            />
          )}
        </AnimatePresence>
      </div>
    </DocumentWatchContext.Provider>
  );
}

// =============================================================================
// Convenience Export
// =============================================================================

export { DocumentWatchProvider as default };
