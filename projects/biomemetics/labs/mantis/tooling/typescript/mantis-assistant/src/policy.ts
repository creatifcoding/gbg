import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { ControllerMode, PolicyDecision, PolicyInput, ToolCategory } from './types.ts';
import { assistantRoot } from './paths.ts';

export interface ToolCategoryModePolicy {
  readonly unknownTool: 'deny';
  readonly absoluteDenyCategories: readonly ToolCategory[];
  readonly absoluteDenyToolIds: readonly string[];
  readonly modes: Record<
    ControllerMode,
    {
      readonly allow: readonly ToolCategory[];
      readonly ask: readonly ToolCategory[];
      readonly deny: readonly ToolCategory[];
    }
  >;
}

export interface ModeAuthorityPolicy {
  readonly clientMaySelect: {
    readonly resource: false;
    readonly mode: false;
    readonly agent: false;
    readonly tool: false;
  };
  readonly modes: Record<ControllerMode, { readonly rank: number }>;
}

const loadJson = <T>(relative: string): T =>
  JSON.parse(readFileSync(path.join(assistantRoot, relative), 'utf8')) as T;

export const loadToolPolicy = (): ToolCategoryModePolicy =>
  loadJson('policies/tool-category-mode.json');

export const loadModeAuthority = (): ModeAuthorityPolicy =>
  loadJson('policies/mode-authority.json');

const isCategory = (value: string): value is ToolCategory =>
  value === 'read-public' ||
  value === 'read-private' ||
  value === 'draft-local' ||
  value === 'external-write' ||
  value === 'device-intent' ||
  value === 'device-command' ||
  value === 'admin';

/**
 * Deny is absolute. Unknown tools deny. Mode allow never overrides deny.
 */
export const resolveToolPolicy = (
  input: PolicyInput,
  policy: ToolCategoryModePolicy = loadToolPolicy(),
): PolicyDecision => {
  if (input.perToolDeny === true) return 'deny';
  if (policy.absoluteDenyToolIds.includes(input.toolId)) return 'deny';
  if (input.category === 'unknown' || !isCategory(input.category)) return 'deny';
  if (policy.absoluteDenyCategories.includes(input.category)) return 'deny';
  const modePolicy = policy.modes[input.mode];
  if (modePolicy.deny.includes(input.category)) return 'deny';
  if (modePolicy.ask.includes(input.category)) return 'ask';
  if (modePolicy.allow.includes(input.category)) return 'allow';
  return 'deny';
};

export const canSwitchMode = (
  from: ControllerMode,
  to: ControllerMode,
  hostAuthorized: boolean,
  authority: ModeAuthorityPolicy = loadModeAuthority(),
): boolean => {
  if (from === to) return true;
  if (authority.modes[to].rank > authority.modes[from].rank && !hostAuthorized) {
    return false;
  }
  return hostAuthorized || authority.modes[to].rank <= authority.modes[from].rank;
};

export const knownToolCategory = (
  toolId: string,
  catalog: ReadonlyMap<string, ToolCategory>,
): ToolCategory | 'unknown' => catalog.get(toolId) ?? 'unknown';
