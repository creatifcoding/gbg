/**
 * SDK built-in tools — read, bash, edit, write, grep, find, ls.
 *
 * Pure leaf: depends only on AgentHarnessConfig (CWD + timeout).
 *
 * @module harness/tools/sdk-tools
 */

import {
  createReadTool,
  createBashTool,
  createEditTool,
  createWriteTool,
  createGrepTool,
  createFindTool,
  createLsTool,
} from '@mariozechner/pi-coding-agent'
import type { AgentHarnessConfig } from '@/lib/agents/AgentHarnessConfig'
import * as path from 'node:path'

export function createSdkTools(config: AgentHarnessConfig) {
  const cwd = path.resolve(config.cwd)
  return [
    createReadTool(cwd),
    createBashTool(cwd, { timeout: config.bashTimeoutMs }),
    createEditTool(cwd),
    createWriteTool(cwd),
    createGrepTool(cwd),
    createFindTool(cwd),
    createLsTool(cwd),
  ]
}
