import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { Ajv2020 } from "ajv/dist/2020.js";
import * as ajvFormats from "ajv-formats";
import type { ValidateFunction, ErrorObject } from "ajv";

import { defaultWorkflowsRoot, resolveUnderRoot } from "./paths.ts";

type AddFormats = (ajv: Ajv2020) => void;

function resolveAddFormats(): AddFormats {
  const mod = ajvFormats as unknown as { default?: AddFormats } & AddFormats;
  if (typeof mod.default === "function") {
    return mod.default;
  }
  return mod;
}

export interface SchemaBundle {
  readonly validateDefinition: ValidateFunction;
  readonly validateAdmission: ValidateFunction;
  readonly validateRunReceipt: ValidateFunction;
  readonly schemaDir: string;
}

function formatErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors || errors.length === 0) {
    return "schema validation failed";
  }
  return errors
    .map((e) => `${e.instancePath || "/"} ${e.message ?? e.keyword}`)
    .join("; ");
}

export async function loadSchemaBundle(options: {
  readonly workflowsRoot: string;
  readonly mantisRoot: string;
  readonly schemaPrefer: "live-then-snapshot" | "snapshot-only";
}): Promise<SchemaBundle> {
  const snapshotDir = path.join(
    options.workflowsRoot,
    "laboratory",
    "imported-a0",
  );
  const liveDir = path.join(options.mantisRoot, "assistant", "contracts");

  const useLive =
    options.schemaPrefer === "live-then-snapshot" &&
    existsSync(path.join(liveDir, "dynamic-workflow-definition.schema.json"));

  const schemaDir = useLive ? liveDir : snapshotDir;

  const definitionSchema = JSON.parse(
    await readFile(
      path.join(schemaDir, "dynamic-workflow-definition.schema.json"),
      "utf8",
    ),
  ) as object;
  const admissionSchema = JSON.parse(
    await readFile(
      path.join(schemaDir, "workflow-admission.schema.json"),
      "utf8",
    ),
  ) as object;
  const receiptSchema = JSON.parse(
    await readFile(
      path.join(schemaDir, "workflow-run-receipt.schema.json"),
      "utf8",
    ),
  ) as object;

  const ajv = new Ajv2020({ strict: false, allErrors: true });
  resolveAddFormats()(ajv);

  return {
    schemaDir,
    validateDefinition: ajv.compile(definitionSchema),
    validateAdmission: ajv.compile(admissionSchema),
    validateRunReceipt: ajv.compile(receiptSchema),
  };
}

export function assertValid(
  validate: ValidateFunction,
  value: unknown,
  label: string,
): void {
  if (!validate(value)) {
    throw new Error(`${label}: ${formatErrors(validate.errors)}`);
  }
}

export function defaultSchemaPaths(workflowsRoot = defaultWorkflowsRoot()): {
  readonly snapshotDir: string;
  readonly forbiddenTools: string;
} {
  return {
    snapshotDir: path.join(workflowsRoot, "laboratory", "imported-a0"),
    forbiddenTools: resolveUnderRoot(
      workflowsRoot,
      "laboratory/imported-a0/forbidden-tools.json",
    ),
  };
}
