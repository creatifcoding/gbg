import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EquipmentStateAgentStateSchema,
  EquipmentStateSchema,
  EquipmentStateTransitionEventSchema,
  toMermaid,
} from '../ts/equipment-state.contract';
import { makeElixirDraft7Schema } from '../../../../core/contracts/json-schema.codegen';

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);
const domainDir = path.resolve(thisDir, '..');
const schemasDir = path.join(domainDir, 'schemas');

const generate = async (): Promise<void> => {
  await mkdir(schemasDir, { recursive: true });

  const equipmentStateSchema = makeElixirDraft7Schema(EquipmentStateSchema, {
    $id: '/contracts/equipment-state/equipment_state.schema.json',
    title: 'EquipmentState',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/equipment-state/ts/equipment-state.contract.ts). Canonical equipment-state payload contract for TypeScript and Elixir.',
  });

  const transitionSchema = makeElixirDraft7Schema(EquipmentStateTransitionEventSchema, {
    $id: '/contracts/equipment-state/equipment_state_transition.schema.json',
    title: 'EquipmentStateTransitionEvent',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/equipment-state/ts/equipment-state.contract.ts). Canonical transition event contract for TypeScript and Elixir.',
  });

  const jidoAgentStateSchema = makeElixirDraft7Schema(EquipmentStateAgentStateSchema, {
    $id: '/contracts/equipment-state/equipment_state_agent_state.schema.json',
    title: 'EquipmentStateAgentState',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/equipment-state/ts/equipment-state.contract.ts). Canonical Jido agent-state contract for Elixir preflight validation.',
  });

  await writeFile(
    path.join(schemasDir, 'equipment_state.schema.json'),
    `${JSON.stringify(equipmentStateSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'equipment_state_transition.schema.json'),
    `${JSON.stringify(transitionSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'equipment_state_agent_state.schema.json'),
    `${JSON.stringify(jidoAgentStateSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'equipment_state_transition.mmd'),
    toMermaid(),
    'utf8'
  );

  console.log('Generated schemas:');
  console.log(`- ${path.join(schemasDir, 'equipment_state.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'equipment_state_transition.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'equipment_state_agent_state.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'equipment_state_transition.mmd')}`);
};

generate().catch((error) => {
  console.error('Failed to generate schema artifacts:', error);
  process.exitCode = 1;
});
