import { FailClosedError } from './types.ts';

export const WRITE_KEYS = [
  'command',
  'actuate',
  'actuation',
  'setpoint',
  'move',
  'release',
  'energize',
  'enable-q1',
  'q1Enable',
  'latch',
  'door',
  'binder-release',
  'binderRelease',
  'rail-move',
  'railMove',
  'firmware',
  'override',
  'clear-latch',
  'clearLatch',
] as const;

const keyLooksLikeWrite = (key: string): boolean => {
  const normalized = key.replaceAll(/[_/]/g, '-').toLowerCase();
  return WRITE_KEYS.some(
    (banned) => normalized === banned.toLowerCase() || normalized.includes(banned.toLowerCase()),
  );
};

const walk = (value: unknown, path: string): void => {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, `${path}[${index}]`));
    return;
  }
  if (typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (keyLooksLikeWrite(key)) {
      throw new FailClosedError(`refused write-shaped key ${path}${key}`);
    }
    walk(nested, `${path}${key}.`);
  }
};

export const refuseWrite = (input: unknown): void => {
  if (input === null || typeof input !== 'object') return;
  walk(input, '');
};

export const READ_TOOL_ID = 'terrarium-sim-read';
export const READ_TOOL_DESCRIPTION =
  'Read the A4a simulated terrarium plant view and receipt-backed explanation. Not a gateway. Cannot command hardware.';
