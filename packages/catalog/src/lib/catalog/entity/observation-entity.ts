import { decodeObservation, type Observation } from '../schemas/observation'
import type { AttachmentId } from '../schemas/identifiers'

export function attachToObservation(
  observation: Observation,
  attachmentId: AttachmentId,
): Observation {
  if (observation.attachmentIds.includes(attachmentId)) return observation
  return decodeObservation({
    ...observation,
    attachmentIds: [...observation.attachmentIds, attachmentId],
  })
}
