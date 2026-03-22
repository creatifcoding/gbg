/**
 * @fileoverview Port component exports validation
 *
 * Verifies all Port compound components are properly exported.
 */

import { describe, it, expect } from 'vitest';

describe('Port component exports', () => {
  it('should export all Port compound components', async () => {
    const exports = await import('../components/Port');

    // Context & Provider
    expect(exports.PortProvider).toBeDefined();
    expect(exports.usePort).toBeDefined();

    // Core components
    expect(exports.PortItem).toBeDefined();
    expect(exports.PortBadge).toBeDefined();

    // Compound components
    expect(exports.PortSidebar).toBeDefined();
    expect(exports.PortTab).toBeDefined();
    expect(exports.PortTabList).toBeDefined();
    expect(exports.PortTabPanel).toBeDefined();
    expect(exports.PortActions).toBeDefined();
    expect(exports.PortAction).toBeDefined();
    expect(exports.PortNode).toBeDefined();

    // State machine
    expect(exports.portOps).toBeDefined();
    expect(exports.portMachine).toBeDefined();
    expect(exports.portStateValueAtom).toBeDefined();
  });
});
