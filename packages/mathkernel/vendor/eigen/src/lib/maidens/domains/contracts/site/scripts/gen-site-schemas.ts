import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SiteAgentStateSchema,
  SiteSchema,
  SiteTransitionEventSchema,
  toMermaid,
} from '../ts/site.contract';
import { makeElixirDraft7Schema } from '../../../../core/contracts/json-schema.codegen';

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);
const domainDir = path.resolve(thisDir, '..');
const schemasDir = path.join(domainDir, 'schemas');

const generate = async (): Promise<void> => {
  await mkdir(schemasDir, { recursive: true });

  const siteSchema = makeElixirDraft7Schema(SiteSchema, {
    $id: '/contracts/site/site.schema.json',
    title: 'Site',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/site/ts/site.contract.ts). Canonical site payload contract for TypeScript and Elixir.',
  });

  const transitionSchema = makeElixirDraft7Schema(SiteTransitionEventSchema, {
    $id: '/contracts/site/site_transition.schema.json',
    title: 'SiteTransitionEvent',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/site/ts/site.contract.ts). Canonical transition event contract for TypeScript and Elixir.',
  });

  const jidoAgentStateSchema = makeElixirDraft7Schema(SiteAgentStateSchema, {
    $id: '/contracts/site/site_agent_state.schema.json',
    title: 'SiteAgentState',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/site/ts/site.contract.ts). Canonical Jido agent-state contract for Elixir preflight validation.',
  });

  await writeFile(
    path.join(schemasDir, 'site.schema.json'),
    `${JSON.stringify(siteSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'site_transition.schema.json'),
    `${JSON.stringify(transitionSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'site_agent_state.schema.json'),
    `${JSON.stringify(jidoAgentStateSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(path.join(schemasDir, 'site_transition.mmd'), toMermaid(), 'utf8');

  console.log('Generated schemas:');
  console.log(`- ${path.join(schemasDir, 'site.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'site_transition.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'site_agent_state.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'site_transition.mmd')}`);
};

generate().catch((error) => {
  console.error('Failed to generate schema artifacts:', error);
  process.exitCode = 1;
});
