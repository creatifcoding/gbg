import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DeviceAgentStateSchema,
  DeviceSchema,
  DeviceTransitionEventSchema,
  toMermaid,
} from '../ts/device.contract';
import { makeElixirDraft7Schema } from '../../../../core/contracts/json-schema.codegen';

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);
const domainDir = path.resolve(thisDir, '..');
const schemasDir = path.join(domainDir, 'schemas');

const generate = async (): Promise<void> => {
  await mkdir(schemasDir, { recursive: true });

  const deviceSchema = makeElixirDraft7Schema(DeviceSchema, {
    $id: '/contracts/device/device.schema.json',
    title: 'Device',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/device/ts/device.contract.ts). Canonical device payload contract for TypeScript and Elixir.',
  });

  const transitionSchema = makeElixirDraft7Schema(DeviceTransitionEventSchema, {
    $id: '/contracts/device/device_transition.schema.json',
    title: 'DeviceTransitionEvent',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/device/ts/device.contract.ts). Canonical transition event contract for TypeScript and Elixir.',
  });

  const jidoAgentStateSchema = makeElixirDraft7Schema(DeviceAgentStateSchema, {
    $id: '/contracts/device/device_agent_state.schema.json',
    title: 'DeviceAgentState',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/device/ts/device.contract.ts). Canonical Jido agent-state contract for Elixir preflight validation.',
  });

  await writeFile(
    path.join(schemasDir, 'device.schema.json'),
    `${JSON.stringify(deviceSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'device_transition.schema.json'),
    `${JSON.stringify(transitionSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'device_agent_state.schema.json'),
    `${JSON.stringify(jidoAgentStateSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(path.join(schemasDir, 'device_transition.mmd'), toMermaid(), 'utf8');

  console.log('Generated schemas:');
  console.log(`- ${path.join(schemasDir, 'device.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'device_transition.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'device_agent_state.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'device_transition.mmd')}`);
};

generate().catch((error) => {
  console.error('Failed to generate schema artifacts:', error);
  process.exitCode = 1;
});
