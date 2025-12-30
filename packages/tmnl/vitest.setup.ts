import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { WebSocket } from 'ws';

// Polyfill WebSocket for Node.js (needed for NATS WebSocket connections in tests)
// @ts-expect-error - WebSocket global doesn't exist in Node
globalThis.WebSocket = WebSocket;

// Extend vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test case (for React tests)
afterEach(() => {
  cleanup();
});
