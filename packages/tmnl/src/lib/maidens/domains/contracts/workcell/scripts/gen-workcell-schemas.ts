import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  WorkCellAgentStateSchema,
  WorkCellSchema,
  WorkCellTransitionEventSchema,
  toMermaid,
} from '../ts/workcell.contract';
import { makeElixirDraft7Schema } from '../../../../core/contracts/json-schema.codegen';

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);
const domainDir = path.resolve(thisDir, '..');
const schemasDir = path.join(domainDir, 'schemas');

const generate = async (): Promise<void> => {
  await mkdir(schemasDir, { recursive: true });

  const workcellSchema = makeElixirDraft7Schema(WorkCellSchema, {
    $id: '/contracts/workcell/workcell.schema.json',
    title: 'WorkCell',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/workcell/ts/workcell.contract.ts). Canonical workcell payload contract for TypeScript and Elixir.',
  });

  const transitionSchema = makeElixirDraft7Schema(WorkCellTransitionEventSchema, {
    $id: '/contracts/workcell/workcell_transition.schema.json',
    title: 'WorkCellTransitionEvent',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/workcell/ts/workcell.contract.ts). Canonical transition event contract for TypeScript and Elixir.',
  });

  const jidoAgentStateSchema = makeElixirDraft7Schema(WorkCellAgentStateSchema, {
    $id: '/contracts/workcell/workcell_agent_state.schema.json',
    title: 'WorkCellAgentState',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/workcell/ts/workcell.contract.ts). Canonical Jido agent-state contract for Elixir preflight validation.',
  });

  await writeFile(
    path.join(schemasDir, 'workcell.schema.json'),
    `${JSON.stringify(workcellSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'workcell_transition.schema.json'),
    `${JSON.stringify(transitionSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'workcell_agent_state.schema.json'),
    `${JSON.stringify(jidoAgentStateSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'workcell_transition.mmd'),
    toMermaid(),
    'utf8'
  );

  console.log('Generated schemas:');
  console.log(`- ${path.join(schemasDir, 'workcell.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'workcell_transition.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'workcell_agent_state.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'workcell_transition.mmd')}`);
};

generate().catch((error) => {
  console.error('Failed to generate schema artifacts:', error);
  process.exitCode = 1;
});
