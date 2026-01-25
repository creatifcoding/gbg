/**
 * TauriFilesystemTestbed
 *
 * Diagnostic testbed to debug Tauri filesystem IPC.
 * Tests the raw invoke() calls to isolate where the failure occurs.
 *
 * @module testbed/TauriFilesystemTestbed
 */

import { useState, useCallback, type CSSProperties } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
  VANTA_SPACING,
  VANTA_BORDERS,
  VANTA_ANIMATION,
} from '@/components/portal/tokens';

// =============================================================================
// Types (mirror Rust structs)
// =============================================================================

interface TauriFileEntry {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  extension: string | null;
  hidden: boolean;
  readable: boolean;
  writable: boolean;
  executable: boolean;
  createdAt: number;
  modifiedAt: number;
  accessedAt: number;
}

// =============================================================================
// Diagnostic Helpers
// =============================================================================

const isTauri = (): boolean => {
  // Tauri v2 uses __TAURI_INTERNALS__, v1 used __TAURI__
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
};

const getTauriInfo = (): Record<string, unknown> => {
  if (typeof window === 'undefined') {
    return { error: 'No window object' };
  }

  const hasV2 = '__TAURI_INTERNALS__' in window;
  const hasV1 = '__TAURI__' in window;
  const win = window as unknown as Record<string, unknown>;

  return {
    hasTauriV2: hasV2,
    hasTauriV1: hasV1,
    tauriVersion: hasV2 ? 'v2' : hasV1 ? 'v1' : 'none',
    internalsKeys: hasV2
      ? Object.keys(win['__TAURI_INTERNALS__'] as object)
      : [],
    tauriKeys: hasV1 ? Object.keys(win['__TAURI__'] as object) : [],
    userAgent: navigator.userAgent,
  };
};

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: {
    padding: VANTA_SPACING['6'],
    fontFamily: VANTA_TYPOGRAPHY.family.mono,
    fontSize: VANTA_TYPOGRAPHY.size.sm,
    background: VANTA_COLORS.gradient.surface,
    color: VANTA_COLORS.text.primary,
    minHeight: '100vh',
  } satisfies CSSProperties,

  header: {
    ...VANTA_TYPOGRAPHY.preset.cardTitle,
    fontSize: VANTA_TYPOGRAPHY.size.xl,
    color: VANTA_COLORS.accent.cyan,
    marginBottom: VANTA_SPACING['2'],
  } satisfies CSSProperties,

  subtitle: {
    ...VANTA_TYPOGRAPHY.preset.cardSubtitle,
    color: VANTA_COLORS.text.tertiary,
    marginBottom: VANTA_SPACING['6'],
  } satisfies CSSProperties,

  inputRow: {
    display: 'flex',
    gap: VANTA_SPACING['3'],
    alignItems: 'center',
    marginBottom: VANTA_SPACING['6'],
  } satisfies CSSProperties,

  label: {
    ...VANTA_TYPOGRAPHY.preset.label,
    color: VANTA_COLORS.text.secondary,
  } satisfies CSSProperties,

  input: {
    flex: 1,
    maxWidth: '400px',
    padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['3']}`,
    background: VANTA_COLORS.surface.elevated,
    border: VANTA_BORDERS.style.hairline,
    borderRadius: VANTA_BORDERS.radius.sm,
    color: VANTA_COLORS.text.primary,
    fontFamily: VANTA_TYPOGRAPHY.family.mono,
    fontSize: VANTA_TYPOGRAPHY.size.sm,
    outline: 'none',
    transition: VANTA_ANIMATION.transition.colors,
  } satisfies CSSProperties,

  button: {
    padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['4']}`,
    background: VANTA_COLORS.accent.cyan,
    color: VANTA_COLORS.surface.void,
    border: 'none',
    borderRadius: VANTA_BORDERS.radius.sm,
    fontFamily: VANTA_TYPOGRAPHY.family.mono,
    fontSize: VANTA_TYPOGRAPHY.size.sm,
    fontWeight: VANTA_TYPOGRAPHY.weight.semibold,
    letterSpacing: VANTA_TYPOGRAPHY.tracking.wide,
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    transition: VANTA_ANIMATION.transition.all,
  } satisfies CSSProperties,

  buttonDisabled: {
    background: VANTA_COLORS.surface.border,
    color: VANTA_COLORS.text.muted,
    cursor: 'not-allowed',
  } satisfies CSSProperties,

  results: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: VANTA_SPACING['4'],
  } satisfies CSSProperties,

  resultCard: {
    padding: VANTA_SPACING['4'],
    background: VANTA_COLORS.surface.base,
    borderRadius: VANTA_BORDERS.radius.sm,
    transition: VANTA_ANIMATION.transition.colors,
  } satisfies CSSProperties,

  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: VANTA_SPACING['2'],
  } satisfies CSSProperties,

  resultTitle: {
    ...VANTA_TYPOGRAPHY.preset.label,
    fontSize: VANTA_TYPOGRAPHY.size.sm,
    color: VANTA_COLORS.text.primary,
    textTransform: 'none' as const,
  } satisfies CSSProperties,

  resultStatus: {
    ...VANTA_TYPOGRAPHY.preset.micro,
    padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
    borderRadius: VANTA_BORDERS.radius.sm,
  } satisfies CSSProperties,

  pre: {
    fontFamily: VANTA_TYPOGRAPHY.family.mono,
    fontSize: VANTA_TYPOGRAPHY.size.xs,
    padding: VANTA_SPACING['3'],
    borderRadius: VANTA_BORDERS.radius.sm,
    overflow: 'auto',
    margin: 0,
    maxHeight: '280px',
  } satisfies CSSProperties,

  hints: {
    color: VANTA_COLORS.text.muted,
    marginTop: VANTA_SPACING['6'],
  } satisfies CSSProperties,

  code: {
    fontFamily: VANTA_TYPOGRAPHY.family.mono,
    fontSize: VANTA_TYPOGRAPHY.size.xs,
    background: VANTA_COLORS.surface.elevated,
    padding: `${VANTA_SPACING['0.5']} ${VANTA_SPACING['1.5']}`,
    borderRadius: VANTA_BORDERS.radius.sm,
  } satisfies CSSProperties,
} as const;

// =============================================================================
// Component
// =============================================================================

interface TestResult {
  test: string;
  status: 'pending' | 'running' | 'success' | 'error';
  result?: unknown;
  error?: string;
  durationMs?: number;
}

const getStatusColor = (status: TestResult['status']) => {
  switch (status) {
    case 'success':
      return VANTA_COLORS.accent.emerald;
    case 'error':
      return VANTA_COLORS.accent.rose;
    case 'running':
      return VANTA_COLORS.accent.amber;
    default:
      return VANTA_COLORS.text.muted;
  }
};

const getStatusBorder = (status: TestResult['status']) => {
  switch (status) {
    case 'success':
      return `1px solid ${VANTA_COLORS.accent.emeraldMuted}`;
    case 'error':
      return `1px solid ${VANTA_COLORS.accent.roseMuted}`;
    default:
      return VANTA_BORDERS.style.subtle;
  }
};

export function TauriFilesystemTestbed() {
  const [testPath, setTestPath] = useState('/home');
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = useCallback((result: TestResult) => {
    setResults((prev) => [...prev, result]);
  }, []);

  const updateResult = useCallback(
    (test: string, update: Partial<TestResult>) => {
      setResults((prev) =>
        prev.map((r) => (r.test === test ? { ...r, ...update } : r))
      );
    },
    []
  );

  const runDiagnostics = useCallback(async () => {
    setResults([]);
    setIsRunning(true);

    // Test 1: Environment detection
    const envTest: TestResult = {
      test: '1. Environment Detection',
      status: 'running',
    };
    addResult(envTest);

    try {
      const info = getTauriInfo();
      updateResult(envTest.test, {
        status: 'success',
        result: info,
      });
    } catch (e) {
      updateResult(envTest.test, {
        status: 'error',
        error: String(e),
      });
    }

    // Test 2: isTauri() check
    const tauriCheckTest: TestResult = {
      test: '2. isTauri() Check',
      status: 'running',
    };
    addResult(tauriCheckTest);

    const tauriDetected = isTauri();
    updateResult(tauriCheckTest.test, {
      status: tauriDetected ? 'success' : 'error',
      result: { isTauri: tauriDetected },
      error: tauriDetected
        ? undefined
        : 'Tauri not detected — running in browser mode',
    });

    if (!tauriDetected) {
      setIsRunning(false);
      return;
    }

    // Test 3: Raw invoke() - fs_list_directory with /
    const rootTest: TestResult = {
      test: '3. invoke("fs_list_directory", { path: "/" })',
      status: 'running',
    };
    addResult(rootTest);

    const start3 = performance.now();
    try {
      const entries = await invoke<TauriFileEntry[]>('fs_list_directory', {
        path: '/',
      });
      updateResult(rootTest.test, {
        status: 'success',
        result: {
          count: entries.length,
          first5: entries
            .slice(0, 5)
            .map((e) => ({ name: e.name, type: e.type })),
        },
        durationMs: performance.now() - start3,
      });
    } catch (e) {
      updateResult(rootTest.test, {
        status: 'error',
        error: String(e),
        durationMs: performance.now() - start3,
      });
    }

    // Test 4: Raw invoke() - fs_list_directory with user-provided path
    const userPathTest: TestResult = {
      test: `4. invoke("fs_list_directory", { path: "${testPath}" })`,
      status: 'running',
    };
    addResult(userPathTest);

    const start4 = performance.now();
    try {
      const entries = await invoke<TauriFileEntry[]>('fs_list_directory', {
        path: testPath,
      });
      updateResult(userPathTest.test, {
        status: 'success',
        result: {
          count: entries.length,
          entries: entries.slice(0, 20).map((e) => ({
            name: e.name,
            type: e.type,
            size: e.size,
            extension: e.extension,
          })),
        },
        durationMs: performance.now() - start4,
      });
    } catch (e) {
      updateResult(userPathTest.test, {
        status: 'error',
        error: String(e),
        durationMs: performance.now() - start4,
      });
    }

    // Test 5: fs_file_metadata
    const metaTest: TestResult = {
      test: `5. invoke("fs_file_metadata", { path: "${testPath}" })`,
      status: 'running',
    };
    addResult(metaTest);

    const start5 = performance.now();
    try {
      const meta = await invoke('fs_file_metadata', { path: testPath });
      updateResult(metaTest.test, {
        status: 'success',
        result: meta,
        durationMs: performance.now() - start5,
      });
    } catch (e) {
      updateResult(metaTest.test, {
        status: 'error',
        error: String(e),
        durationMs: performance.now() - start5,
      });
    }

    // Test 6: Check for .md files recursively (manual traversal)
    const mdTest: TestResult = {
      test: `6. Find .md files in ${testPath} (1 level deep)`,
      status: 'running',
    };
    addResult(mdTest);

    const start6 = performance.now();
    try {
      const entries = await invoke<TauriFileEntry[]>('fs_list_directory', {
        path: testPath,
      });
      const mdFiles = entries.filter(
        (e) =>
          e.type === 'file' &&
          (e.name.endsWith('.md') || e.name.endsWith('.mdx'))
      );
      const directories = entries.filter((e) => e.type === 'directory');

      updateResult(mdTest.test, {
        status: 'success',
        result: {
          totalEntries: entries.length,
          mdFilesFound: mdFiles.length,
          mdFiles: mdFiles.map((f) => f.name),
          directories: directories.slice(0, 10).map((d) => d.name),
        },
        durationMs: performance.now() - start6,
      });
    } catch (e) {
      updateResult(mdTest.test, {
        status: 'error',
        error: String(e),
        durationMs: performance.now() - start6,
      });
    }

    setIsRunning(false);
  }, [testPath, addResult, updateResult]);

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>TAURI FILESYSTEM DIAGNOSTIC</h1>
      <p style={styles.subtitle}>
        Tests raw Tauri IPC calls to debug filesystem access
      </p>

      {/* Input */}
      <div style={styles.inputRow}>
        <label style={styles.label}>Test Path</label>
        <input
          type="text"
          value={testPath}
          onChange={(e) => setTestPath(e.target.value)}
          style={styles.input}
          onFocus={(e) =>
            (e.target.style.borderColor = VANTA_COLORS.accent.cyan)
          }
          onBlur={(e) =>
            (e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)')
          }
        />
        <button
          onClick={runDiagnostics}
          disabled={isRunning}
          style={{
            ...styles.button,
            ...(isRunning ? styles.buttonDisabled : {}),
          }}
        >
          {isRunning ? 'Running...' : 'Run Diagnostics'}
        </button>
      </div>

      {/* Results */}
      <div style={styles.results}>
        {results.map((result, i) => (
          <div
            key={i}
            style={{
              ...styles.resultCard,
              border: getStatusBorder(result.status),
            }}
          >
            <div style={styles.resultHeader}>
              <span style={styles.resultTitle}>{result.test}</span>
              <span
                style={{
                  ...styles.resultStatus,
                  color: getStatusColor(result.status),
                  background:
                    result.status === 'success'
                      ? VANTA_COLORS.accent.emeraldGlow
                      : result.status === 'error'
                      ? VANTA_COLORS.accent.roseGlow
                      : VANTA_COLORS.surface.elevated,
                }}
              >
                {result.status.toUpperCase()}
                {result.durationMs !== undefined &&
                  ` · ${result.durationMs.toFixed(1)}ms`}
              </span>
            </div>

            {result.error && (
              <pre
                style={{
                  ...styles.pre,
                  color: VANTA_COLORS.accent.rose,
                  background: VANTA_COLORS.accent.roseGlow,
                }}
              >
                {result.error}
              </pre>
            )}

            {result.result !== undefined && (
              <pre
                style={{
                  ...styles.pre,
                  color: VANTA_COLORS.text.secondary,
                  background: VANTA_COLORS.surface.elevated,
                }}
              >
                {JSON.stringify(
                  result.result as Record<string, unknown>,
                  null,
                  2
                )}
              </pre>
            )}
          </div>
        ))}
      </div>

      {/* Quick hints */}
      {results.length === 0 && (
        <div style={styles.hints}>
          <p style={{ marginBottom: VANTA_SPACING['2'] }}>
            Suggested test paths:
          </p>
          <ul style={{ paddingLeft: VANTA_SPACING['4'], margin: 0 }}>
            <li>
              <code style={styles.code}>/</code> — Root directory
            </li>
            <li>
              <code style={styles.code}>/home</code> — Home directories
            </li>
            <li>
              <code style={styles.code}>/tmp</code> — Temp directory
            </li>
            <li>Your project's docs folder</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default TauriFilesystemTestbed;
