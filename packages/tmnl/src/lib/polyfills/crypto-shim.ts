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

// Export the entire crypto object with randomUUID
export default {
  randomUUID,
  // Proxy other crypto methods to the native API
  getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
    if (array && globalThis.crypto?.getRandomValues) {
      return globalThis.crypto.getRandomValues(array);
    }
    throw new Error('crypto.getRandomValues not available');
  },
  subtle: globalThis.crypto?.subtle,
};
