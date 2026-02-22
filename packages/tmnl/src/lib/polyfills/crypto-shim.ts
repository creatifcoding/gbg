/**
 * Crypto Shim for Browser Compatibility
 *
 * The AI SDK uses Node's crypto.randomUUID, but Vite externalizes
 * the crypto module for browser builds. This shim provides the
 * necessary functions using the browser's native Web Crypto API.
 *
 * @module polyfills/crypto-shim
 */

// Re-export randomUUID from the browser's native crypto API
export const randomUUID = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // Fallback for older browsers (shouldn't be needed for modern browsers)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Node.js-compatible randomBytes (used by tweetnacl/nats.ws)
export const randomBytes = (size: number): Uint8Array => {
  const buf = new Uint8Array(size);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(buf);
  }
  return buf;
};

export const getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
  if (array && globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(array);
  }
  throw new Error('crypto.getRandomValues not available');
};

// Node.js crypto compat: createHash, createHmac (stubs for non-critical paths)
export const createHash = () => ({
  update: () => ({ digest: () => '' }),
});
export const createHmac = () => ({
  update: () => ({ digest: () => '' }),
});

// Export the entire crypto object
export default {
  randomUUID,
  randomBytes,
  getRandomValues,
  subtle: globalThis.crypto?.subtle,
  createHash,
  createHmac,
};
