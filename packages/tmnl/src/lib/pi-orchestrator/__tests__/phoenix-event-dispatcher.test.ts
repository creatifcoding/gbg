import { describe, expect, it, vi } from 'vitest'

import { dispatchPhoenixEnvelope } from '../services/PhoenixEventDispatcher'
import type { AvaPhoenixEnvelope } from '../client/PhoenixChannelClient'

const makeEnvelope = (event_type: string): AvaPhoenixEnvelope => ({
  event_id: 'evt-1',
  schema_version: 1,
  event_type,
  workspace_id: 'ws-1',
  occurred_at: new Date().toISOString(),
  payload: {},
})

describe('dispatchPhoenixEnvelope', () => {
  it('routes known artifact events to matching sink handlers', () => {
    const onArtifactUpdated = vi.fn()
    const onArtifactCreated = vi.fn()
    const onArtifactDeleted = vi.fn()

    dispatchPhoenixEnvelope(makeEnvelope('ava.artifact.updated'), { onArtifactUpdated })
    dispatchPhoenixEnvelope(makeEnvelope('ava.artifact.created'), { onArtifactCreated })
    dispatchPhoenixEnvelope(makeEnvelope('ava.artifact.deleted'), { onArtifactDeleted })

    expect(onArtifactUpdated).toHaveBeenCalledTimes(1)
    expect(onArtifactCreated).toHaveBeenCalledTimes(1)
    expect(onArtifactDeleted).toHaveBeenCalledTimes(1)
  })

  it('routes unknown events to fallback handler', () => {
    const onUnhandledEvent = vi.fn()

    dispatchPhoenixEnvelope(makeEnvelope('ava.unknown'), { onUnhandledEvent })

    expect(onUnhandledEvent).toHaveBeenCalledTimes(1)
  })
})
