import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { FakeClock } from '../src/clock.ts';
import {
  FAKE_MODEL_TEXT,
  authenticatedInProcessAguiRoundTrip,
  collectOpenRouterProof,
  createAdapterHarness,
  createLiveLunaLane,
  liveLunaLaneIdentity,
} from '../src/mastra-adapter.ts';
import { PINS } from '../src/pins.ts';
import type { SessionBinding } from '../src/types.ts';

test('missing OPENROUTER_API_KEY fails closed and ignores OPENAI_API_KEY', () => {
  const adapter = fileURLToPath(new URL('../src/mastra-adapter.ts', import.meta.url));
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--input-type=module',
      '-e',
      `import { createLiveLunaLane, OpenRouterGateError, OPENROUTER_CREDENTIAL_REQUIRED } from ${JSON.stringify(adapter)};
try {
  createLiveLunaLane();
  process.exit(2);
} catch (error) {
  process.exit(
    error instanceof OpenRouterGateError && error.code === OPENROUTER_CREDENTIAL_REQUIRED
      ? 0
      : 3,
  );
}`,
    ],
    {
      env: {
        ...process.env,
        OPENROUTER_API_KEY: '',
        OPENAI_API_KEY: 'sk-not-openrouter',
      },
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 0, result.stderr.slice(0, 400));
});

test('live lane config is OpenRouter openai-compatible Luna at max reasoning', () => {
  const identity = liveLunaLaneIdentity(createLiveLunaLane());
  assert.deepEqual(identity, {
    kind: 'live-luna',
    providerId: 'openrouter',
    modelId: PINS.liveModel,
    url: PINS.liveBaseUrl,
    hasApiKey: true,
  });
  assert.equal(PINS.liveModel, 'openai/gpt-5.6-luna');
  assert.equal(PINS.liveReasoningLevel, 'max');
});

test(
  'OpenRouter Luna generate and in-process AG-UI bind are the proof',
  { timeout: 180_000 },
  async (t) => {
    const lane = createLiveLunaLane();
    const harness = await createAdapterHarness(new FakeClock(), lane);
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
      threadId: 'care:fixture-cup-01:conversation-live-luna',
      scope: 'web',
    };
    const roundTrip = await authenticatedInProcessAguiRoundTrip(harness, binding);
    assert.equal(roundTrip.unauthenticatedStatus, 401);
    assert.equal('runtimeUrl' in roundTrip.bind, false);
    assert.ok(
      (roundTrip.authenticatedText.includes('CareAdvice') ||
        roundTrip.eventTypes.length > 0) &&
        !roundTrip.authenticatedText.includes(FAKE_MODEL_TEXT),
      JSON.stringify({
        eventTypes: roundTrip.eventTypes,
        text: roundTrip.authenticatedText.slice(0, 400),
      }),
    );
  },
);
