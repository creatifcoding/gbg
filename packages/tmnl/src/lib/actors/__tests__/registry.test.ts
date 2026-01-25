/**
 * ActorRegistry Tests
 *
 * Tests for the actor registry setup.
 *
 * @module lib/actors/__tests__/registry.test
 */

import { describe, it, expect } from 'vitest'
import { actorRegistry } from '../registry'

describe('ActorRegistry', () => {
  it('should be defined', () => {
    expect(actorRegistry).toBeDefined()
  })

  it('should be a valid registry object', () => {
    expect(typeof actorRegistry).toBe('object')
  })

  it('should not be null', () => {
    // Registry is properly initialized
    expect(actorRegistry).not.toBeNull()
  })
})
