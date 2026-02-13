import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const SESSION_SERVICE_PATH = 'src/lib/holonet/phoenix/services/PhoenixChannelSession.ts';

describe('Phoenix observability conformance', () => {
  it('declares required span names in session service', async () => {
    const source = await readFile(SESSION_SERVICE_PATH, 'utf8');

    const requiredSpans = [
      'holonet.phoenix.connect',
      'holonet.phoenix.join',
      'holonet.phoenix.replay.apply',
      'holonet.phoenix.replay.ack',
      'holonet.phoenix.live.dispatch',
      'holonet.phoenix.reconnect.auto',
      'holonet.phoenix.reconnect.manual',
    ];

    for (const span of requiredSpans) {
      expect(source.includes(`'${span}'`) || source.includes(`"${span}"`)).toBe(true);
    }
  });

  it('logs required correlation/context fields', async () => {
    const source = await readFile(SESSION_SERVICE_PATH, 'utf8');

    const requiredFields = [
      'workspace_id',
      'topic',
      'client_session_id',
      'replay_session_id',
      'last_seen_event_id',
      'event_id',
      'correlation_id',
    ];

    for (const field of requiredFields) {
      expect(source.includes(field)).toBe(true);
    }
  });
});
