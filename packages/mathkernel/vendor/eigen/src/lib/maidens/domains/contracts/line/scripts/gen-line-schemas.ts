import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LineAgentStateSchema,
  LineSchema,
  LineTransitionEventSchema,
  toMermaid,
} from '../ts/line.contract';
import { makeElixirDraft7Schema } from '../../../../core/contracts/json-schema.codegen';

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);
const lineDomainDir = path.resolve(thisDir, '..');
const schemasDir = path.join(lineDomainDir, 'schemas');

const generate = async (): Promise<void> => {
  await mkdir(schemasDir, { recursive: true });

  const lineSchema = makeElixirDraft7Schema(LineSchema, {
    $id: '/contracts/line/line.schema.json',
    title: 'Line',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/line/ts/line.contract.ts). Canonical line payload contract for TypeScript and Elixir.',
  });

  const transitionSchema = makeElixirDraft7Schema(LineTransitionEventSchema, {
    $id: '/contracts/line/line_transition.schema.json',
    title: 'LineTransitionEvent',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/line/ts/line.contract.ts). Canonical transition event contract for TypeScript and Elixir.',
  });

  const jidoAgentStateSchema = makeElixirDraft7Schema(LineAgentStateSchema, {
    $id: '/contracts/line/line_agent_state.schema.json',
    title: 'LineAgentState',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/line/ts/line.contract.ts). Canonical Jido agent-state contract for Elixir preflight validation.',
  });

  await writeFile(
    path.join(schemasDir, 'line.schema.json'),
    `${JSON.stringify(lineSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'line_transition.schema.json'),
    `${JSON.stringify(transitionSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'line_agent_state.schema.json'),
    `${JSON.stringify(jidoAgentStateSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(path.join(schemasDir, 'line_transition.mmd'), toMermaid(), 'utf8');

  console.log('Generated schemas:');
  console.log(`- ${path.join(schemasDir, 'line.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'line_transition.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'line_agent_state.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'line_transition.mmd')}`);
};

generate().catch((error) => {
  console.error('Failed to generate schema artifacts:', error);
  process.exitCode = 1;
});
