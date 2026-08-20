import type { Attachment } from '../schemas/attachment'
import type { AttachmentId, CardId } from '../schemas/identifiers'
import type { CatalogSnapshot } from '../models/catalog-snapshot'

export function findAttachment(
  snapshot: CatalogSnapshot,
  id: AttachmentId | string,
): Attachment | undefined {
  return snapshot.attachments.find((item) => item.id === id)
}

export function attachmentsForCard(
  snapshot: CatalogSnapshot,
  cardId: CardId | string,
): Attachment[] {
  return snapshot.attachments.filter((item) => item.cardId === cardId)
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
