/**
 * Category registry tests — categoryOf classifier + config shape.
 */
import { describe, it, expect } from 'vitest'
import { categoryOf, SEVERITY_WEIGHT, type CategoryConfig } from '../category-registry'
import { ACCENT } from '../tokens'
import type { HarnessErrorCode } from '../../error-codes'

// ─── Every code from error-codes.ts ──────────────────────────────────────────

const ALL_CODES: HarnessErrorCode[] = [
  // StreamError
  'pi-ai-stream-init-failed', 'pi-ai-stream-failed', 'pi-ai-stream-result-failed',
  'stream-timeout', 'stream-result-timeout', 'stream-wallclock-timeout',
  'stream-fetch-timeout', 'stream-error',
  // NetworkError
  'network-unavailable',
  // SessionError
  'session-missing', 'session-not-found', 'session-load-failed', 'session-events-load-failed',
  // SessionCrudError
  'session-create-failed', 'session-delete-failed', 'session-rename-failed', 'session-list-failed',
  // ToolError
  'tool-execution-failed', 'tool-not-found', 'tool-timeout', 'tool-round-limit',
  'tool-bridge-failed', 'tool-runtime-error',
  // ModelError
  'model-catalog-failed', 'model-resolution-failed',
  // TimeoutError
  'harness-connect-timeout', 'harness-operation-timeout',
  // CompactionError
  'compaction-failed', 'compaction-skipped',
  // CriticalDefect
  'stream-defect', 'assistant-round-defect', 'session-prompt-defect', 'daemon-defect',
  // AdapterDefect
  'adapter-decode-error', 'adapter-state-error',
  // StoreDefect
  'store-write-failed', 'store-read-failed', 'store-corruption',
  // Interruption
  'aborted',
]

describe('categoryOf', () => {
  it('classifies every known code without throwing', () => {
    for (const code of ALL_CODES) {
      const config = categoryOf(code)
      expect(config, `categoryOf('${code}')`).toBeDefined()
      expect(config.key, `${code}.key`).toBeTruthy()
      expect(config.label, `${code}.label`).toBeTruthy()
      expect(config.Icon, `${code}.Icon`).toBeTruthy()
      expect(config.accent, `${code}.accent`).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(config.borderTint, `${code}.borderTint`).toContain('rgba(')
      expect(config.bgTint, `${code}.bgTint`).toContain('rgba(')
      expect(['error', 'warn', 'defect', 'info', 'silent']).toContain(config.severityLabel)
    }
  })

  it('returns actions array for every category', () => {
    for (const code of ALL_CODES) {
      const config = categoryOf(code)
      expect(Array.isArray(config.actions), `${code}.actions is array`).toBe(true)
      expect(config.actions.length, `${code}.actions.length`).toBeGreaterThan(0)
      // Every category has at least dismiss
      const hasDismiss = config.actions.some((a) => a.action === 'dismiss')
      expect(hasDismiss, `${code} has dismiss action`).toBe(true)
    }
  })

  it('maps stream codes to stream category', () => {
    const config = categoryOf('pi-ai-stream-failed')
    expect(config.key).toBe('stream