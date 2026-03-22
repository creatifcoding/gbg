import { Schema } from 'effect'
import { TransferReferenceTokenSchema, type TransferReferenceToken } from './types'

export const TRANSFER_REFERENCE_MIME = 'application/x.tmnl.reference+json'
export const TRANSFER_REFERENCE_TEXT_PREFIX = '@ref:'
export const TRANSFER_REFERENCE_SET_TEXT_PREFIX = '@refset:'

const decodeTransferToken = Schema.decodeUnknownSync(TransferReferenceTokenSchema)
const decodeTransferTokenArray = Schema.decodeUnknownSync(Schema.Array(TransferReferenceTokenSchema))

export function encodeTransferToken(token: TransferReferenceToken): string {
  return JSON.stringify(token)
}

export function decodeTransferTokenOrNull(input: unknown): TransferReferenceToken | null {
  try {
    return decodeTransferToken(input)
  } catch {
    return null
  }
}

export function decodeTransferTokensOrNull(input: unknown): ReadonlyArray<TransferReferenceToken> | null {
  try {
    return decodeTransferTokenArray(input)
  } catch {
    return null
  }
}

function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function decodeBase64Utf8(value: string): string {
  const binary = atob(value)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function toReferenceClipboardText(token: TransferReferenceToken): string {
  const encoded = encodeTransferToken(token)
  return `${TRANSFER_REFERENCE_TEXT_PREFIX}${encodeBase64Utf8(encoded)}`
}

export function fromReferenceClipboardText(text: string): TransferReferenceToken | null {
  if (!text.startsWith(TRANSFER_REFERENCE_TEXT_PREFIX)) {
    return null
  }

  const encoded = text.slice(TRANSFER_REFERENCE_TEXT_PREFIX.length)
  if (!encoded) {
    return null
  }

  try {
    const json = decodeBase64Utf8(encoded)
    const parsed = JSON.parse(json)
    return decodeTransferTokenOrNull(parsed)
  } catch {
    return null
  }
}

export function toReferenceClipboardTextList(tokens: ReadonlyArray<TransferReferenceToken>): string {
  if (tokens.length === 0) {
    return ''
  }

  if (tokens.length === 1) {
    return toReferenceClipboardText(tokens[0])
  }

  const encoded = encodeBase64Utf8(JSON.stringify(tokens))
  return `${TRANSFER_REFERENCE_SET_TEXT_PREFIX}${encoded}`
}

export function fromReferenceClipboardTextList(text: string): ReadonlyArray<TransferReferenceToken> {
  if (!text) {
    return []
  }

  if (text.startsWith(TRANSFER_REFERENCE_SET_TEXT_PREFIX)) {
    const encoded = text.slice(TRANSFER_REFERENCE_SET_TEXT_PREFIX.length)
    if (!encoded) {
      return []
    }

    try {
      const json = decodeBase64Utf8(encoded)
      const parsed = JSON.parse(json)
      return decodeTransferTokenArray(parsed)
    } catch {
      return []
    }
  }

  const single = fromReferenceClipboardText(text)
  return single ? [single] : []
}
