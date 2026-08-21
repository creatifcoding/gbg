import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { PINS } from '../src/pins.ts';
import { effectPin } from '../src/effect-pin.ts';
import { loadCorpus, loadRegistry, validateInstance, loadLabJson } from '../src/contracts.ts';
import type {
  ActuationCommand,
  ActuationIntent,
  ActuationReceipt,
  CareSubject,
  Observation,
} from '../src/contract-types.ts';

test('pinned Effect package loads', () => {
  assert.equal(effectPin, true);
});

test('package.json pins match PINS', () => {
  const pkg = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    packageManager: string;
  };
  assert.equal(pkg.dependencies['@mastra/core'], PINS.mastraCore);
  assert.equal(pkg.dependencies['@mastra/client-js'], PINS.mastraClientJs);
  assert.equal(pkg.dependencies['@mastra/memory'], PINS.mastraMemory);
  assert.equal(pkg.dependencies['@mastra/observability'], PINS.mastraObservability);
  assert.equal(pkg.dependencies['@mastra/evals'], PINS.mastraEvals);
  assert.equal(pkg.dependencies['@mastra/libsql'], PINS.mastraLibsql);
  assert.equal(pkg.dependencies['@copilotkit/runtime'], PINS.copilotkitRuntime);
  assert.equal(pkg.dependencies['@copilotkit/shared'], PINS.copilotkitShared);
  assert.equal(pkg.dependencies['@ag-ui/mastra'], PINS.aguiMastra);
  assert.equal(pkg.dependencies['@ag-ui/core'], PINS.aguiCore);
  assert.equal(pkg.dependencies['@ag-ui/client'], PINS.aguiClient);
  assert.equal(pkg.dependencies.effect, PINS.effect);
  assert.equal(pkg.dependencies.ajv, PINS.ajv);
  assert.equal(pkg.dependencies.zod, PINS.zod);
  assert.equal(pkg.devDependencies.typescript, PINS.typescript);
  assert.equal(pkg.packageManager, PINS.packageManager);
});

test('installed package versions match the lock pins', () => {
  const installed = (name: string) =>
    (
      JSON.parse(
        readFileSync(
          new URL(`../node_modules/${name}/package.json`, import.meta.url),
          'utf8',
        ),
      ) as { version: string }
    ).version;
  assert.equal(installed('@mastra/core'), PINS.mastraCore);
  assert.equal(installed('@mastra/memory'), PINS.mastraMemory);
  assert.equal(installed('@mastra/observability'), PINS.mastraObservability);
  assert.equal(installed('@mastra/evals'), PINS.mastraEvals);
  assert.equal(installed('@mastra/client-js'), PINS.mastraClientJs);
  assert.equal(installed('@mastra/libsql'), PINS.mastraLibsql);
  assert.equal(installed('@copilotkit/runtime'), PINS.copilotkitRuntime);
  assert.equal(installed('@copilotkit/shared'), PINS.copilotkitShared);
  assert.equal(installed('@ag-ui/mastra'), PINS.aguiMastra);
  assert.equal(installed('@ag-ui/client'), PINS.aguiClient);
  assert.equal(installed('effect'), PINS.effect);
});

test('contract registry lists every A0 kind', () => {
  const registry = loadRegistry();
  const kinds = new Set(registry.schemas.map((schema) => schema.kind));
  for (const kind of [
    'CareSubject',
    'Observation',
    'Interpretation',
    'CareEvent',
    'CareAdvice',
    'AssistantRun',
    'ToolAssayRecord',
    'ToolAdmission',
    'DynamicWorkflowDefinition',
    'WorkflowAdmission',
    'WorkflowRunReceipt',
    'ActuationIntent',
    'ActuationCommand',
    'ActuationReceipt',
  ]) {
    assert.ok(kinds.has(kind), kind);
  }
});

test('Draft 2020-12 corpus matches expect pass/fail', () => {
  const corpus = loadCorpus();
  assert.ok(corpus.cases.length >= 14);
  for (const entry of corpus.cases) {
    const instance = loadLabJson(entry.instance);
    const result = validateInstance(entry.schema, instance);
    if (entry.expect === 'pass') {
      assert.equal(result.valid, true, `${entry.id}: ${result.errors.join('; ')}`);
    } else {
      assert.equal(result.valid, false, `${entry.id} should fail`);
    }
  }
});

test('actuation types remain distinct', () => {
  const intent = loadLabJson(
    'projects/biomemetics/labs/mantis/assistant/fixtures/corpus/positive/actuation-intent.json',
  ) as ActuationIntent;
  const command = loadLabJson(
    'projects/biomemetics/labs/mantis/assistant/fixtures/corpus/positive/actuation-command.json',
  ) as ActuationCommand;
  const receipt = loadLabJson(
    'projects/biomemetics/labs/mantis/assistant/fixtures/corpus/positive/actuation-receipt.json',
  ) as ActuationReceipt;
  assert.equal(intent.kind, 'ActuationIntent');
  assert.equal(intent.executable, false);
  assert.equal(command.kind, 'ActuationCommand');
  assert.equal(command.executable, true);
  assert.notEqual(command.issuer, 'assistant');
  assert.equal(receipt.kind, 'ActuationReceipt');
});

test('generated CareSubject and Observation types stay distinct', () => {
  const subject = loadLabJson(
    'projects/biomemetics/labs/mantis/assistant/fixtures/corpus/positive/care-subject.json',
  ) as CareSubject;
  const observation = loadLabJson(
    'projects/biomemetics/labs/mantis/assistant/fixtures/corpus/positive/observation.json',
  ) as Observation;
  assert.equal(subject.catalogSpecimen, false);
  assert.equal(observation.recordClass, 'observation');
  assert.notEqual(subject.kind, observation.kind);
});

test('tool assay and admission fixtures validate', () => {
  const assay = validateInstance(
    'assistant/contracts/tool-assay-record.schema.json',
    loadLabJson('assistant/tools/assays/care-source-read.json'),
  );
  assert.equal(assay.valid, true, assay.errors.join('; '));
  const admission = validateInstance(
    'assistant/contracts/tool-admission.schema.json',
    loadLabJson('assistant/tools/admissions/care-source-read.json'),
  );
  assert.equal(admission.valid, true, admission.errors.join('; '));
  const assayDoc = loadLabJson('assistant/tools/admissions/care-source-read.json') as {
    assessor: string;
    reviewer: string;
  };
  assert.notEqual(assayDoc.assessor, assayDoc.reviewer);
});

test('workflow fixtures validate', () => {
  const definition = validateInstance(
    'assistant/contracts/dynamic-workflow-definition.schema.json',
    loadLabJson('assistant/workflows/definitions/research-summary.v1.json'),
  );
  assert.equal(definition.valid, true, definition.errors.join('; '));
});

test('assistant-run memory class is assistant-memory', () => {
  const run = loadLabJson(
    'projects/biomemetics/labs/mantis/assistant/fixtures/corpus/positive/assistant-run.json',
  ) as { memoryRecordClass: string };
  assert.equal(run.memoryRecordClass, 'assistant-memory');
});
