/**
 * IgnoreService
 *
 * Effect.Service for parsing and matching gitignore-style patterns.
 * Used to filter files during directory scanning (e.g., .tmnlignore).
 *
 * Supports:
 * - Glob patterns (*.log, **\/node_modules)
 * - Negation (!important.md)
 * - Directory patterns (build/)
 * - Comments (#)
 * - Blank lines (ignored)
 *
 * @module file-index/services/IgnoreService
 */

import { Effect, Ref } from 'effect';

// =============================================================================
// Types
// =============================================================================

/**
 * Parsed ignore pattern with metadata.
 */
export interface IgnorePattern {
  readonly raw: string;
  readonly regex: RegExp;
  readonly negated: boolean;
  readonly directoryOnly: boolean;
}

/**
 * Result of checking if a path should be ignored.
 */
export interface IgnoreCheckResult {
  readonly ignored: boolean;
  readonly matchedPattern?: string;
}

// =============================================================================
// Pattern Parsing
// =============================================================================

/**
 * Convert a gitignore pattern to a RegExp.
 *
 * Rules:
 * - `*` matches anything except `/`
 * - `**` matches anything including `/`
 * - `?` matches single character except `/`
 * - `[abc]` matches character class
 * - Leading `/` anchors to root
 * - Trailing `/` matches directories only
 * - `!` at start negates the pattern
 */
function patternToRegex(pattern: string): RegExp {
  let regexStr = '';
  let i = 0;

  // Handle leading slash (anchor to root)
  const anchorToRoot = pattern.startsWith('/');
  if (anchorToRoot) {
    pattern = pattern.slice(1);
    regexStr = '^';
  } else {
    // Match anywhere in path
    regexStr = '(^|/)';
  }

  while (i < pattern.length) {
    const char = pattern[i];
    const next = pattern[i + 1];

    if (char === '*' && next === '*') {
      // `**` matches anything
      if (pattern[i + 2] === '/') {
        regexStr += '(.*/)?';
        i += 3;
      } else {
        regexStr += '.*';
        i += 2;
      }
    } else if (char === '*') {
      // `*` matches anything except `/`
      regexStr += '[^/]*';
      i++;
    } else if (char === '?') {
      // `?` matches single char except `/`
      regexStr += '[^/]';
      i++;
    } else if (char === '[') {
      // Character class
      const end = pattern.indexOf(']', i);
      if (end === -1) {
        regexStr += '\\[';
        i++;
      } else {
        const charClass = pattern.slice(i, end + 1);
        regexStr += charClass;
        i = end + 1;
      }
    } else if (char === '.') {
      regexStr += '\\.';
      i++;
    } else if (char === '/') {
      regexStr += '/';
      i++;
    } else {
      // Escape special regex chars
      regexStr += char.replace(/[\\^$+?.()|{}]/g, '\\$&');
      i++;
    }
  }

  // Match end of path or directory separator
  regexStr += '(/|$)';

  return new RegExp(regexStr);
}

/**
 * Parse a single ignore pattern line.
 */
function parsePattern(line: string): IgnorePattern | null {
  // Remove leading/trailing whitespace
  let pattern = line.trim();

  // Skip empty lines and comments
  if (!pattern || pattern.startsWith('#')) {
    return null;
  }

  // Check for negation
  const negated = pattern.startsWith('!');
  if (negated) {
    pattern = pattern.slice(1);
  }

  // Check for directory-only pattern
  const directoryOnly = pattern.endsWith('/');
  if (directoryOnly) {
    pattern = pattern.slice(0, -1);
  }

  // Skip if pattern is empty after processing
  if (!pattern) {
    return null;
  }

  return {
    raw: line.trim(),
    regex: patternToRegex(pattern),
    negated,
    directoryOnly,
  };
}

/**
 * Parse ignore file content into patterns.
 */
function parseIgnoreContent(content: string): readonly IgnorePattern[] {
  return content
    .split('\n')
    .map(parsePattern)
    .filter((p): p is IgnorePattern => p !== null);
}

// =============================================================================
// Default Patterns
// =============================================================================

/**
 * Default patterns to always ignore.
 */
const DEFAULT_IGNORE_PATTERNS = `
# Version control
.git/
.svn/
.hg/

# Dependencies
node_modules/
vendor/
.pnpm-store/

# Build outputs
dist/
build/
out/
.next/
.nuxt/
.output/

# IDE
.idea/
.vscode/
*.swp
*.swo
*~

# OS files
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Cache
.cache/
.parcel-cache/
.turbo/

# Test coverage
coverage/
.nyc_output/

# Temporary
tmp/
temp/
*.tmp
`;

// =============================================================================
// Service Interface
// =============================================================================

export interface IgnoreServiceShape {
  /**
   * Load ignore patterns from a file path.
   * Merges with default patterns.
   */
  readonly loadFromFile: (content: string) => Effect.Effect<void>;

  /**
   * Add patterns programmatically.
   */
  readonly addPatterns: (patterns: readonly string[]) => Effect.Effect<void>;

  /**
   * Clear all patterns (keeps defaults).
   */
  readonly reset: () => Effect.Effect<void>;

  /**
   * Check if a path should be ignored.
   *
   * @param path - Relative path to check (e.g., "src/file.md")
   * @param isDirectory - Whether the path is a directory
   */
  readonly shouldIgnore: (
    path: string,
    isDirectory?: boolean
  ) => Effect.Effect<IgnoreCheckResult>;

  /**
   * Get all current patterns.
   */
  readonly getPatterns: () => Effect.Effect<readonly IgnorePattern[]>;

  /**
   * Get raw pattern strings for passing to Tauri.
   * Returns the original gitignore-style patterns (e.g., "node_modules/", "*.log").
   */
  readonly getRawPatterns: () => Effect.Effect<readonly string[]>;
}

// =============================================================================
// Service Implementation
// =============================================================================

export class IgnoreService extends Effect.Service<IgnoreService>()(
  'tmnl/file-index/IgnoreService',
  {
    effect: Effect.gen(function* () {
      // Parse default patterns
      const defaultPatterns = parseIgnoreContent(DEFAULT_IGNORE_PATTERNS);

      // Mutable pattern store
      const patternsRef = yield* Ref.make<readonly IgnorePattern[]>(
        defaultPatterns
      );

      // --- LOAD FROM FILE ---
      const loadFromFile = (content: string): Effect.Effect<void> =>
        Effect.gen(function* () {
          const userPatterns = parseIgnoreContent(content);

          yield* Ref.update(patternsRef, () => [
            ...defaultPatterns,
            ...userPatterns,
          ]);

          yield* Effect.log(
            `[IgnoreService] Loaded ${userPatterns.length} patterns from file`
          );
        });

      // --- ADD PATTERNS ---
      const addPatterns = (patterns: readonly string[]): Effect.Effect<void> =>
        Effect.gen(function* () {
          const parsed = patterns
            .map(parsePattern)
            .filter((p): p is IgnorePattern => p !== null);

          yield* Ref.update(patternsRef, (current) => [...current, ...parsed]);
        });

      // --- RESET ---
      const reset = (): Effect.Effect<void> =>
        Ref.set(patternsRef, defaultPatterns);

      // --- SHOULD IGNORE ---
      const shouldIgnore = (
        path: string,
        isDirectory: boolean = false
      ): Effect.Effect<IgnoreCheckResult> =>
        Effect.gen(function* () {
          const patterns = yield* Ref.get(patternsRef);

          // Normalize path (remove leading ./ or /)
          let normalizedPath = path.replace(/^\.\//, '').replace(/^\//, '');

          // Track ignore state (patterns are applied in order, negations can flip)
          let ignored = false;
          let matchedPattern: string | undefined;

          for (const pattern of patterns) {
            // Skip directory-only patterns for files
            if (pattern.directoryOnly && !isDirectory) {
              continue;
            }

            if (pattern.regex.test(normalizedPath)) {
              if (pattern.negated) {
                // Negation: un-ignore
                ignored = false;
                matchedPattern = undefined;
              } else {
                // Match: ignore
                ignored = true;
                matchedPattern = pattern.raw;
              }
            }
          }

          return { ignored, matchedPattern };
        });

      // --- GET PATTERNS ---
      const getPatterns = (): Effect.Effect<readonly IgnorePattern[]> =>
        Ref.get(patternsRef);

      // --- GET RAW PATTERNS ---
      const getRawPatterns = (): Effect.Effect<readonly string[]> =>
        Effect.map(Ref.get(patternsRef), (patterns) =>
          patterns.map((p) => p.raw)
        );

      return {
        loadFromFile,
        addPatterns,
        reset,
        shouldIgnore,
        getPatterns,
        getRawPatterns,
      } satisfies IgnoreServiceShape;
    }),
  }
) {}

// =============================================================================
// Layer Exports
// =============================================================================

export const IgnoreServiceLive = IgnoreService.Default;
