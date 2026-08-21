#!/usr/bin/env node
// Zero-dependency checker for the shared environment JSON Schema fixtures.
// Applies the locked rules from schema.json to the positive and negative instances.

import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

if (process.argv.length !== 5) {
  fail("usage: schema-check.mjs SCHEMA POSITIVE NEGATIVE");
}

const [, , schemaPath, positivePath, negativePath] = process.argv;
const schemaText = readFileSync(schemaPath, "utf8");
if (
  !schemaText.includes("environment-fixture") ||
  !schemaText.includes('"additionalProperties": false') ||
  !schemaText.includes('"minimum": 0')
) {
  fail("schema fixture does not declare the locked environment-fixture rules");
}

const schema = JSON.parse(schemaText);
if (schema.type !== "object" || schema.additionalProperties !== false) {
  fail("schema type/additionalProperties mismatch");
}

function validate(instance) {
  if (instance === null || typeof instance !== "object" || Array.isArray(instance)) {
    throw new Error("instance must be an object");
  }
  const keys = Object.keys(instance);
  for (const key of keys) {
    if (key !== "kind" && key !== "value") {
      throw new Error(`additional property: ${key}`);
    }
  }
  if (instance.kind !== "environment-fixture") {
    throw new Error("kind must be the const environment-fixture");
  }
  if (!Number.isInteger(instance.value) || instance.value < 0) {
    throw new Error("value must be an integer >= 0");
  }
}

try {
  validate(JSON.parse(readFileSync(positivePath, "utf8")));
} catch (error) {
  fail(`positive fixture must validate: ${error.message}`);
}

let negativeRejected = false;
try {
  validate(JSON.parse(readFileSync(negativePath, "utf8")));
} catch {
  negativeRejected = true;
}
if (!negativeRejected) {
  fail("negative fixture must not validate");
}

process.stdout.write("typescript schema-check: positive ok, negative rejected\n");
