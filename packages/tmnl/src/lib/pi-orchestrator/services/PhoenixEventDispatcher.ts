import type { AvaPhoenixEnvelope } from '../client/PhoenixChannelClient'

export interface PhoenixEventSink {
  onArtifactUpdated?: (envelope: AvaPhoenixEnvelope) => void
  onArtifactCreated?: (envelope: AvaPhoenixEnvelope) => void
  onArtifactDeleted?: (envelope: AvaPhoenixEnvelope) => void
  onUnhandledEvent?: (envelope: AvaPhoenixEnvelope) => void
}

export const dispatchPhoenixEnvelope = (
  envelope: AvaPhoenixEnvelope,
  sink: PhoenixEventSink,
): void => {
  switch (envelope.event_type) {
    case 'ava.artifact.updated':
      sink.onArtifactUpdated?.(envelope)
      break
    case 'ava.artifact.created':
      sink.onArtifactCreated?.(envelope)
      break
    case 'ava.artifact.deleted':
      sink.onArtifactDeleted?.(envelope)
      break
    default:
      sink.onUnhandledEvent?.(envelope)
      break
  }
}
