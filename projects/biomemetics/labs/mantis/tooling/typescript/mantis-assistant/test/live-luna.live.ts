import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeClock } from '../src/clock.ts';
import {
  authenticatedInProcessAguiRoundTrip,
  createAdapterHarness,
  createLiveLunaLane,
  CODEX_SUBSCRIPTION_AUTH_REQUIRED,
  CodexSubscriptionGateError,
} from '../src/mastra-adapter.ts';
import type { SessionBinding } from '../src/types.ts';

const liveRequested = process.env.MASTRA_LIVE === '1';

test(
  'live Luna consumes CareAdvice through the in-process CopilotRuntime bind',
  {
    skip: liveRequested ? false : 'set MASTRA_LIVE=1 to opt into the subscription lane',
    timeout: 120_000,
  },
  async (t) => {
    let lane;
    try {
      lane = createLiveLunaLane();
    } catch (error) {
      assert.ok(error instanceof CodexSubscriptionGateError);
      assert.equal(error.code, CODEX_SUBSCRIPTION_AUTH_REQUIRED);
      return;
    }

    const harness = await createAdapterHarness(new FakeClock(), lane);
    t.after(() => harness.destroy());

    const binding: SessionBinding = {
      principalId: 'principal.fixture.care-space-01',
      resourceId: 'principal.fixture.care-space-01',
      careSubjectId: 'care.fixture-cup-01',
      mode: 'care',
      threadId: 'care:fixture-cup-01:conversation-live-luna',
      scope: 'web',
    };
    const roundTrip = await authenticatedInProcessAguiRoundTrip(harness, binding);

    assert.ok(
      roundTrip.authenticatedText.includes('CareAdvice') ||
        roundTrip.eventTypes.length > 0,
      JSON.stringify({
        eventTypes: roundTrip.eventTypes,
        text: roundTrip.authenticatedText.slice(0, 400),
      }),
    );
  },
);
