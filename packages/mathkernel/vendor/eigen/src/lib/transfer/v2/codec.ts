/**
 * Transfer v2 Codec
 *
 * Encode/decode TransferToken[] to clipboard text format.
 * Supports v1 → v2 upgrade on decode.
 *
 * Wire format:
 *   Single token:  @ref:<base64(json)>
 *   Multi token:   @refset:<base64(json[])>
 *
 * See: src/lib/transfer/docs/redesign/02-transfer-schema-redesign.md §Codec Changes
 *
 * @since v2
 */
import { Schema, Either } from 'effect'
import { TransferToken } from './schemas'
import { TransferDecodeError } from './errors'

// ── Constants ────────────────────────────────────────────────

export const TRANSFER_MIME = 'application/x.tmnl.reference+json'
export const REF_PREFIX = '@ref:'
export const REFSET_PREFIX = '@refset:'

// ── Decoders ─────────────────────────────────────────────────

const decodeToken = Schema.decodeUnknownEither(TransferToken)
const decodeTokenArray = Schema.decodeUnknownEither(Schema.Array(TransferToken))

// ── Base64 helpers ───────────────────────────────────────────

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function decodeBase64(value: string): string {
  const binary = atob(value)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

// ── v1 → v2 upgrade ─────────────────────────────────────────

/**
 * Attempt to upgrade a v1 token shape to v2.
 * - Flattens `origin` into top-level fields
 * - Renames `reference` → `ref`
 * - Remaps `_tag` values: TransferTaskReference → TaskRef, TransferTaskClusterReference → ClusterRef
 * - Renames `referenceId` → `id`
 * - Sets version to '2'
 */
function upgradeV1(raw: Record<string, unknown>): Record<string, unknown> {
  if (raw.version !== '1') return raw

  const origin = (raw.origin ?? {}) as Record<string, unknown>
  const reference = (raw.reference ?? {}) as Record<string, unknown>

  // Remap v1 _tag to v2 _tag
  const oldTag = reference._tag as string | undefined
  let newTag = oldTag
  if (oldTag === 'TransferTaskReference') newTag = 'TaskRef'
  else if (oldTag === 'TransferTaskClusterReference') newTag = 'ClusterRef'

  // Rename referenceId → id
  const refFields = { ...reference, _tag: newTag }
  if ('referenceId' in refFields) {
    refFields.id = refFields.referenceId
    delete refFields.referenceId
  }

  return {
    tokenId: raw.tokenId,
    version: '2',
    surfaceId: origin.surfaceId,
    sourceId: origin.sourceId,
    sourceLabel: origin.sourceLabel,
    threadId: origin.threadId,
    agentId: origin.agentId,
    ref: refFields,
    createdAt: raw.createdAt,
  }
}

// ── Encode ───────────────────────────────────────────────────

/** Encode a single token to clipboard text */
export function encodeTokenText(token: TransferToken): string {
  return `${REF_PREFIX}${encodeBase64(JSON.stringify(token))}`
}

/** Encode multiple tokens to clipboard text */
export function encodeTokensText(tokens: ReadonlyArray<TransferToken>): string {
  if (tokens.length === 0) return ''
  if (tokens.length === 1) return encodeTokenText(tokens[0])
  return `${REFSET_PREFIX}${encodeBase64(JSON.stringify(tokens))}`
}

// ── Decode ───────────────────────────────────────────────────

/** Decode clipboard text → tokens. Handles v1 upgrade. */
export function decodeTokensText(
  text: string,
): Either.Either<ReadonlyArray<TransferToken>, TransferDecodeError> {
  if (!text) return Either.right([])

  try {
    if (text.startsWith(REFSET_PREFIX)) {
      const encoded = text.slice(REFSET_PREFIX.length)
      if (!encoded) return Either.right([])
      const json = decodeBase64(encoded)
      const parsed = JSON.parse(json) as unknown[]
      const upgraded = parsed.map((item) =>
        typeof item === 'object' && item !== null
          ? upgradeV1(item as Record<string, unknown>)
          : item,
      )
      return Either.mapLeft(
        decodeTokenArray(upgraded),
        (cause) => new TransferDecodeError({ input: text, cause }),
      )
    }

    if (text.startsWith(REF_PREFIX)) {
      const encoded = text.slice(REF_PREFIX.length)
      if (!encoded) return Either.right([])
      const json = decodeBase64(encoded)
      const parsed = JSON.parse(json)
      const upgraded = typeof parsed === 'object' && parsed !== null
        ? upgradeV1(parsed as Record<string, unknown>)
        : parsed
      const result = decodeToken(upgraded)
      return Either.map(
        Either.mapLeft(
          result,
          (cause) => new TransferDecodeError({ input: text, cause }),
        ),
        (token) => [token],
      )
    }

    return Either.right([])
  } catch (cause) {
    return Either.left(new TransferDecodeError({ input: text, cause }))
  }
}

/** Decode clipboard text → tokens, returning empty array on failure. */
export function decodeTokensTextOrEmpty(text: string): ReadonlyArray<TransferToken> {
  return Either.getOrElse(decodeTokensText(text), () => [])
}
