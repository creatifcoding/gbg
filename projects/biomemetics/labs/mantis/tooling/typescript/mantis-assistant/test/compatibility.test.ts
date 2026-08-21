import assert from 'node:assert/strict';
import test from 'node:test';

import { loadLabJson, validateInstance } from '../src/contracts.ts';
import { MantisController } from '../src/controller.ts';
import { redactTracePayload } from '../src/mastra-adapter.ts';

const matrix = loadLabJson(
  'projects/biomemetics/labs/mantis/assistant/evals/compatibility-matrix.json',
) as { cases: string[] };

test('compatibility matrix is the A0 required set', () => {
  assert.deepEqual(matrix.cases, [
    'agui-streaming-reconnect',
    'controller-modes-isolated-sessions',
    'resource-thread-binding',
    'mode-tool-deny-precedence',
    'stale-approval-after-restart',
    'constrained-subagent-boundary',
    'thread-om-privacy-filter',
    'dynamic-workflow-registration-version',
    'workflow-suspend-resume',
    'durable-reconnect-readonly',
    'trace-redaction-run-correlation',
    'deterministic-eval-invocation',
  ]);
});

test('compatibility matrix against pinned Mastra', { timeout: 60_000 }, async (t) => {
  const controller = await MantisController.create();
  t.after(() => controller.destroy());

  const care = controller.bindSession({
    principalId: 'principal.fixture.care-space-01',
    careSubjectId: 'care.fixture-cup-01',
    mode: 'care',
    conversationId: 'conversation-01',
  });
  const sim = controller.bindSession({
    principalId: 'principal.fixture.care-space-01',
    careSubjectId: 'care.fixture-cup-01',
    mode: 'service-sim',
    conversationId: 'sim-01',
    scope: 'service-sim',
  });

  await t.test('controller-modes-isolated-sessions', async () => {
    const careSession = await controller.createMastraSession(care);
    const simSession = await controller.createMastraSession(sim);
    assert.notEqual(careSession, simSession);
    const mode = await controller.applyMode(care, 'observe');
    assert.equal(mode, 'observe');
  });

  await t.test('resource-thread-binding', () => {
    assert.equal(care.resourceId, 'principal.fixture.care-space-01');
    assert.equal(care.threadId, 'care:fixture-cup-01:conversation-01');
    assert.notEqual(care.threadId, sim.threadId);
    assert.notEqual(care.scope, sim.scope);
  });

  await t.test('mode-tool-deny-precedence', async () => {
    assert.equal(controller.resolveTool(care, 'device-command'), 'deny');
    await assert.rejects(
      () => controller.applyToolPolicy(care, 'device-command', 'allow'),
      /cannot widen/,
    );
  });

  await t.test('stale-approval-after-restart', async () => {
    controller.approveTool('live-session', 'approve');
    await controller.restart(care);
    assert.equal(controller.approvalSurvivesRestart('live-session'), false);
  });

  await t.test('constrained-subagent-boundary', () => {
    controller.delegate('care-source', false);
    assert.throws(() => controller.delegate('adversarial-reviewer', true));
  });

  await t.test('thread-om-privacy-filter', () => {
    const om = controller.observeThread(
      care.threadId,
      'Ship to 10 Oak Avenue. EXIF 37.7749,-122.4194 Bearer fixture-token',
    );
    assert.equal(om.recordClass, 'assistant-memory');
    assert.equal(om.text.includes('Oak Avenue'), false);
    assert.equal(om.text.includes('37.7749'), false);
    const live = controller.capabilities.find(
      (entry) => entry.id === 'thread-om-live-observer-reflector',
    );
    assert.equal(live?.status, 'QUARANTINED_UPSTREAM');
    assert.ok((live?.detail ?? '').length > 0);
  });

  await t.test('dynamic-workflow-registration-version', async () => {
    const capability = controller.capabilities.find(
      (entry) => entry.id === 'dynamic-workflow-registration',
    );
    if (capability?.status === 'QUARANTINED_UPSTREAM') {
      assert.ok(capability.detail.length > 0);
      return;
    }
    const workflow = await controller.registerWorkflow({
      id: 'wf.research-summary-run',
      description: 'versioned fixture',
      inputSchema: {
        type: 'object',
        properties: { topic: { type: 'string' } },
        required: ['topic'],
      },
      outputSchema: {
        type: 'object',
        properties: { summary: { type: 'string' } },
        required: ['summary'],
      },
      graph: [{ type: 'tool', id: 'lookup', toolId: 'care-source-read' }],
    });
    assert.ok(workflow);
    await assert.rejects(
      () =>
        controller.registerWorkflow({
          id: 'wf.bad',
          description: 'prohibited',
          inputSchema: { type: 'object' },
          outputSchema: { type: 'object' },
          graph: [{ type: 'tool', id: 'x', toolId: 'device-command' }],
        }),
      /prohibited primitive/,
    );
  });

  await t.test('workflow-suspend-resume', async () => {
    const { suspended, resumed } = await controller.suspendResume();
    assert.equal(suspended.status, 'suspended');
    assert.equal(resumed.status, 'success');
  });

  await t.test('durable-reconnect-readonly', async () => {
    const result = await controller.durableReconnect();
    assert.equal(result.duplicated, false);
    assert.equal(result.externalEffectCount, 0);
    if (result.status === 'QUARANTINED_UPSTREAM') {
      assert.ok(result.detail.length > 0);
    } else {
      assert.ok(result.chunkCount > 0);
    }
    const receipt = loadLabJson(
      'assistant/fixtures/corpus/positive/workflow-run-receipt.json',
    );
    const valid = validateInstance(
      'assistant/contracts/workflow-run-receipt.schema.json',
      receipt,
    );
    assert.equal(valid.valid, true);
  });

  await t.test('trace-redaction-run-correlation', () => {
    const redacted = redactTracePayload({
      authorization: 'Bearer fixture-token',
      address: '123 Maple Street',
      note: 'ok',
    }) as Record<string, unknown>;
    const blob = JSON.stringify(redacted);
    assert.equal(blob.includes('Bearer fixture-token'), false);
    assert.equal(blob.includes('123 Maple Street'), false);
    const receipt = controller.emitRunReceipt(care, 'run.fixture-a0-01');
    assert.equal(receipt.versions.mastraCore.length > 0, true);
    const receiptValid = validateInstance(
      'assistant/contracts/assistant-run.schema.json',
      receipt,
    );
    assert.equal(receiptValid.valid, true, receiptValid.errors.join('; '));
  });

  await t.test('deterministic-eval-invocation', async () => {
    const result = await controller.evals();
    assert.equal(
      result.scores['check-includes'],
      1,
      JSON.stringify({ scores: result.scores, experiment: result.experiment }),
    );
    assert.equal(result.scores['check-excludes'], 1);
  });

  await t.test('agui-streaming-reconnect', async () => {
    const roundTrip = await controller.aguiRoundTrip();
    assert.equal(roundTrip.unauthenticatedStatus, 401);
    assert.ok(
      roundTrip.authenticatedText.includes('CareAdvice') ||
        roundTrip.eventTypes.length > 0,
      JSON.stringify(roundTrip),
    );
  });
});
