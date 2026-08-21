/**
 * Consume A0 contracts when present. Never write A0 paths.
 *
 * A0 (#50) owns `assistant/contracts/**` and `tooling/typescript/mantis-assistant/**`.
 * A1 only reads. Missing types are fixtured locally. The controller well can stay empty.
 * Fixture-local contracts are not an empty AG-UI bind.
 */
import type { AssistantRun, ControllerMode } from './types';

export type WellState = 'bound' | 'empty';

export type AguiBind =
  | { readonly kind: 'empty' }
  | { readonly kind: 'local' }
  | { readonly kind: 'http'; readonly runtimeUrl: string };

export interface A0Bridge {
  readonly contracts: WellState | 'fixture-local';
  readonly controller: WellState;
  readonly agui: AguiBind;
  readonly schemaIds: readonly string[];
  readonly note: string;
}

export function resolveAguiBind(input: {
  readonly runtimeUrl: string;
  readonly copilotKitPresent: boolean;
  readonly a0MastraAdapterPresent: boolean;
}): AguiBind {
  const runtimeUrl = input.runtimeUrl.trim();
  if (runtimeUrl.length > 0) {
    return { kind: 'http', runtimeUrl };
  }
  if (input.copilotKitPresent || input.a0MastraAdapterPresent) {
    return { kind: 'local' };
  }
  return { kind: 'empty' };
}

const assistantMastra = (bind: AguiBind): AssistantRun['mastra'] => {
  switch (bind.kind) {
    case 'local':
    case 'http':
      return 'bound';
    case 'empty':
      return 'empty-well';
    default: {
      const _exhaustive: never = bind;
      return _exhaustive;
    }
  }
};

const A0_SCHEMA_GLOB = import.meta.glob('../../../contracts/**/*.json', {
  eager: true,
}) as Record<string, { default?: unknown } | unknown>;

const A0_TS_GLOB = import.meta.glob(
  '../../../../tooling/typescript/mantis-assistant/src/**/*.{ts,json}',
  { eager: true, query: '?raw' },
) as Record<string, unknown>;

const schemaIds = Object.keys(A0_SCHEMA_GLOB);
const toolingIds = Object.keys(A0_TS_GLOB);
const contractsPresent = schemaIds.length > 0;
const toolingPresent = toolingIds.length > 0;

const envAgui = typeof import.meta.env?.VITE_A0_AGUI_URL === 'string'
  ? import.meta.env.VITE_A0_AGUI_URL.trim()
  : '';

const copilotKitPresent = true;
/** Consume `MastraAgent.getLocalAgents` by import when A0 publishes it. */
const a0MastraAdapterPresent = false;

export const a0Bridge: A0Bridge = {
  contracts: contractsPresent ? 'bound' : 'fixture-local',
  controller: toolingPresent ? 'bound' : 'empty',
  agui: resolveAguiBind({
    runtimeUrl: envAgui,
    copilotKitPresent,
    a0MastraAdapterPresent,
  }),
  schemaIds,
  note: contractsPresent
    ? 'A0 JSON contracts present. A1 consumes without rewriting them.'
    : 'A0 contracts absent. A1 uses local fixtures. The controller well stays empty. AG-UI binds locally when CopilotKit is present.',
};

export const emptyAssistantRun = (mode: ControllerMode): AssistantRun => ({
  kind: 'AssistantRun',
  runId: 'a1-local-empty-well',
  mode,
  packageVersions: {
    app: '0.1.0',
    copilotkit: '1.68.3',
  },
  modelId: null,
  workflowVersion: null,
  memoryRecordId: null,
  mastra: assistantMastra(a0Bridge.agui),
});

export const assertNoDeviceCommand = (toolName: string): void => {
  const banned = new Set(['device-command', 'admin', 'actuation-command', 'specimen-insert']);
  if (banned.has(toolName) || toolName.startsWith('device.')) {
    throw new Error(`fail-closed: tool ${toolName} is never visible to the keeper PWA`);
  }
};
