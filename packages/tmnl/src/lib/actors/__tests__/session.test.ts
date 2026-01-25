/**
 * SessionActor Tests
 *
 * Tests for session actor definition.
 *
 * @module lib/actors/__tests__/session.test
 */

import { describe, it, expect } from 'vitest'
import { session } from '../actors/session'

describe('SessionActor', () => {
  it('should be defined', () => {
    expect(session).toBeDefined()
  })

  it('should be a valid actor definition', () => {
    // RivetKit actors are objects with internal structure
    expect(typeof session).toBe('object')
  })
})
