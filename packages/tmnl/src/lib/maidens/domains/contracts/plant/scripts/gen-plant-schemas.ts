import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PlantAgentStateSchema,
  PlantSchema,
  PlantTransitionEventSchema,
  toMermaid,
} from '../ts/plant.contract';
import { makeElixirDraft7Schema } from '../../../../core/contracts/json-schema.codegen';

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);
const domainDir = path.resolve(thisDir, '..');
const schemasDir = path.join(domainDir, 'schemas');

const generate = async (): Promise<void> => {
  await mkdir(schemasDir, { recursive: true });

  const plantSchema = makeElixirDraft7Schema(PlantSchema, {
    $id: '/contracts/plant/plant.schema.json',
    title: 'Plant',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/plant/ts/plant.contract.ts). Canonical plant payload contract for TypeScript and Elixir.',
  });

  const transitionSchema = makeElixirDraft7Schema(PlantTransitionEventSchema, {
    $id: '/contracts/plant/plant_transition.schema.json',
    title: 'PlantTransitionEvent',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/plant/ts/plant.contract.ts). Canonical transition event contract for TypeScript and Elixir.',
  });

  const jidoAgentStateSchema = makeElixirDraft7Schema(PlantAgentStateSchema, {
    $id: '/contracts/plant/plant_agent_state.schema.json',
    title: 'PlantAgentState',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/plant/ts/plant.contract.ts). Canonical Jido agent-state contract for Elixir preflight validation.',
  });

  await writeFile(
    path.join(schemasDir, 'plant.schema.json'),
    `${JSON.stringify(plantSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'plant_transition.schema.json'),
    `${JSON.stringify(transitionSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'plant_agent_state.schema.json'),
    `${JSON.stringify(jidoAgentStateSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(path.join(schemasDir, 'plant_transition.mmd'), toMermaid(), 'utf8');

  console.log('Generated schemas:');
  console.log(`- ${path.join(schemasDir, 'plant.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'plant_transition.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'plant_agent_state.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'plant_transition.mmd')}`);
};

generate().catch((error) => {
  console.error('Failed to generate schema artifacts:', error);
  process.exitCode = 1;
});
