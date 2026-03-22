/**
 * Loading State Components
 *
 * Animated loading states for generative MorphCard content.
 * Provides morphing placeholder, scramble indicator, and progressive reveal.
 *
 * @module morph-card/components/LoadingStates
 */

import { type ReactNode, useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useScrambleText } from '@/lib/animation/text-effects';
import { useModalSafe } from '@/lib/overlays/visual/hooks/useModal';
import type { GenerationStatus } from '../schemas/generative-state';
import type { ParseResult } from 'effect';
import type { JsonPatch } from '../schemas/patch-protocol';

// =============================================================================
// Types
// =============================================================================

/**
 * Props for loading state components
 */
interface LoadingProps {
  /** Progress 0-1 for streaming */
  progress?: number;
  /** Placeholder text to scramble */
  placeholder?: string;
}

// =============================================================================
// Morphing Placeholder
// =============================================================================

/**
 * Morphing placeholder - pulses/animates while loading
 */
export function MorphingPlaceholder({ progress = 0 }: LoadingProps) {
  return (
    <motion.div
      className="w-full h-full bg-gradient-to-br from-neutral-900/50 to-neutral-800/30 rounded-lg relative overflow-hidden"
      animate={{
        opacity: [0.5, 0.8, 0.5],
        scale: [1, 1.01, 1],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {/* Shimmer effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
        animate={{
          x: ['-100%', '100%'],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      {/* Progress bar */}
      {progress > 0 && (
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-cyan-500/50 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.2 }}
        />
      )}
    </motion.div>
  );
}

// =============================================================================
// Scramble Loading Indicator
// =============================================================================

/**
 * Scramble loading indicator - random chars cycle
 */
export function ScrambleIndicator({ placeholder = 'GENERATING...' }: LoadingProps) {
  const { ref, replay } = useScrambleText({
    text: placeholder,
    preset: 'cyber',
    speed: 0.8,
    scramble: 8,
  });

  useEffect(() => {
    const interval = setInterval(replay, 2000);
    return () => clearInterval(interval);
  }, [replay]);

  return (
    <span
      ref={ref as React.RefObject<HTMLSpanElement>}
      className="font-mono text-xs text-neutral-500 tracking-widest"
    />
  );
}

// =============================================================================
// Progressive Reveal
// =============================================================================

/**
 * Progressive reveal - content appears with blur transition
 */
export function ProgressiveReveal({
  children,
  revealed,
}: {
  children: ReactNode;
  revealed: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(8px)' }}
      animate={revealed ? { opacity: 1, filter: 'blur(0px)' } : {}}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

// =============================================================================
// Typewriter Text
// =============================================================================

/**
 * Text typewriter - content types out character by character
 */
export function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [text]);

  return <span className="font-mono">{displayed}</span>;
}

// =============================================================================
// Combined Generative Loading
// =============================================================================

/**
 * Combined loading state for generative content
 *
 * Shows different states based on generation status:
 * - idle: nothing (static placeholder slot)
 * - loading: MorphingPlaceholder + ScrambleIndicator
 * - streaming: ProgressiveReveal with partial content
 * - success: children (full content)
 * - error: error message with retry button
 */
export interface GenerativeLoadingProps {
  /** Current generation status */
  status: GenerationStatus;
  /** Progress for streaming (0-1) */
  progress: number;
  /** Error message (if status is 'error') */
  error?: string;
  /** Retry callback */
  onRetry?: () => void;
  /** Generated content to display */
  children: ReactNode;
  /** Custom loading placeholder text */
  loadingText?: string;
}

export function GenerativeLoading({
  status,
  progress,
  error,
  onRetry,
  children,
  loadingText = 'GENERATING...',
}: GenerativeLoadingProps) {
  return (
    <AnimatePresence mode="wait">
      {status === 'idle' && (
        <motion.div
          key="idle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          exit={{ opacity: 0 }}
          className="w-full h-full flex items-center justify-center"
        >
          <span className="text-xs text-neutral-600 font-mono">AWAITING PROMPT</span>
        </motion.div>
      )}

      {status === 'loading' && (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="w-full h-full flex flex-col items-center justify-center gap-3"
        >
          <MorphingPlaceholder progress={progress} />
          <ScrambleIndicator placeholder={loadingText} />
        </motion.div>
      )}

      {status === 'streaming' && (
        <motion.div
          key="streaming"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="w-full h-full relative"
        >
          <ProgressiveReveal revealed={progress > 0.1}>
            {children}
          </ProgressiveReveal>
          {/* Streaming progress indicator */}
          <motion.div
            className="absolute bottom-1 left-1 right-1 h-0.5 bg-neutral-800 rounded-full overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-500/50 to-cyan-400/30"
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
            />
          </motion.div>
        </motion.div>
      )}

      {status === 'success' && (
        <motion.div
          key="success"
          initial={{ opacity: 0, filter: 'blur(4px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.2 }}
          className="w-full h-full"
        >
          {children}
        </motion.div>
      )}

      {status === 'error' && (
        <motion.div
          key="error"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full h-full flex flex-col items-center justify-center gap-3 p-4"
        >
          <span className="text-xs text-red-400 font-mono text-center">
            {error || 'GENERATION FAILED'}
          </span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-3 py-1.5 text-xs font-mono bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded border border-red-800/50 transition-colors"
            >
              RETRY
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// Decode Error Boundary
// =============================================================================

/** Fix agent status */
export type FixAgentStatus = 'idle' | 'fixing' | 'fixed' | 'failed';

/**
 * Props for DecodeErrorBoundary
 */
export interface DecodeErrorBoundaryProps {
  /** The parse error from Schema.decodeUnknownEither */
  error: ParseResult.ParseError;
  /** Retry callback - triggers full regeneration */
  onRetry?: () => void;
  /** Card ID for fix agent context (enables fix agent) */
  cardId?: string;
  /** Current tree state for fix agent context */
  currentTree?: unknown;
  /** Original prompt for fix agent context */
  originalPrompt?: string;
  /** Callback when fix patches are applied */
  onFixPatches?: (patches: JsonPatch[]) => void;
  /** Auto-trigger fix agent on mount (default: false) */
  autoFix?: boolean;
}

/**
 * Error details modal content
 */
function ErrorDetailsModalContent({
  error,
  onRetry,
  onFix,
  fixStatus,
  onClose,
}: {
  error: ParseResult.ParseError;
  onRetry?: () => void;
  onFix?: () => void;
  fixStatus?: FixAgentStatus;
  onClose?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-4 max-h-[60vh]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-sans text-amber-300">decode error</span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            ×
          </button>
        )}
      </div>

      {/* Error message - scrollable */}
      <div className="flex-1 overflow-auto bg-neutral-900/50 rounded p-3 border border-neutral-800">
        <pre className="text-[11px] font-mono text-amber-400/80 whitespace-pre-wrap break-words">
          {error.message || 'Unknown decode error'}
        </pre>
      </div>

      {/* Fix agent status */}
      {fixStatus === 'fixing' && (
        <div className="flex items-center gap-2 text-[11px] text-cyan-400/80 font-sans">
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            ●
          </motion.span>
          fix agent working...
        </div>
      )}
      {fixStatus === 'fixed' && (
        <div className="text-[11px] text-emerald-400/80 font-sans">
          ✓ fix applied successfully
        </div>
      )}
      {fixStatus === 'failed' && (
        <div className="text-[11px] text-red-400/80 font-sans">
          ✗ fix agent failed - try regenerate
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        {/* Fix button (preferred) - only show when fix context available */}
        {onFix && fixStatus !== 'fixing' && fixStatus !== 'fixed' && (
          <motion.button
            onClick={() => {
              onFix();
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-3 py-1.5 text-[11px] font-sans bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-300/80 rounded border border-cyan-800/30 transition-colors"
          >
            fix element
          </motion.button>
        )}
        {/* Regenerate button (fallback) */}
        {onRetry && fixStatus !== 'fixing' && (
          <motion.button
            onClick={() => {
              onRetry();
              onClose?.();
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-3 py-1.5 text-[11px] font-sans bg-amber-900/30 hover:bg-amber-900/50 text-amber-300/80 rounded border border-amber-800/30 transition-colors"
          >
            regenerate
          </motion.button>
        )}
      </div>
    </div>
  );
}

/**
 * Extract error path from ParseError message
 * Attempts to find a path like /elements/... in the error message
 */
function extractErrorPath(errorMessage: string): string {
  // Look for paths like /elements/chart-1 or /root
  const pathMatch = errorMessage.match(/\/(?:elements|root|children)[^\s,)]+/);
  return pathMatch?.[0] ?? '/root';
}

/**
 * Error boundary for UITree decode failures
 *
 * Shown when generation completes but the response cannot be decoded into a valid UITree.
 * Click the error preview to open a modal with full details.
 *
 * When cardId, currentTree, and originalPrompt are provided, enables the fix agent:
 * - "fix element" button calls /morph-agent/fix endpoint
 * - Agent makes minimal fixes to the broken element
 * - Patches are returned via onFixPatches callback
 *
 * If autoFix is true, triggers fix agent automatically on mount.
 */
export function DecodeErrorBoundary({
  error,
  onRetry,
  cardId,
  currentTree,
  originalPrompt,
  onFixPatches,
  autoFix = false,
}: DecodeErrorBoundaryProps) {
  const modal = useModalSafe();
  const [fixStatus, setFixStatus] = useState<FixAgentStatus>('idle');
  const [fixError, setFixError] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  // Determine if fix agent is available (has required context)
  const fixAgentAvailable = Boolean(cardId && currentTree && originalPrompt && onFixPatches);

  // Scramble animation for the reminder text
  const reminderText = fixAgentAvailable
    ? 'fix agent ready - minimal surgical fix'
    : 'patch the broken element, not the whole tree';
  const { ref: reminderRef } = useScrambleText({
    text: reminderText,
    preset: 'cyber',
    speed: 0.6,
    scramble: 4,
  });

  // Extract first issue path for display - keep it short
  const issuePreview = error.message?.slice(0, 60) ?? 'element decode failed';

  /**
   * Trigger the fix agent to repair the broken element
   * Calls POST /morph-agent/fix and streams patches
   */
  const triggerFixAgent = useCallback(async () => {
    if (!fixAgentAvailable || !cardId || !currentTree || !originalPrompt || !onFixPatches) {
      return;
    }

    // Abort any previous request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    setFixStatus('fixing');
    setFixError(undefined);

    try {
      const response = await fetch('/morph-agent/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _tag: 'FixAgentRequest',
          cardId,
          errorMessage: error.message ?? 'Unknown decode error',
          errorPath: extractErrorPath(error.message ?? ''),
          currentTree,
          originalPrompt,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Stream the response and collect patches
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const collectedPatches: JsonPatch[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            // Agent emits MorphPatch with patches array
            if (parsed._tag === 'MorphPatch' && Array.isArray(parsed.patches)) {
              collectedPatches.push(...parsed.patches);
            }
          } catch {
            // Ignore parse errors for individual lines
          }
        }
      }

      // Apply collected patches
      if (collectedPatches.length > 0) {
        onFixPatches(collectedPatches);
        setFixStatus('fixed');
      } else {
        setFixStatus('failed');
        setFixError('Fix agent returned no patches');
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setFixStatus('idle');
      } else {
        setFixStatus('failed');
        setFixError((err as Error).message);
        console.error('[DecodeErrorBoundary] Fix agent error:', err);
      }
    }
  }, [fixAgentAvailable, cardId, currentTree, originalPrompt, onFixPatches, error.message]);

  // Auto-fix on mount if enabled
  useEffect(() => {
    if (autoFix && fixAgentAvailable && fixStatus === 'idle') {
      triggerFixAgent();
    }
  }, [autoFix, fixAgentAvailable, fixStatus, triggerFixAgent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  // Open modal with full error details
  const openErrorDetails = useCallback(() => {
    if (!modal) return;

    const modalId = modal.open(
      {
        id: 'decode-error-details',
        size: 'md',
        closeOnEscape: true,
        closeOnBackdropClick: true,
      },
      <ErrorDetailsModalContent
        error={error}
        onRetry={onRetry}
        onFix={fixAgentAvailable ? triggerFixAgent : undefined}
        fixStatus={fixStatus}
        onClose={() => modal.close(modalId)}
      />
    );
  }, [modal, error, onRetry, fixAgentAvailable, triggerFixAgent, fixStatus]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full h-full flex flex-col items-center justify-center gap-3 p-4 bg-amber-950/10 border border-amber-900/20 rounded-lg"
    >
      {/* Playful glitch icon */}
      <motion.div
        className="text-2xl"
        animate={{
          rotate: [0, -5, 5, -3, 0],
          scale: [1, 1.1, 0.95, 1.05, 1],
        }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        ~
      </motion.div>

      {/* Fix status indicator */}
      {fixStatus === 'fixing' && (
        <motion.div
          className="flex items-center gap-2 text-[11px] text-cyan-400/80 font-sans"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            ●
          </motion.span>
          fix agent working...
        </motion.div>
      )}
      {fixStatus === 'fixed' && (
        <motion.div
          className="text-[11px] text-emerald-400/80 font-sans"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          ✓ fix applied
        </motion.div>
      )}
      {fixStatus === 'failed' && (
        <div className="text-[11px] text-red-400/80 font-sans text-center">
          <div>✗ fix failed</div>
          {fixError && <div className="text-[10px] text-red-400/60 mt-0.5">{fixError.slice(0, 40)}</div>}
        </div>
      )}

      {/* Error path preview - clickable to open modal */}
      {fixStatus !== 'fixing' && (
        <motion.button
          onClick={openErrorDetails}
          whileHover={{ scale: 1.01 }}
          className="text-[11px] text-amber-400/60 font-sans max-w-[200px] truncate hover:text-amber-400/80 transition-colors cursor-pointer underline underline-offset-2 decoration-amber-800/30"
          title="Click to view full error"
        >
          {issuePreview}...
        </motion.button>
      )}

      {/* Scrambled reminder - sans-serif, playful */}
      <span
        ref={reminderRef as React.RefObject<HTMLSpanElement>}
        className="text-[10px] text-neutral-500 font-sans italic"
      />

      {/* Action buttons */}
      <div className="flex gap-2 mt-1">
        {/* Fix button (preferred) - only show when fix agent available */}
        {fixAgentAvailable && fixStatus !== 'fixing' && fixStatus !== 'fixed' && (
          <motion.button
            onClick={triggerFixAgent}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-3 py-1.5 text-[11px] font-sans bg-cyan-900/20 hover:bg-cyan-900/40 text-cyan-300/80 rounded border border-cyan-800/30 transition-colors"
          >
            fix element
          </motion.button>
        )}
        {/* Regenerate button (fallback) */}
        {onRetry && fixStatus !== 'fixing' && (
          <motion.button
            onClick={onRetry}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-3 py-1.5 text-[11px] font-sans bg-amber-900/20 hover:bg-amber-900/40 text-amber-300/80 rounded border border-amber-800/30 transition-colors"
          >
            regenerate
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export default GenerativeLoading;
