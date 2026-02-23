import { JSONSchema } from 'effect';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  OrderSchema,
  TransitionEventSchema,
  toMermaid,
} from '../domains/order/ts/order.contract';

type JsonObject = Record<string, unknown>;

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);
const orderDomainDir = path.resolve(thisDir, '../domains/order');
const schemasDir = path.join(orderDomainDir, 'schemas');

const withStableMetadata = (
  schema: JsonObject,
  metadata: { $id: string; title: string; description: string }
): JsonObject => {
  // JSON Schema contract semantics:
  // We can add metadata fields without changing validation behavior for core keywords.
  // `default` is annotation-only and never relied upon for validation.
  return {
    ...schema,
    $id: metadata.$id,
    title: metadata.title,
    description: metadata.description,
  };
};

const generate = async (): Promise<void> => {
  await mkdir(schemasDir, { recursive: true });

  // Effect Schema feature:
  // JSONSchema.make turns canonical Effect Schema into JSON Schema interchange artifacts.
  const orderSchema = withStableMetadata(
    JSONSchema.make(OrderSchema, { target: 'jsonSchema7' }) as JsonObject,
    {
      $id: '/runtime-contracts/order/order.schema.json',
      title: 'Order',
      description:
        'Generated from Effect Schema (src/lib/maidens/runtime-contracts/domains/order/ts/order.contract.ts). Canonical order payload contract for TypeScript and Elixir.',
    }
  );

  const transitionSchema = withStableMetadata(
    JSONSchema.make(TransitionEventSchema, {
      target: 'jsonSchema7',
    }) as JsonObject,
    {
      $id: '/runtime-contracts/order/order_transition.schema.json',
      title: 'OrderTransitionEvent',
      description:
        'Generated from Effect Schema (src/lib/maidens/runtime-contracts/domains/order/ts/order.contract.ts). Canonical transition event contract for TypeScript and Elixir.',
    }
  );

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
    path.join(schemasDir, 'order_transition.mmd'),
    toMermaid(),
    'utf8'
  );

  console.log('Generated schemas:');
  console.log(`- ${path.join(schemasDir, 'order.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'order_transition.schema.json')}`);
  console.log(`- ${path.join(schemasDir, 'order_transition.mmd')}`);
};

generate().catch((error) => {
  console.error('Failed to generate schema artifacts:', error);
  process.exitCode = 1;
});
