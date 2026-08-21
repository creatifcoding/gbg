import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createLiveLunaLane,
  LIVE_LUNA_GAP,
  LIVE_LUNA_QUARANTINED_UPSTREAM,
  LiveLunaQuarantinedError,
} from '../src/mastra-adapter.ts';

const liveRequested = process.env.MASTRA_LIVE === '1';

test(
  'live Luna stays quarantined until the pinned OAuth provider exists',
  { skip: liveRequested ? false : 'set MASTRA_LIVE=1 to inspect the live lane status' },
  () => {
    assert.throws(
      () => createLiveLunaLane(),
      (error: unknown) => {
        assert.ok(error instanceof LiveLunaQuarantinedError);
        assert.equal(error.code, LIVE_LUNA_QUARANTINED_UPSTREAM);
        assert.equal(error.message, LIVE_LUNA_GAP);
        return true;
      },
    );
  },
);
