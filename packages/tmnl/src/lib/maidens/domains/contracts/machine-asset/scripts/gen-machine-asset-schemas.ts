import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MachineAssetAgentStateSchema,
  MachineAssetSchema,
  MachineAssetTransitionEventSchema,
  toMermaid,
} from '../ts/machine-asset.contract';
import { makeElixirDraft7Schema } from '../../../../core/contracts/json-schema.codegen';

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);
const domainDir = path.resolve(thisDir, '..');
const schemasDir = path.join(domainDir, 'schemas');

const generate = async (): Promise<void> => {
  await mkdir(schemasDir, { recursive: true });

  const machineAssetSchema = makeElixirDraft7Schema(MachineAssetSchema, {
    $id: '/contracts/machine-asset/machine_asset.schema.json',
    title: 'MachineAsset',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/machine-asset/ts/machine-asset.contract.ts). Canonical machine-asset payload contract for TypeScript and Elixir.',
  });

  const transitionSchema = makeElixirDraft7Schema(MachineAssetTransitionEventSchema, {
    $id: '/contracts/machine-asset/machine_asset_transition.schema.json',
    title: 'MachineAssetTransitionEvent',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/machine-asset/ts/machine-asset.contract.ts). Canonical transition event contract for TypeScript and Elixir.',
  });

  const jidoAgentStateSchema = makeElixirDraft7Schema(MachineAssetAgentStateSchema, {
    $id: '/contracts/machine-asset/machine_asset_agent_state.schema.json',
    title: 'MachineAssetAgentState',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/machine-asset/ts/machine-asset.contract.ts). Canonical Jido agent-state contract for Elixir preflight validation.',
  });

  await writeFile(
    path.join(schemasDir, 'machine_asset.schema.json'),
    `${JSON.stringify(machineAssetSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'machine_asset_transition.schema.json'),
    `${JSON.stringify(transitionSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'machine_asset_agent_state.schema.json'),
    `${JSON.stringify(jidoAgentStateSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'machine_asset_transition.mmd'),
    toMermaid(),
    'utf8'
  );

  console.log('Generated schemas:');
  console.log(`- ${path.join(schemasDir, 'machine_asset.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'machine_asset_transition.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'machine_asset_agent_state.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'machine_asset_transition.mmd')}`);
};

generate().catch((error) => {
  console.error('Failed to generate schema artifacts:', error);
  process.exitCode = 1;
});
