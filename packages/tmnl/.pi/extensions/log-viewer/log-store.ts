/**
 * @deprecated Use shared logging integration directly.
 *
 * Compatibility adapter that exposes the previous LogStore API while delegating
 * to the shared Effect-first logging service.
 */

import * as path from 'node:path'
import { getLoggingIntegration } from '../shared/logging/index.ts'
import type { LogEntry, LogLevel } from './types.ts'

export class LogStore {
  private readonly integration = getLoggingIntegration()

  constructor(_piDir: string = path.join(process.cwd(), '.pi')) {}

  onChange(fn: () => void): () => void {
    return this.integration.store.onChange(fn)
  }

  add(source: string, level: LogLevel, message: string) {
    this.integration.store.add(source, level, message)
  }

  getAll(): readonly LogEntry[] {
    return this.integration.store.getAll()
  }

  getFiltered(levels: Set<LogLevel>, sourceFilter: string): LogEntry[] {
    return this.integration.store.getFiltered(levels, sourceFilter)
  }

  getLast(n: number): LogEntry[] {
    return this.integration.store.getLast(n)
  }

  getSources(): string[] {
    return this.integration.store.getSources()
  }

  get size(): number {
    return this.integration.store.size
  }

  clear() {
    this.integration.store.clear()
  }
}
