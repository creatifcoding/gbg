/**
 * SQLite Layer for Editor Persistence
 *
 * Provides SqlClient configured for local SQLite database.
 * Uses XDG-compliant path: ~/.local/share/tmnl/editor.db
 *
 * @module editor/v3/persistence/layer
 */

import { SqliteClient } from '@effect/sql-sqlite-bun';
import { Effect, Layer } from 'effect';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

import { AllRepositoriesLive } from './repositories';
import { runMigrations } from './migrations';

// =============================================================================
// Path Configuration
// =============================================================================

/**
 * Get the data directory for TMNL.
 * Uses XDG_DATA_HOME if set, otherwise ~/.local/share/tmnl
 */
const getDataDir = (): string => {
  const xdgDataHome = process.env['XDG_DATA_HOME'];
  if (xdgDataHome) {
    return path.join(xdgDataHome, 'tmnl');
  }
  return path.join(os.homedir(), '.local', 'share', 'tmnl');
};

/**
 * Get the SQLite database path.
 */
const getDatabasePath = (): string => {
  return path.join(getDataDir(), 'editor.db');
};

/**
 * Ensure the data directory exists.
 */
const ensureDataDir = Effect.sync(() => {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
});

// =============================================================================
// Layers
// =============================================================================

/**
 * SqliteClient layer with file-based database.
 * Creates the database file if it doesn't exist.
 */
export const SqliteClientLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    yield* ensureDataDir;
    const dbPath = getDatabasePath();

    yield* Effect.logInfo(`SQLite database path: ${dbPath}`);

    return SqliteClient.layer({
      filename: dbPath,
      disableWAL: false, // Enable WAL for better concurrency
    });
  })
);

/**
 * SqliteClient layer with in-memory database (for testing).
 */
export const SqliteClientTest = SqliteClient.layer({
  filename: ':memory:',
});

/**
 * Full persistence layer with migrations.
 * Runs migrations on startup.
 */
export const EditorPersistenceLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    // Run migrations after SqlClient is available
    return AllRepositoriesLive.pipe(
      Layer.tap(() => runMigrations),
      Layer.provide(SqliteClientLive)
    );
  })
);

/**
 * Test persistence layer with in-memory database.
 * Runs migrations on startup.
 */
export const EditorPersistenceTest = AllRepositoriesLive.pipe(
  Layer.tap(() => runMigrations),
  Layer.provide(SqliteClientTest)
);

// =============================================================================
// Exports
// =============================================================================

export { getDataDir, getDatabasePath };
