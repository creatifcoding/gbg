import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { contentDigest } from '../src/digest.ts';
import { asComposer, asAssessor, asHumanGovernor } from '../src/identities.ts';
import { openLaboratory } from '../src/laboratory.ts';
import { defaultWorkflowsRoot, resolveUnderRoot } from '../src/paths.ts';

const readDefinition = (relative: string): Record<string, unknown> =>
  JSON.parse(
    readFileSync(resolveUnderRoot(defaultWorkflowsRoot(), relative), 'utf8'),
  ) as Record<string, unknown>;

test('content digest is canonical JSON without the digest field', () => {
  const definition = readDefinition('definitions/care-source-comparison.v1.json');
  assert.equal(contentDigest(definition), definition.digest);
  const mutated = { ...definition, description: 'changed' };
  assert.notEqual(contentDigest(mutated), definition.digest);
});

test('device-command fails at /graph/0/toolId', async () => {
  const lab = await openLaboratory();
  const composer = asComposer('workflow-composer-fixture');
  const assessor = asAssessor('tool-assessor-fixture');
  const draft = await lab.loadDraft(
    composer,
    'assistant/workflows/definitions/device-command-graph.v1.json',
    'assistant/workflows/laboratory/envelopes/device-command-graph.v1.json',
  );
  const evaluation = await lab.evaluate(assessor, draft);
  assert.equal(evaluation.kind, 'failed');
  if (evaluation.kind !== 'failed') return;
  assert.equal(evaluation.diagnostics[0]?.path, '/graph/0/toolId');
});

test('hidden unassayed MCP fails closed', async () => {
  const lab = await openLaboratory();
  const draft = await lab.loadDraft(
    asComposer('workflow-composer-fixture'),
    'assistant/workflows/definitions/hidden-unassayed-mcp.v1.json',
    'assistant/workflows/laboratory/envelopes/hidden-unassayed-mcp.v1.json',
  );
  const evaluation = await lab.evaluate(asAssessor('tool-assessor-fixture'), draft);
  assert.equal(evaluation.kind, 'failed');
  if (evaluation.kind !== 'failed') return;
  assert.equal(evaluation.diagnostics[0]?.path, '/graph/0/toolId');
});

test('unbounded foreach fails at /graph/1', async () => {
  const lab = await openLaboratory();
  const draft = await lab.loadDraft(
    asComposer('workflow-composer-fixture'),
    'assistant/workflows/definitions/unbounded-loop.v1.json',
    'assistant/workflows/laboratory/envelopes/unbounded-loop.v1.json',
  );
  const evaluation = await lab.evaluate(asAssessor('tool-assessor-fixture'), draft);
  assert.equal(evaluation.kind, 'failed');
  if (evaluation.kind !== 'failed') return;
  assert.equal(evaluation.diagnostics[0]?.path, '/graph/1');
});

test('replay of a nominal write fails closed', async () => {
  const lab = await openLaboratory();
  const draft = await lab.loadDraft(
    asComposer('workflow-composer-fixture'),
    'assistant/workflows/definitions/replay-nominal-write.v1.json',
    'assistant/workflows/laboratory/envelopes/replay-nominal-write.v1.json',
  );
  const evaluation = await lab.evaluate(asAssessor('tool-assessor-fixture'), draft);
  assert.equal(evaluation.kind, 'failed');
  if (evaluation.kind !== 'failed') return;
  assert.equal(evaluation.diagnostics[0]?.path, '/graph/0/toolId');
});

test('revocation blocks new runs and keeps the digest', async () => {
  const lab = await openLaboratory();
  const composer = asComposer('workflow-composer-fixture');
  const assessor = asAssessor('tool-assessor-fixture');
  const governor = asHumanGovernor('human-governor-fixture');
  const draft = await lab.loadDraft(
    composer,
    'assistant/workflows/definitions/care-source-comparison.v1.json',
    'assistant/workflows/laboratory/envelopes/care-source-comparison.v1.json',
  );
  const evaluation = await lab.evaluate(assessor, draft);
  assert.equal(evaluation.kind, 'closed');
  if (evaluation.kind !== 'closed') return;
  const signed = await lab.approve(governor, lab.present(evaluation));
  const active = await lab.activate(governor, signed);
  const receipt = await lab.bindRun(active, { topic: 'nymph' });
  assert.equal(receipt.digest, draft.digest);
  assert.equal(receipt.replaySafe, true);
  const wire = lab.toAdmissionWire(active);
  assert.equal(wire.state, 'active');
  const revoked = await lab.revoke(governor, active, 'superseded');
  assert.equal(revoked.state, 'revoked');
  assert.equal(revoked.digest, active.digest);
  await assert.rejects(() => lab.bindRun(revoked as never, { topic: 'nymph' }));
});

test('package.json pins match the recorded A0 Mastra pin', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    packageManager: string;
  };
  assert.equal(pkg.dependencies.ajv, '8.20.0');
  assert.equal(pkg.dependencies['ajv-formats'], '3.0.1');
  assert.equal(pkg.devDependencies.typescript, '5.9.3');
  assert.equal(pkg.packageManager, 'npm@10.9.7');
});
