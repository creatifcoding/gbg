import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AlarmAgentStateSchema,
  AlarmSchema,
  AlarmTransitionEventSchema,
  toMermaid,
} from '../ts/alarm.contract';
import { makeElixirDraft7Schema } from '../../../../core/contracts/json-schema.codegen';

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);
const alarmDomainDir = path.resolve(thisDir, '..');
const schemasDir = path.join(alarmDomainDir, 'schemas');

const generate = async (): Promise<void> => {
  await mkdir(schemasDir, { recursive: true });

  const alarmSchema = makeElixirDraft7Schema(AlarmSchema, {
    $id: '/contracts/alarm/alarm.schema.json',
    title: 'Alarm',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/alarm/ts/alarm.contract.ts). Canonical alarm payload contract for TypeScript and Elixir.',
  });

  const transitionSchema = makeElixirDraft7Schema(AlarmTransitionEventSchema, {
    $id: '/contracts/alarm/alarm_transition.schema.json',
    title: 'AlarmTransitionEvent',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/alarm/ts/alarm.contract.ts). Canonical transition event contract for TypeScript and Elixir.',
  });

  const jidoAgentStateSchema = makeElixirDraft7Schema(AlarmAgentStateSchema, {
    $id: '/contracts/alarm/alarm_agent_state.schema.json',
    title: 'AlarmAgentState',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/alarm/ts/alarm.contract.ts). Canonical Jido agent-state contract for Elixir preflight validation.',
  });

  await writeFile(
    path.join(schemasDir, 'alarm.schema.json'),
    `${JSON.stringify(alarmSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'alarm_transition.schema.json'),
    `${JSON.stringify(transitionSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'alarm_agent_state.schema.json'),
    `${JSON.stringify(jidoAgentStateSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'alarm_transition.mmd'),
    toMermaid(),
    'utf8'
  );

  console.log('Generated schemas:');
  console.log(`- ${path.join(schemasDir, 'alarm.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'alarm_transition.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'alarm_agent_state.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'alarm_transition.mmd')}`);
};

generate().catch((error) => {
  console.error('Failed to generate schema artifacts:', error);
  process.exitCode = 1;
});
