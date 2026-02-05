/**
 * WorktreeManager Service
 *
 * Effect.Service for git worktree operations.
 * Creates isolated worktrees for safe component editing.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const worktree = yield* WorktreeManager
 *   const path = yield* worktree.create('session-123')
 *   // ... make edits ...
 *   yield* worktree.commit(path, 'Component edits')
 *   yield* worktree.mergeToMain(path)
 *   yield* worktree.remove(path)
 * })
 * ```
 */

import { Context, Effect, Layer, Schema, Option } from 'effect'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'

const execAsync = promisify(exec)

// =============================================================================
// SCHEMAS
// =============================================================================

/**
 * Worktree information
 */
export class WorktreeInfo extends Schema.Class<WorktreeInfo>('WorktreeInfo')({
  /** Absolute path to worktree */
  path: Schema.String,
  /** Git HEAD commit SHA */
  head: Schema.String,
  /** Branch name if any */
  branch: Schema.NullOr(Schema.String),
  /** Whether this is the main worktree */
  isMain: Schema.Boolean,
}) {}

/**
 * Worktree creation options
 */
export class WorktreeCreateOptions extends Schema.Class<WorktreeCreateOptions>('WorktreeCreateOptions')({
  /** Session identifier */
  sessionId: Schema.String,
  /** Base branch to detach from (default: HEAD) */
  baseBranch: Schema.optionalWith(Schema.String, { default: () => 'HEAD' }),
}) {}

// =============================================================================
// ERRORS
// =============================================================================

/**
 * Error during worktree operations
 */
export class WorktreeError extends Schema.TaggedError<WorktreeError>()(
  'WorktreeError',
  {
    message: Schema.String,
    operation: Schema.String,
    cause: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
  }
) {}

// =============================================================================
// SERVICE SHAPE
// =============================================================================

/**
 * WorktreeManager service shape
 */
export interface WorktreeManagerShape {
  /**
   * Create a new detached worktree for editing
   */
  readonly create: (options: WorktreeCreateOptions) => Effect.Effect<string, WorktreeError>

  /**
   * Remove a worktree
   */
  readonly remove: (worktreePath: string) => Effect.Effect<void, WorktreeError>

  /**
   * Stage and commit changes in a worktree
   */
  readonly commit: (
    worktreePath: string,
    message: string
  ) => Effect.Effect<string, WorktreeError>

  /**
   * Merge worktree commit to main branch
   */
  readonly mergeToMain: (worktreePath: string) => Effect.Effect<void, WorktreeError>

  /**
   * List all active worktrees
   */
  readonly listActive: () => Effect.Effect<readonly WorktreeInfo[], WorktreeError>

  /**
   * Get diff of changes in worktree
   */
  readonly getDiff: (worktreePath: string) => Effect.Effect<string, WorktreeError>

  /**
   * Check if worktree has uncommitted changes
   */
  readonly hasChanges: (worktreePath: string) => Effect.Effect<boolean, WorktreeError>
}

// =============================================================================
// SERVICE DEFINITION
// =============================================================================

/**
 * WorktreeManager Service Tag
 */
export class WorktreeManager extends Context.Tag('tmnl/testbed/WorktreeManager')<
  WorktreeManager,
  WorktreeManagerShape
>() {}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Worktree configuration
 */
export interface WorktreeConfigShape {
  /** Base directory for worktrees (relative to repo root) */
  readonly basePath: string
  /** Git repository root path */
  readonly repoRoot: string
}

export class WorktreeConfig extends Context.Tag('tmnl/testbed/WorktreeConfig')<
  WorktreeConfig,
  WorktreeConfigShape
>() {
  static Default = Layer.succeed(this, {
    basePath: '.worktrees',
    repoRoot: process.cwd(),
  })

  static Custom = (config: WorktreeConfigShape) => Layer.succeed(this, config)
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

/**
 * Run a git command and capture output
 */
const runGitCommand = (
  args: readonly string[],
  cwd?: string
): Effect.Effect<string, WorktreeError> =>
  Effect.tryPromise({
    try: async () => {
      const command = `git ${args.join(' ')}`
      const options = cwd ? { cwd } : {}
      const { stdout } = await execAsync(command, options)
      return stdout.trim()
    },
    catch: (e) =>
      new WorktreeError({
        message: `Git command failed: git ${args.join(' ')}`,
        operation: args[0] ?? 'unknown',
        cause: Option.some(e),
      }),
  })

/**
 * Parse worktree list output
 */
const parseWorktreeList = (output: string): readonly WorktreeInfo[] => {
  const worktrees: WorktreeInfo[] = []
  const lines = output.split('\n')

  let current: Partial<{ path: string; head: string; branch: string | null }> = {}

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      if (current.path && current.head !== undefined) {
        worktrees.push(
          new WorktreeInfo({
            path: current.path,
            head: current.head,
            branch: current.branch ?? null,
            isMain: !current.path.includes('.worktrees'),
          })
        )
      }
      current = { path: line.slice(9) }
    } else if (line.startsWith('HEAD ')) {
      current.head = line.slice(5)
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice(7)
    } else if (line === 'detached') {
      current.branch = null
    }
  }

  // Push last worktree
  if (current.path && current.head !== undefined) {
    worktrees.push(
      new WorktreeInfo({
        path: current.path,
        head: current.head,
        branch: current.branch ?? null,
        isMain: !current.path.includes('.worktrees'),
      })
    )
  }

  return worktrees
}

/**
 * Create WorktreeManager implementation
 */
const createWorktreeManagerShape = (
  config: WorktreeConfigShape
): WorktreeManagerShape => ({
  create: (options) =>
    Effect.gen(function* () {
      const worktreePath = path.join(
        config.repoRoot,
        config.basePath,
        `session-${options.sessionId}`
      )

      // Ensure base directory exists
      yield* runGitCommand(['worktree', 'add', '--detach', worktreePath, options.baseBranch])

      return worktreePath
    }),

  remove: (worktreePath) =>
    Effect.gen(function* () {
      yield* runGitCommand(['worktree', 'remove', '--force', worktreePath])
    }),

  commit: (worktreePath, message) =>
    Effect.gen(function* () {
      // Stage all changes
      yield* runGitCommand(['add', '-A'], worktreePath)

      // Commit
      yield* runGitCommand(['commit', '-m', message], worktreePath)

      // Get commit SHA
      const sha = yield* runGitCommand(['rev-parse', 'HEAD'], worktreePath)
      return sha
    }),

  mergeToMain: (worktreePath) =>
    Effect.gen(function* () {
      // Get commit SHA from worktree
      const sha = yield* runGitCommand(['rev-parse', 'HEAD'], worktreePath)

      // Cherry-pick to current branch (main)
      yield* runGitCommand(['cherry-pick', sha])
    }),

  listActive: () =>
    Effect.gen(function* () {
      const output = yield* runGitCommand(['worktree', 'list', '--porcelain'])
      return parseWorktreeList(output)
    }),

  getDiff: (worktreePath) =>
    Effect.gen(function* () {
      const diff = yield* runGitCommand(['diff', 'HEAD'], worktreePath)
      return diff
    }),

  hasChanges: (worktreePath) =>
    Effect.gen(function* () {
      const status = yield* runGitCommand(['status', '--porcelain'], worktreePath)
      return status.length > 0
    }),
})

// =============================================================================
// LAYERS
// =============================================================================

/**
 * WorktreeManager layer requiring config
 */
export const WorktreeManagerLive = Layer.effect(
  WorktreeManager,
  Effect.gen(function* () {
    const config = yield* WorktreeConfig
    return createWorktreeManagerShape(config)
  })
)

/**
 * Full layer with default config
 */
export const WorktreeManagerDefault = WorktreeManagerLive.pipe(
  Layer.provide(WorktreeConfig.Default)
)

// =============================================================================
// EXPORTS
// =============================================================================

export const WorktreeManagerService = {
  Live: WorktreeManagerLive,
  Default: WorktreeManagerDefault,
}
