import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  OrderAgentStateSchema,
  OrderSchema,
  TransitionEventSchema,
  toMermaid,
} from '../ts/order.contract';
import { makeElixirDraft7Schema } from '../../../../core/contracts/json-schema.codegen';

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);
const orderDomainDir = path.resolve(thisDir, '..');
const schemasDir = path.join(orderDomainDir, 'schemas');

const generate = async (): Promise<void> => {
  await mkdir(schemasDir, { recursive: true });

  // Effect Schema feature:
  // JSONSchema.make turns canonical Effect Schema into JSON Schema interchange artifacts.
  const orderSchema = makeElixirDraft7Schema(OrderSchema, {
    $id: '/contracts/order/order.schema.json',
    title: 'Order',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/order/ts/order.contract.ts). Canonical order payload contract for TypeScript and Elixir.',
  });

  const transitionSchema = makeElixirDraft7Schema(TransitionEventSchema, {
    $id: '/contracts/order/order_transition.schema.json',
    title: 'OrderTransitionEvent',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/order/ts/order.contract.ts). Canonical transition event contract for TypeScript and Elixir.',
  });

  const jidoAgentStateSchema = makeElixirDraft7Schema(OrderAgentStateSchema, {
    $id: '/contracts/order/order_agent_state.schema.json',
    title: 'OrderAgentState',
    description:
      'Generated from Effect Schema (src/lib/maidens/domains/contracts/order/ts/order.contract.ts). Canonical Jido agent-state contract for Elixir preflight validation.',
  });

  await writeFile(
    path.join(schemasDir, 'order.schema.json'),
    `${JSON.stringify(orderSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'order_transition.schema.json'),
    `${JSON.stringify(transitionSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'order_agent_state.schema.json'),
    `${JSON.stringify(jidoAgentStateSchema, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    path.join(schemasDir, 'order_transition.mmd'),
    toMermaid(),
    'utf8'
  );

  console.log('Generated schemas:');
  console.log(`- ${path.join(schemasDir, 'order.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'order_transition.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'order_agent_state.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'order_transition.mmd')}`);
};

generate().catch((error) => {
  console.error('Failed to generate schema artifacts:', error);
  process.exitCode = 1;
});
