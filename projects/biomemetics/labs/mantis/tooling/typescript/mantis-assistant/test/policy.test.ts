import assert from 'node:assert/strict';
import test from 'node:test';

import { FailClosedError, MantisController } from '../src/controller.ts';
import { canSwitchMode, resolveToolPolicy, loadToolPolicy } from '../src/policy.ts';
import { containsForbiddenPrivacy, redactSensitive } from '../src/privacy.ts';
import { loadLabJson, validateInstance } from '../src/contracts.ts';

test('unknown tools deny', () => {
  const decision = resolveToolPolicy({
    mode: 'care',
    toolId: 'never-assayed-tool',
    category: 'unknown',
  });
  assert.equal(decision, 'deny');
});

test('device-command and admin are absolute deny in every mode', () => {
  const policy = loadToolPolicy();
  for (const mode of Object.keys(policy.modes) as Array<
    'care' | 'observe' | 'research' | 'terrarium-read' | 'review' | 'service-sim'
  >) {
    assert.equal(
      resolveToolPolicy({ mode, toolId: 'device-command', category: 'device-command' }),
      'deny',
    );
    assert.equal(resolveToolPolicy({ mode, toolId: 'admin', category: 'admin' }), 'deny');
  }
});

test('mode allow does not override per-tool deny', () => {
  assert.equal(
    resolveToolPolicy({
      mode: 'care',
      toolId: 'care-source-read',
      category: 'read-public',
      perToolDeny: true,
    }),
    'deny',
  );
});

test('care mode allows read-public and asks external-write', () => {
  assert.equal(
    resolveToolPolicy({ mode: 'care', toolId: 'care-source-read', category: 'read-public' }),
    'allow',
  );
  assert.equal(
    resolveToolPolicy({ mode: 'care', toolId: 'purchase', category: 'external-write' }),
    'ask',
  );
});

test('client cannot elevate mode without host policy', () => {
  assert.equal(canSwitchMode('care', 'review', false), false);
  assert.equal(canSwitchMode('care', 'review', true), true);
  assert.equal(canSwitchMode('review', 'care', false), true);
});

test('privacy processor strips address, EXIF, and tokens', () => {
  const fixture = loadLabJson(
    'projects/biomemetics/labs/mantis/assistant/fixtures/privacy/address-exif.json',
  ) as { input: { text: string }; mustNotAppearAfterRedaction: string[] };
  const redacted = redactSensitive(fixture.input.text);
  assert.equal(containsForbiddenPrivacy(redacted, fixture.mustNotAppearAfterRedaction), false);
  assert.ok(redacted.includes('[redacted-address]'));
});

test('MantisController fail-closed guards', async () => {
  const controller = await MantisController.create();
  try {
    const binding = controller.bindSession({
      principalId: 'principal.fixture.care-space-01',
      careSubjectId: 'care.fixture-cup-01',
      mode: 'care',
      conversationId: 'conversation-01',
    });
    assert.throws(
      () => controller.assertBoundResource(binding, 'someone-else'),
      FailClosedError,
    );
    assert.throws(() => controller.assertBoundMode(binding, 'review'), FailClosedError);
    assert.throws(() => controller.switchMode(binding, 'review', false), FailClosedError);
    assert.equal(controller.resolveTool(binding, 'device-command'), 'deny');
    assert.equal(controller.resolveTool(binding, 'unknown-mcp-tool'), 'deny');
    assert.throws(() => controller.refuseActuationCommand('llm'), FailClosedError);
    assert.throws(() => controller.delegate('care-source', true), /forked/);
    controller.approveTool('session-1', 'approve');
    assert.equal(controller.approvalSurvivesRestart('session-1'), true);
    controller.clearApprovalsOnRestart();
    assert.equal(controller.approvalSurvivesRestart('session-1'), false);
    const om = controller.observeThread(
      binding.threadId,
      'User lives at 123 Maple Street and token sk-live-fixture-not-a-secret',
    );
    assert.equal(om.recordClass, 'assistant-memory');
    assert.equal(om.text.includes('123 Maple Street'), false);
    const receipt = controller.emitRunReceipt(binding, 'run.fixture-a0-01');
    assert.equal(receipt.memoryRecordClass, 'assistant-memory');
    assert.equal(receipt.versions.mastraCore, '1.61.0');
    const valid = validateInstance(
      'assistant/contracts/assistant-run.schema.json',
      receipt,
    );
    assert.equal(valid.valid, true, valid.errors.join('; '));
  } finally {
    await controller.destroy();
  }
});
