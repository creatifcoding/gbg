/**
 * Interactive shell tool — PTY-backed terminal sessions.
 *
 * Uses defineTool() declarative registration.
 *
 * @module harness/tools/shell-tool
 */

import { Effect } from 'effect'
import { defineTool } from './registry'
import {
  INTERACTIVE_SHELL_TOOL_NAME,
  interactiveShellToolParameters,
  executeInteractiveShell,
  InteractiveShellService,
} from '../interactive-shell'

export const shellTool = defineTool({
  name: INTERACTIVE_SHELL_TOOL_NAME,
  description:
    'Start and interact with interactive terminal sessions. Spawn shells, send input, read output, and kill sessions. Supports long-running processes, interactive programs (vim, htop, etc.), and multi-session management.',
  parameters: interactiveShellToolParameters as any,

  requires: {
    shell: InteractiveShellService,
  },

  execute: async (toolCallId, params, { shell }, signal, onUpdate) => {
    return Effect.runPromise(
      executeInteractiveShell(toolCallId, params, signal, onUpdate).pipe(
        Effect.provideService(InteractiveShellService, shell),
      ),
    )
  },
})
