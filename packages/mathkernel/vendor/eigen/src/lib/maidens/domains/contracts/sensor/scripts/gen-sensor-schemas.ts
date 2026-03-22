import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SensorAgentStateSchema,
  SensorSchema,
  SensorTransitionEventSchema,
  toMermaid,
} from '../ts/sensor.contract';
import { makeElixirDraft7Schema } from '../../../../core/contracts/json-schema.codegen';

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);
const domainDir = path.resolve(thisDir, '..');
const schemasDir = path.join(domainDir, 'schemas');

const generate = async (): Promise<void> => {
  await mkdir(schemasDir, { recursive: true });

  const sensorSchema = makeElixirDraft7Schema(SensorSchema, {
    $id: '/contracts/sensor/sensor.schema.json',
    title: 'Sensor',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/sensor/ts/sensor.contract.ts). Canonical sensor payload contract for TypeScript and Elixir.',
  });

  const transitionSchema = makeElixirDraft7Schema(SensorTransitionEventSchema, {
    $id: '/contracts/sensor/sensor_transition.schema.json',
    title: 'SensorTransitionEvent',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/sensor/ts/sensor.contract.ts). Canonical transition event contract for TypeScript and Elixir.',
  });

  const jidoAgentStateSchema = makeElixirDraft7Schema(SensorAgentStateSchema, {
    $id: '/contracts/sensor/sensor_agent_state.schema.json',
    title: 'SensorAgentState',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/sensor/ts/sensor.contract.ts). Canonical Jido agent-state contract for Elixir preflight validation.',
  });

  await writeFile(
    path.join(schemasDir, 'sensor.schema.json'),
    `${JSON.stringify(sensorSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'sensor_transition.schema.json'),
    `${JSON.stringify(transitionSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'sensor_agent_state.schema.json'),
    `${JSON.stringify(jidoAgentStateSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(path.join(schemasDir, 'sensor_transition.mmd'), toMermaid(), 'utf8');

  console.log('Generated schemas:');
  console.log(`- ${path.join(schemasDir, 'sensor.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'sensor_transition.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'sensor_agent_state.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'sensor_transition.mmd')}`);
};

generate().catch((error) => {
  console.error('Failed to generate schema artifacts:', error);
  process.exitCode = 1;
});
