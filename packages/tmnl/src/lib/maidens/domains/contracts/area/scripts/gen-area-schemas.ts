import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AreaAgentStateSchema,
  AreaSchema,
  AreaTransitionEventSchema,
  toMermaid,
} from '../ts/area.contract';
import { makeElixirDraft7Schema } from '../../../../core/contracts/json-schema.codegen';

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);
const areaDomainDir = path.resolve(thisDir, '..');
const schemasDir = path.join(areaDomainDir, 'schemas');

const generate = async (): Promise<void> => {
  await mkdir(schemasDir, { recursive: true });

  const areaSchema = makeElixirDraft7Schema(AreaSchema, {
    $id: '/contracts/area/area.schema.json',
    title: 'Area',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/area/ts/area.contract.ts). Canonical area payload contract for TypeScript and Elixir.',
  });

  const transitionSchema = makeElixirDraft7Schema(AreaTransitionEventSchema, {
    $id: '/contracts/area/area_transition.schema.json',
    title: 'AreaTransitionEvent',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/area/ts/area.contract.ts). Canonical transition event contract for TypeScript and Elixir.',
  });

  const jidoAgentStateSchema = makeElixirDraft7Schema(AreaAgentStateSchema, {
    $id: '/contracts/area/area_agent_state.schema.json',
    title: 'AreaAgentState',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/area/ts/area.contract.ts). Canonical Jido agent-state contract for Elixir preflight validation.',
  });

  await writeFile(
    path.join(schemasDir, 'area.schema.json'),
    `${JSON.stringify(areaSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'area_transition.schema.json'),
    `${JSON.stringify(transitionSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'area_agent_state.schema.json'),
    `${JSON.stringify(jidoAgentStateSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(path.join(schemasDir, 'area_transition.mmd'), toMermaid(), 'utf8');

  console.log('Generated schemas:');
  console.log(`- ${path.join(schemasDir, 'area.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'area_transition.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'area_agent_state.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'area_transition.mmd')}`);
};

generate().catch((error) => {
  console.error('Failed to generate schema artifacts:', error);
  process.exitCode = 1;
});
