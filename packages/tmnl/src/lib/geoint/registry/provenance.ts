type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike }

const rightRotate = (value: number, amount: number) =>
  ((value >>> amount) | (value << (32 - amount))) >>> 0

const toHex = (value: number) => value.toString(16).padStart(8, '0')

const stableNormalize = (value: unknown): JsonLike => {
  if (value === null || value === undefined) return null

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
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

    return sortedKeys.reduce<Record<string, JsonLike>>((acc, key) => {
      acc[key] = stableNormalize(record[key])
      return acc
    }, {})
  }

  return String(value)
}

export const stableCanonicalJson = (value: unknown): string =>
  JSON.stringify(stableNormalize(value))

/**
 * Pure TypeScript SHA-256 implementation.
 *
 * Rationale: we need deterministic SHA-256 in both browser and Bun/Node code paths,
 * including synchronous call sites (entity factory/provenance construction).
 */
export const sha256Hex = (input: string): string => {
  const encoder = new TextEncoder()
  const bytes = Array.from(encoder.encode(input))

  const bitLength = bytes.length * 8

  // Append 1 bit (0x80), then pad with zeros so len % 64 === 56
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) {
    bytes.push(0)
  }

  // Append 64-bit big-endian length
  const high = Math.floor(bitLength / 0x100000000)
  const low = bitLength >>> 0
  bytes.push((high >>> 24) & 0xff)
  bytes.push((high >>> 16) & 0xff)
  bytes.push((high >>> 8) & 0xff)
  bytes.push(high & 0xff)
  bytes.push((low >>> 24) & 0xff)
  bytes.push((low >>> 16) & 0xff)
  bytes.push((low >>> 8) & 0xff)
  bytes.push(low & 0xff)

  let h0 = 0x6a09e667
  let h1 = 0xbb67ae85
  let h2 = 0x3c6ef372
  let h3 = 0xa54ff53a
  let h4 = 0x510e527f
  let h5 = 0x9b05688c
  let h6 = 0x1f83d9ab
  let h7 = 0x5be0cd19

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]

  for (let i = 0; i < bytes.length; i += 64) {
    const w = new Array<number>(64)

    for (let t = 0; t < 16; t += 1) {
      const j = i + t * 4
      w[t] = (
        (bytes[j] << 24) |
        (bytes[j + 1] << 16) |
        (bytes[j + 2] << 8) |
        bytes[j + 3]
      ) >>> 0
    }

    for (let t = 16; t < 64; t += 1) {
      const s0 = rightRotate(w[t - 15], 7) ^ rightRotate(w[t - 15], 18) ^ (w[t - 15] >>> 3)
      const s1 = rightRotate(w[t - 2], 17) ^ rightRotate(w[t - 2], 19) ^ (w[t - 2] >>> 10)
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0
    }

    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    let f = h5
    let g = h6
    let h = h7

    for (let t = 0; t < 64; t += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + s1 + ch + k[t] + w[t]) >>> 0
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (s0 + maj) >>> 0

      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
    h5 = (h5 + f) >>> 0
    h6 = (h6 + g) >>> 0
    h7 = (h7 + h) >>> 0
  }

  return `${toHex(h0)}${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h4)}${toHex(h5)}${toHex(h6)}${toHex(h7)}`
}

export const sha256HexOf = (value: unknown): string =>
  sha256Hex(stableCanonicalJson(value))

export const buildRequestResponseDigests = (
  requestPayload: unknown,
  responsePayload: unknown,
): { requestHash: string; responseHash: string } => ({
  requestHash: sha256HexOf(requestPayload),
  responseHash: sha256HexOf(responsePayload),
})
