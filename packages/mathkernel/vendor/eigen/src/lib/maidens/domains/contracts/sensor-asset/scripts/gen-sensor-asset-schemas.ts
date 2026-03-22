import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SensorAssetAgentStateSchema,
  SensorAssetSchema,
  SensorAssetTransitionEventSchema,
  toMermaid,
} from '../ts/sensor-asset.contract';
import { makeElixirDraft7Schema } from '../../../../core/contracts/json-schema.codegen';

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);
const domainDir = path.resolve(thisDir, '..');
const schemasDir = path.join(domainDir, 'schemas');

const generate = async (): Promise<void> => {
  await mkdir(schemasDir, { recursive: true });

  const sensorAssetSchema = makeElixirDraft7Schema(SensorAssetSchema, {
    $id: '/contracts/sensor-asset/sensor_asset.schema.json',
    title: 'SensorAsset',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/sensor-asset/ts/sensor-asset.contract.ts). Canonical sensor-asset payload contract for TypeScript and Elixir.',
  });

  const transitionSchema = makeElixirDraft7Schema(SensorAssetTransitionEventSchema, {
    $id: '/contracts/sensor-asset/sensor_asset_transition.schema.json',
    title: 'SensorAssetTransitionEvent',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/sensor-asset/ts/sensor-asset.contract.ts). Canonical transition event contract for TypeScript and Elixir.',
  });

  const jidoAgentStateSchema = makeElixirDraft7Schema(SensorAssetAgentStateSchema, {
    $id: '/contracts/sensor-asset/sensor_asset_agent_state.schema.json',
    title: 'SensorAssetAgentState',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/sensor-asset/ts/sensor-asset.contract.ts). Canonical Jido agent-state contract for Elixir preflight validation.',
  });

  await writeFile(
    path.join(schemasDir, 'sensor_asset.schema.json'),
    `${JSON.stringify(sensorAssetSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'sensor_asset_transition.schema.json'),
    `${JSON.stringify(transitionSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'sensor_asset_agent_state.schema.json'),
    `${JSON.stringify(jidoAgentStateSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(path.join(schemasDir, 'sensor_asset_transition.mmd'), toMermaid(), 'utf8');

  console.log('Generated schemas:');
  console.log(`- ${path.join(schemasDir, 'sensor_asset.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'sensor_asset_transition.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'sensor_asset_agent_state.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'sensor_asset_transition.mmd')}`);
};

generate().catch((error) => {
  console.error('Failed to generate schema artifacts:', error);
  process.exitCode = 1;
});
