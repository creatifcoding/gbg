declare module '@duckdb/node-api' {
  export class DuckDBInstance {
    static create(path?: string): Promise<DuckDBInstance>
    connect(): Promise<{
      run: (sql: string, params?: unknown[]) => Promise<unknown>
      runAndReadAll: (
        sql: string,
        params?: unknown[],
      ) => Promise<{
        getRowObjectsJson?: () => Array<Record<string, unknown>>
        getRowObjects?: () => Array<Record<string, unknown>>
      }>
      closeSync?: () => void
      close?: () => Promise<void>
    }>
  }
}
