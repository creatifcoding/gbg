import type { Attachment } from '../schemas/attachment'
import type { AttachmentId, SpecimenId } from '../schemas/identifiers'
import type { CatalogSnapshot } from '../models/catalog-snapshot'

export function findAttachment(
  snapshot: CatalogSnapshot,
  id: AttachmentId | string,
): Attachment | undefined {
  return snapshot.attachments.find((item) => item.id === id)
}

export function attachmentsForSpecimen(
  snapshot: CatalogSnapshot,
  specimenId: SpecimenId | string,
): Attachment[] {
  return snapshot.attachments.filter((item) => item.specimenId === specimenId)
}

export function insertAttachment(
  snapshot: CatalogSnapshot,
  attachment: Attachment,
): CatalogSnapshot {
  return {
    ...snapshot,
    attachments: [...snapshot.attachments, attachment],
  }
}
