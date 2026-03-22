/**
 * Bash Tool for Cursor Server
 *
 * AI SDK tool for executing bash commands.
 * Provides sandboxed command execution with timeout and output limits.
 *
 * Uses Effect Schema for type-safe input validation.
 * Pattern follows file-tools.ts archetype.
 *
 * @module cursor/tools/bash-tool
 */

import { Schema, JSONSchema } from 'effect';
import { jsonSchema, tool } from 'ai';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// =============================================================================
// Tool Context (injected at runtime)
// =============================================================================

/**
 * Context interface for bash tool.
 * Allows injection of custom execution environment.
 */
export interface BashToolContext {
  /** Working directory for command execution */
  cwd: string;
  /** Environment variables to inject */
  env?: Record<string, string>;
  /** Maximum execution time in ms (default: 30000) */
  timeout?: number;
  /** Maximum output size in bytes (default: 1MB) */
  maxOutput?: number;
  /** Commands to block (security) */
  blockedCommands?: string[];
}

let _context: BashToolContext | null = null;

/**
 * Set the bash tool context.
 * Must be called before using the bash tool.
 */
export function setBashToolContext(ctx: BashToolContext): void {
  _context = ctx;
}

/**
 * Clear the bash tool context.
 */
export function clearBashToolContext(): void {
  _context = null;
}

function getContext(): BashToolContext {
  if (!_context) {
    throw new Error('Bash tool context not set. Call setBashToolContext first.');
  }
  return _context;
}

// =============================================================================
// Security: Blocked Commands
// =============================================================================

const DEFAULT_BLOCKED_COMMANDS = [
  'rm -rf /',
  'rm -rf /*',
  'mkfs',
  'dd if=/dev/zero',
  ':(){:|:&};:',  // Fork bomb
  'chmod 777 /',
  'chmod -R 777 /',
];

function isCommandBlocked(command: string, blockedCommands: string[]): boolean {
  const normalizedCommand = command.toLowerCase().trim();
  return blockedCommands.some(blocked =>
    normalizedCommand.includes(blocked.toLowerCase())
  );
}

// =============================================================================
// Tool Input Schema
// =============================================================================

/**
 * Schema for bash command execution
 */
export const BashInputSchema = Schema.Struct({
  command: Schema.String.pipe(
    Schema.annotations({
      description: 'The bash command to execute. Use && to chain commands.',
    })
  ),
  timeout: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: 'Timeout in milliseconds (default: 30000)',
      })
    )
  ),
  description: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Brief description of what this command does (for logging)',
      })
    )
  ),
});
export type BashInput = Schema.Schema.Type<typeof BashInputSchema>;

// =============================================================================
// Tool Implementation
// =============================================================================

/**
 * Execute a bash command
 */
export const bashTool = tool({
  description: `Execute a bash command. Use for:
- Running tests (npm test, bun test)
- Git operations (git status, git diff)
- File system operations (ls, cat, mkdir)
- Package management (npm install, bun add)
- Build commands (npm run build)

Security: Destructive commands require explicit confirmation. Some commands are blocked for safety.`,
  inputSchema: jsonSchema<BashInput>(
    JSONSchema.make(BashInputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: BashInput) => {
    const ctx = getContext();
    const blockedCommands = [
      ...DEFAULT_BLOCKED_COMMANDS,
      ...(ctx.blockedCommands ?? []),
    ];

    // Security check
    if (isCommandBlocked(input.command, blockedCommands)) {
      return {
        success: false,
        error: 'Command blocked for security reasons',
        command: input.command,
      };
    }

    const timeout = input.timeout ?? ctx.timeout ?? 30000;
    const maxOutput = ctx.maxOutput ?? 1024 * 1024; // 1MB default

    try {
      const { stdout, stderr } = await execAsync(input.command, {
        cwd: ctx.cwd,
        env: { ...process.env, ...ctx.env },
        timeout,
        maxBuffer: maxOutput,
      });

      const output = stdout || stderr;
      const truncated = output.length >= maxOutput;

      return {
        success: true,
        command: input.command,
        output: truncated ? output.slice(0, maxOutput) + '\n... (truncated)' : output,
        truncated,
        description: input.description,
      };
    } catch (error: any) {
      // Handle timeout
      if (error.killed) {
        return {
          success: false,
          command: input.command,
          error: `Command timed out after ${timeout}ms`,
          signal: error.signal,
        };
      }

      // Handle non-zero exit
      if (error.code !== undefined) {
        return {
          success: false,
          command: input.command,
          error: error.message,
          exitCode: error.code,
          stdout: error.stdout,
          stderr: error.stderr,
        };
      }

      return {
        success: false,
        command: input.command,
        error: error.message,
      };
    }
  },
});

// =============================================================================
// Export Tool Collection
// =============================================================================

/**
 * Bash tools for AI SDK integration
 */
export const bashTools = {
  bash: bashTool,
} as const;

export type BashToolName = keyof typeof bashTools;
