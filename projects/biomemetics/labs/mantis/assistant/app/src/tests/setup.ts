import '@testing-library/jest-dom/vitest';

let seq = 0;
if (!globalThis.crypto.randomUUID) {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: () => {
      seq += 1;
      const hex = seq.toString(16).padStart(12, '0');
      return `00000000-0000-4000-8000-${hex}`;
    },
    configurable: true,
  });
} else {
  const original = globalThis.crypto.randomUUID.bind(globalThis.crypto);
  globalThis.crypto.randomUUID = () => {
    seq += 1;
    try {
      return original();
    } catch {
      const hex = seq.toString(16).padStart(12, '0');
      return `00000000-0000-4000-8000-${hex}`;
    }
  };
}
