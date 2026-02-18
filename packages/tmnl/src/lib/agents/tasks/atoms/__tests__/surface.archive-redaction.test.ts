import { DateTime } from 'effect'
import { describe, expect, it } from 'vitest'

import { AgentTaskLogEntry } from '../../schemas'
import {
  ARCHIVE_REDACTED_VALUE,
  redactArchiveEntry,
  redactArchiveValue,
} from '../surface'

describe('archive redaction helpers', () => {
  it('redacts sensitive keys recursively in nested objects and arrays', () => {
    const redacted = redactArchiveValue({
      token: 'abc',
      headers: {
        authorization: 'Bearer x',
        cookie: 'session=123',
        nested: {
          apiKey: 'k-1',
          password: 'pw',
          allow: 'ok',
        },
      },
      items: [
        { secret: 's1', keep: 'v1' },
        { setCookie: 'sid=2', keep: 'v2' },
      ],
    }) as Record<string, unknown>

    expect(redacted.token).toBe(ARCHIVE_REDACTED_VALUE)
    expect((redacted.headers as Record<string, unknown>).authorization).toBe(
      ARCHIVE_REDACTED_VALUE,
    )
    expect((redacted.headers as Record<string, unknown>).cookie).toBe(
      ARCHIVE_REDACTED_VALUE,
    )

    const nested = (redacted.headers as Record<string, unknown>).nested as Record<
      string,
      unknown
    >
    expect(nested.apiKey).toBe(ARCHIVE_REDACTED_VALUE)
    expect(nested.password).toBe(ARCHIVE_REDACTED_VALUE)
    expect(nested.allow).toBe('ok')

    const firstItem = (redacted.items as Array<Record<string, unknown>>)[0]
    expect(firstItem?.secret).toBe(ARCHIVE_REDACTED_VALUE)
    expect(firstItem?.keep).toBe('v1')
  })

  it('creates a redacted archive copy without mutating the hot-lane entry', () => {
    const entry = new AgentTaskLogEntry({
      id: 'entry-1',
      timestamp: DateTime.unsafeNow(),
      level: 'INFO',
      source: 'redaction.test',
      message: 'message',
      metadata: {
        token: 'super-secret',
        safe: 'keep-me',
      },
      payload: {
        authorization: 'Bearer real-token',
        detail: 'still-visible',
      },
    })

    const archived = redactArchiveEntry(entry)

    expect((archived.metadata as Record<string, unknown>).token).toBe(
      ARCHIVE_REDACTED_VALUE,
    )
    expect((archived.metadata as Record<string, unknown>).safe).toBe('keep-me')
    expect((archived.payload as Record<string, unknown>).authorization).toBe(
      ARCHIVE_REDACTED_VALUE,
    )
    expect((archived.payload as Record<string, unknown>).detail).toBe('still-visible')

    // Hot lane entry must remain canonical (no forced in-place redaction).
    expect((entry.metadata as Record<string, unknown>).token).toBe('super-secret')
    expect((entry.payload as Record<string, unknown>).authorization).toBe(
      'Bearer real-token',
    )
  })
})
