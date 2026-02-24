import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EnterpriseAgentStateSchema,
  EnterpriseSchema,
  EnterpriseTransitionEventSchema,
  toMermaid,
} from '../ts/enterprise.contract';
import { makeElixirDraft7Schema } from '../../../../core/contracts/json-schema.codegen';

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);
const domainDir = path.resolve(thisDir, '..');
const schemasDir = path.join(domainDir, 'schemas');

const generate = async (): Promise<void> => {
  await mkdir(schemasDir, { recursive: true });

  const enterpriseSchema = makeElixirDraft7Schema(EnterpriseSchema, {
    $id: '/contracts/enterprise/enterprise.schema.json',
    title: 'Enterprise',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/enterprise/ts/enterprise.contract.ts). Canonical enterprise payload contract for TypeScript and Elixir.',
  });

  const transitionSchema = makeElixirDraft7Schema(EnterpriseTransitionEventSchema, {
    $id: '/contracts/enterprise/enterprise_transition.schema.json',
    title: 'EnterpriseTransitionEvent',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/enterprise/ts/enterprise.contract.ts). Canonical transition event contract for TypeScript and Elixir.',
  });

  const jidoAgentStateSchema = makeElixirDraft7Schema(EnterpriseAgentStateSchema, {
    $id: '/contracts/enterprise/enterprise_agent_state.schema.json',
    title: 'EnterpriseAgentState',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/enterprise/ts/enterprise.contract.ts). Canonical Jido agent-state contract for Elixir preflight validation.',
  });

  await writeFile(
    path.join(schemasDir, 'enterprise.schema.json'),
    `${JSON.stringify(enterpriseSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'enterprise_transition.schema.json'),
    `${JSON.stringify(transitionSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'enterprise_agent_state.schema.json'),
    `${JSON.stringify(jidoAgentStateSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'enterprise_transition.mmd'),
    toMermaid(),
    'utf8'
  );

  console.log('Generated schemas:');
  console.log(`- ${path.join(schemasDir, 'enterprise.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'enterprise_transition.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'enterprise_agent_state.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'enterprise_transition.mmd')}`);
};

generate().catch((error) => {
  console.error('Failed to generate schema artifacts:', error);
  process.exitCode = 1;
});
