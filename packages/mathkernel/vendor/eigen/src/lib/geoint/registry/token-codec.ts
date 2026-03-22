import { Schema } from 'effect'
import type { PagingMode } from './schemas'

const TOKEN_PREFIX = 'gtr1'
const DEFAULT_TOKEN_SECRET = 'tmnl-geoint-dev-secret'
const MAX_CLOCK_SKEW_MS = 60_000

export interface ContinuationState {
  readonly mode: PagingMode
  readonly cursor?: string
  readonly offset?: number
  readonly nextHref?: string
  readonly providerState?: unknown
}

export interface EncodeContinuationTokenOptions {
  readonly query: unknown
  readonly state: ContinuationState
  readonly ttlSeconds: number
  readonly nowMs?: number
  readonly secret?: string
}

export interface DecodeContinuationTokenOptions {
  readonly token: string
  readonly expectedQuery?: unknown
  readonly expectedQueryHash?: string
  readonly nowMs?: number
  readonly secret?: string
}

export interface DecodedContinuationToken {
  readonly tokenVersion: 'geoint.registry.v1'
  readonly queryHash: string
  readonly issuedAt: number
  readonly expiresAt: number
  readonly state: ContinuationState
}

export class TokenCodecError extends Error {
  readonly _tag = 'TokenCodecError'

  constructor(
    readonly code:
      | 'INVALID_TOKEN'
      | 'INVALID_SIGNATURE'
      | 'EXPIRED_TOKEN'
      | 'QUERY_HASH_MISMATCH'
      | 'INVALID_PAYLOAD'
      | 'CRYPTO_UNAVAILABLE',
    message: string
  ) {
    super(message)
    this.name = 'TokenCodecError'
  }
}

const ContinuationStateSchema = Schema.Struct({
  mode: Schema.Literal('link', 'token', 'offset'),
  cursor: Schema.optional(Schema.String),
  offset: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))),
  nextHref: Schema.optional(Schema.String),
  providerState: Schema.optional(Schema.Unknown),
})

const ContinuationTokenPayloadSchema = Schema.Struct({
  v: Schema.Literal('geoint.registry.v1'),
  qh: Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/i)),
  iat: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  exp: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  state: ContinuationStateSchema,
})

const decodePayload = Schema.decodeUnknownSync(ContinuationTokenPayloadSchema)

const textEncoder = new TextEncoder()

const bufferCtor = (globalThis as unknown as {
  Buffer?: { from: (input: Uint8Array | string, encoding?: string) => { toString: (enc: string) => string } }
}).Buffer

const bytesToBase64 = (bytes: Uint8Array): string => {
  if (typeof btoa === 'function') {
    let binary = ''
    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index])
    }
    return btoa(binary)
  }

  if (bufferCtor) {
    return bufferCtor.from(bytes).toString('base64')
  }

  throw new TokenCodecError('CRYPTO_UNAVAILABLE', 'No base64 encoder available in runtime')
}

const base64ToBytes = (base64: string): Uint8Array => {
  if (typeof atob === 'function') {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes
  }

  if (bufferCtor) {
    const base64Decoded = bufferCtor.from(base64, 'base64').toString('binary')
    const bytes = new Uint8Array(base64Decoded.length)
    for (let index = 0; index < base64Decoded.length; index += 1) {
      bytes[index] = base64Decoded.charCodeAt(index)
    }
    return bytes
  }

  throw new TokenCodecError('CRYPTO_UNAVAILABLE', 'No base64 decoder available in runtime')
}

const toBase64Url = (bytes: Uint8Array): string =>
  bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

const fromBase64Url = (value: string): Uint8Array => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  return base64ToBytes(padded)
}

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

const stableNormalize = (value: unknown): unknown => {
  if (value === null || value === undefined) return value

  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Array.isArray(value)) {
    return value.map(stableNormalize)
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const sortedKeys = Object.keys(record).sort((a, b) => a.localeCompare(b))

    return sortedKeys.reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = stableNormalize(record[key])
      return acc
    }, {})
  }

  return String(value)
}

const stableStringify = (value: unknown): string => JSON.stringify(stableNormalize(value))

const timingSafeEquals = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false

  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return diff === 0
}

const resolveSecret = (secret?: string): string => {
  if (secret && secret.length > 0) return secret

  const envSecret =
    typeof process !== 'undefined' && process?.env ? process.env.GEOINT_TOKEN_SECRET : undefined

  return envSecret && envSecret.length > 0 ? envSecret : DEFAULT_TOKEN_SECRET
}

const ensureCrypto = (): Crypto => {
  if (!globalThis.crypto?.subtle) {
    throw new TokenCodecError('CRYPTO_UNAVAILABLE', 'Web Crypto subtle API is unavailable')
  }

  return globalThis.crypto
}

const hmacBase64Url = async (secret: string, data: string): Promise<string> => {
  const crypto = ensureCrypto()

  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(data))
  return toBase64Url(new Uint8Array(signature))
}

export const hashQuery = async (query: unknown): Promise<string> => {
  const crypto = ensureCrypto()
  const normalized = stableStringify(query)
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(normalized))

  return toHex(new Uint8Array(digest))
}

export const encodeContinuationToken = async ({
  query,
  state,
  ttlSeconds,
  nowMs,
  secret,
}: EncodeContinuationTokenOptions): Promise<string> => {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    throw new TokenCodecError('INVALID_PAYLOAD', 'ttlSeconds must be a positive finite number')
  }

  const issuedAt = nowMs ?? Date.now()
  const expiresAt = issuedAt + ttlSeconds * 1000
  const queryHash = await hashQuery(query)

  const payload = {
    v: 'geoint.registry.v1' as const,
    qh: queryHash,
    iat: issuedAt,
    exp: expiresAt,
    state,
  }

  const payloadBytes = textEncoder.encode(JSON.stringify(payload))
  const payloadEncoded = toBase64Url(payloadBytes)
  const signingInput = `${TOKEN_PREFIX}.${payloadEncoded}`

  const signature = await hmacBase64Url(resolveSecret(secret), signingInput)

  return `${TOKEN_PREFIX}.${payloadEncoded}.${signature}`
}

export const decodeContinuationToken = async ({
  token,
  expectedQuery,
  expectedQueryHash,
  nowMs,
  secret,
}: DecodeContinuationTokenOptions): Promise<DecodedContinuationToken> => {
  const parts = token.split('.')

  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) {
    throw new TokenCodecError('INVALID_TOKEN', 'Invalid token format')
  }

  const [prefix, payloadEncoded, signature] = parts
  const signingInput = `${prefix}.${payloadEncoded}`
  const expectedSignature = await hmacBase64Url(resolveSecret(secret), signingInput)

  if (!timingSafeEquals(signature, expectedSignature)) {
    throw new TokenCodecError('INVALID_SIGNATURE', 'Token signature verification failed')
  }

  const payloadBytes = fromBase64Url(payloadEncoded)
  const payloadText = new TextDecoder().decode(payloadBytes)

  let parsed: unknown
  try {
    parsed = JSON.parse(payloadText)
  } catch {
    throw new TokenCodecError('INVALID_PAYLOAD', 'Token payload is not valid JSON')
  }

  let payload: ReturnType<typeof decodePayload>
  try {
    payload = decodePayload(parsed)
  } catch {
    throw new TokenCodecError('INVALID_PAYLOAD', 'Token payload does not match schema')
  }

  const currentTime = nowMs ?? Date.now()
  if (payload.exp < currentTime) {
    throw new TokenCodecError('EXPIRED_TOKEN', 'Token has expired')
  }

  if (payload.iat > currentTime + MAX_CLOCK_SKEW_MS) {
    throw new TokenCodecError('INVALID_PAYLOAD', 'Token issued-at timestamp is invalid')
  }

  const expectedHash = expectedQueryHash ?? (expectedQuery ? await hashQuery(expectedQuery) : undefined)

  if (expectedHash && payload.qh !== expectedHash) {
    throw new TokenCodecError('QUERY_HASH_MISMATCH', 'Token does not match expected query hash')
  }

  return {
    tokenVersion: payload.v,
    queryHash: payload.qh,
    issuedAt: payload.iat,
    expiresAt: payload.exp,
    state: payload.state,
  }
}
