import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeClock } from '../src/clock.ts';
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
