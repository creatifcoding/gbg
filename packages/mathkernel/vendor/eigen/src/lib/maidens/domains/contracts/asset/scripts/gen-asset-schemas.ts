import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AssetAgentStateSchema,
  AssetSchema,
  AssetTransitionEventSchema,
  toMermaid,
} from '../ts/asset.contract';
import { makeElixirDraft7Schema } from '../../../../core/contracts/json-schema.codegen';

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);
const domainDir = path.resolve(thisDir, '..');
const schemasDir = path.join(domainDir, 'schemas');

const generate = async (): Promise<void> => {
  await mkdir(schemasDir, { recursive: true });

  const assetSchema = makeElixirDraft7Schema(AssetSchema, {
    $id: '/contracts/asset/asset.schema.json',
    title: 'Asset',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/asset/ts/asset.contract.ts). Canonical polymorphic asset payload contract for TypeScript and Elixir.',
  });

  const transitionSchema = makeElixirDraft7Schema(AssetTransitionEventSchema, {
    $id: '/contracts/asset/asset_transition.schema.json',
    title: 'AssetTransitionEvent',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/asset/ts/asset.contract.ts). Canonical transition event contract for TypeScript and Elixir.',
  });

  const jidoAgentStateSchema = makeElixirDraft7Schema(AssetAgentStateSchema, {
    $id: '/contracts/asset/asset_agent_state.schema.json',
    title: 'AssetAgentState',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/asset/ts/asset.contract.ts). Canonical Jido agent-state contract for Elixir preflight validation.',
  });

  await writeFile(
    path.join(schemasDir, 'asset.schema.json'),
    `${JSON.stringify(assetSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'asset_transition.schema.json'),
    `${JSON.stringify(transitionSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'asset_agent_state.schema.json'),
    `${JSON.stringify(jidoAgentStateSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(path.join(schemasDir, 'asset_transition.mmd'), toMermaid(), 'utf8');

  console.log('Generated schemas:');
  console.log(`- ${path.join(schemasDir, 'asset.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'asset_transition.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'asset_agent_state.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'asset_transition.mmd')}`);
};

generate().catch((error) => {
  console.error('Failed to generate schema artifacts:', error);
  process.exitCode = 1;
});
