/**
 * TheiaTestbed
 *
 * Test harness for the Theia IDE integration.
 * Validates server lifecycle and panel embedding.
 *
 * Route: /testbed/theia
 */

import * as React from 'react';
import { TheiaPanel } from '@/lib/theia';

export function TheiaTestbed() {
  return (
    <div
      className="h-screen w-screen flex flex-col"
      style={{
        backgroundColor: 'var(--tmnl-void, #000)',
        color: 'var(--tmnl-text-primary, #e5e5e5)',
      }}
    >
      {/* Header */}
      <div
        className="p-4 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--tmnl-border, #333)' }}
      >
        <h1
          className="font-mono font-bold"
          style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
        >
          Theia IDE Testbed
        </h1>
        <div
          className="font-mono"
          style={{
            fontSize: 'var(--tmnl-text-xs, 12px)',
            color: 'var(--tmnl-text-muted, #666)',
          }}
        >
          Browser-only mode • Port 3035
        </div>
      </div>

      {/* Panel */}
      <div className="flex-1 p-4">
        <TheiaPanel
          panelId="testbed-main"
          autoStart={true}
          className="h-full rounded-lg overflow-hidden"
        />
      </div>
    </div>
  );
}

export default TheiaTestbed;
