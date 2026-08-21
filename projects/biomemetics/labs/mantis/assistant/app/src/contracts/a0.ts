/**
 * Consume A0 contracts when present. Never write A0 paths.
 *
 * A0 (#50) owns `assistant/contracts/**` and `tooling/typescript/mantis-assistant/**`.
 * A1 only reads. Missing types are fixtured locally; Mastra/controller wells stay empty.
 */
import type { AssistantRun, ControllerMode } from './types';

export type WellState = 'bound' | 'empty';

export interface A0Bridge {
  readonly contracts: WellState | 'fixture-local';
  readonly controller: WellState;
  readonly mastra: WellState;
  readonly aguiUrl: string | null;
  readonly schemaIds: readonly string[];
  readonly note: string;
}

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

export const a0Bridge: A0Bridge = {
  contracts: contractsPresent ? 'bound' : 'fixture-local',
  controller: toolingPresent ? 'bound' : 'empty',
  mastra: envAgui || toolingPresent ? 'bound' : 'empty',
  aguiUrl: envAgui.length > 0 ? envAgui : null,
  schemaIds,
  note: contractsPresent
    ? 'A0 JSON contracts present; A1 consumes without rewriting them.'
    : 'A0 contracts absent. A1 uses local fixtures. Mastra/controller wells stay empty.',
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
  mastra: a0Bridge.mastra === 'bound' ? 'bound' : 'empty-well',
});

export const assertNoDeviceCommand = (toolName: string): void => {
  const banned = new Set(['device-command', 'admin', 'actuation-command', 'specimen-insert']);
  if (banned.has(toolName) || toolName.startsWith('device.')) {
    throw new Error(`fail-closed: tool ${toolName} is never visible to the keeper PWA`);
  }
};
