import { existsSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

const SQLITE_LEDGER_ENV_KEY = 'HYPOTHESIS_LAB_LEDGER_SQLITE_PATH';

const defaultLedgerPath = resolve(
  process.cwd(),
  '.audit',
  'hypothesis-lab',
  'ledger.v1.sqlite'
);

const resolveLedgerPath = (): string => {
  const configured = process.env[SQLITE_LEDGER_ENV_KEY]?.trim();

  if (!configured) {
    return defaultLedgerPath;
  }

  return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
};

export const SQLITE_LEDGER_FILENAME = resolveLedgerPath();
export const SQLITE_LEDGER_FALLBACK_JSONL = resolve(
  dirname(SQLITE_LEDGER_FILENAME),
  'ledger.v1.fallback.jsonl'
);
export const SQLITE_LEDGER_TABLE = 'hypothesis_lab_audit_ledger';
export const SQLITE_LEDGER_ORDER_COLUMN = 'ledger_sequence';

const ensureLedgerDirectory = (filename: string): void => {
  const directory = dirname(filename);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
};

ensureLedgerDirectory(SQLITE_LEDGER_FILENAME);

export const sqliteLedgerBootstrapNotes = {
  envKey: SQLITE_LEDGER_ENV_KEY,
  defaultPath: defaultLedgerPath,
  table: SQLITE_LEDGER_TABLE,
  orderColumn: SQLITE_LEDGER_ORDER_COLUMN,
} as const;
