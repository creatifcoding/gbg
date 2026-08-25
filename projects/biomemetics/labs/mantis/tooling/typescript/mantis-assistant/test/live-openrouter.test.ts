import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeClock } from '../src/clock.ts';
import { loadLabJson, validateInstance } from '../src/contracts.ts';
import { MantisController } from '../src/controller.ts';
import {
  FAKE_MODEL_TEXT,
  authenticatedInProcessAguiRoundTrip,
  collectOpenRouterProof,
  createAdapterHarness,
  createLiveOpenRouterLane,
  liveOpenRouterLaneIdentity,
} from '../src/mastra-adapter.ts';
import { PINS } from '../src/pins.ts';
import type { SessionBinding } from '../src/types.ts';

test('live lane is the Mastra OpenRouter DeepSeek model-router string', () => {
  const identity = liveOpenRouterLaneIdentity(createLiveOpenRouterLane());
  assert.deepEqual(identity, {
    kind: 'live-openrouter',
    model: PINS.liveModel,
  });
  assert.equal(PINS.liveModel, 'openrouter/deepseek/deepseek-v4-flash-0731');
});

test(
  'OpenRouter DeepSeek generate and in-process AG-UI bind are the proof',
  { timeout: 180_000 },
  async (t) => {
    const harness = await createAdapterHarness(new FakeClock());
    t.after(() => harness.destroy());

    const generated = await collectOpenRouterProof(harness.agent);
    assert.notEqual(generated, FAKE_MODEL_TEXT);
    assert.ok(
      generated.includes('CareAdvice'),
      JSON.stringify({ text: generated.slice(0, 400) }),
    );

    const binding: SessionBinding = {
      principalId: 'principal.fixture.care-space-01',
      resourceId: 'principal.fixture.care-space-01',
      careSubjectId: 'care.fixture-cup-01',
      mode: 'care',
      threadId: 'care:fixture-cup-01:conversation-live-openrouter',
      scope: 'web',
    };
    const roundTrip = await authenticatedInProcessAguiRoundTrip(harness, binding);
    assert.equal(roundTrip.unauthenticatedStatus, 401);
    assert.equal('runtimeUrl' in roundTrip.bind, false);
    assert.ok(
      roundTrip.authenticatedText.includes('CareAdvice') &&
        !roundTrip.authenticatedText.includes(FAKE_MODEL_TEXT),
      JSON.stringify({
        eventTypes: roundTrip.eventTypes,
        text: roundTrip.authenticatedText.slice(0, 400),
      }),
    );
  },
);

test(
  'OpenRouter DeepSeek eval and AG-UI matrix cases are the proof',
  { timeout: 300_000 },
  async (t) => {
    const controller = await MantisController.create();
    t.after(() => controller.destroy());

    const care = controller.bindSession({
      principalId: 'principal.fixture.care-space-01',
      careSubjectId: 'care.fixture-cup-01',
      mode: 'care',
      conversationId: 'conversation-01',
    });

    const evalResult = await controller.evals();
    assert.equal(
      evalResult.scores['check-includes'],
      1,
      JSON.stringify({ scores: evalResult.scores, experiment: evalResult.experiment }),
    );
    assert.equal(evalResult.scores['check-excludes'], 1);

    const roundTrip = await controller.aguiRoundTrip();
    assert.equal(roundTrip.unauthenticatedStatus, 401);
    assert.ok(
      roundTrip.authenticatedText.includes('CareAdvice') &&
        !roundTrip.authenticatedText.includes(FAKE_MODEL_TEXT),
      JSON.stringify({
        eventTypes: roundTrip.eventTypes,
        text: roundTrip.authenticatedText.slice(0, 400),
      }),
    );

    const fixture = loadLabJson(
      'assistant/fixtures/agui/in-process-bind.json',
    ) as {
      kind: string;
      basePath: string;
      agentId: string;
      unauthenticatedStatus: number;
    };
    const inProcess = await controller.inProcessAguiRoundTrip(care);
    const capability = controller.capabilities.find(
      (entry) => entry.id === 'in-process-agui-bind',
    );
    assert.equal(inProcess.unauthenticatedStatus, fixture.unauthenticatedStatus);
    assert.equal(inProcess.infoStatus, 200);
    assert.ok(inProcess.agentIds.includes(fixture.agentId));
    assert.equal(inProcess.agentIds.includes('device-command'), false);
    assert.equal('runtimeUrl' in inProcess.bind, false);
    assert.equal(capability?.status, 'proven');
    assert.ok(
      inProcess.authenticatedText.includes('CareAdvice') &&
        !inProcess.authenticatedText.includes(FAKE_MODEL_TEXT),
      JSON.stringify({
        authenticatedText: inProcess.authenticatedText.slice(0, 400),
        eventTypes: inProcess.eventTypes,
      }),
    );
    const receiptValid = validateInstance(
      'assistant/contracts/assistant-run.schema.json',
      controller.emitRunReceipt(care, 'run.fixture-a0-01'),
    );
    assert.equal(receiptValid.valid, true, receiptValid.errors.join('; '));
  },
);
