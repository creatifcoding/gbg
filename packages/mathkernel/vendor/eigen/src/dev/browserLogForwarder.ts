/**
 * Dev-only browser log forwarder.
 *
 * Captures console errors + window errors and forwards them to the Vite dev server
 * so they show up in terminal logs (useful when debugging via Cursor browser).
 */

type LogLevel = 'log' | 'warn' | 'error' | 'unhandledrejection';

type BrowserLogEvent = {
  level: LogLevel;
  message: string;
  stack?: string;
  href: string;
  timestamp: number;
};

function safeStringify(value: unknown): string {
  try {
    if (value instanceof Error) {
      return `${value.name}: ${value.message}\n${value.stack ?? ''}`.trim();
    }
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function postLog(evt: BrowserLogEvent) {
  try {
    await fetch('/__tmnl/browser-log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(evt),
      keepalive: true,
    });
  } catch {
    // best-effort only
  }
}

export function installBrowserLogForwarder() {
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);

  console.error = (...args: unknown[]) => {
    void postLog({
      level: 'error',
      message: args.map(safeStringify).join(' '),
      href: window.location.href,
      timestamp: Date.now(),
    });
    origError(...args);
  };

  console.warn = (...args: unknown[]) => {
    void postLog({
      level: 'warn',
      message: args.map(safeStringify).join(' '),
      href: window.location.href,
      timestamp: Date.now(),
    });
    origWarn(...args);
  };

  window.addEventListener('error', (e) => {
    void postLog({
      level: 'error',
      message: e.message ?? 'window.error',
      stack: (e.error as Error | undefined)?.stack,
      href: window.location.href,
      timestamp: Date.now(),
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    void postLog({
      level: 'unhandledrejection',
      message: safeStringify(e.reason),
      href: window.location.href,
      timestamp: Date.now(),
    });
  });
}

