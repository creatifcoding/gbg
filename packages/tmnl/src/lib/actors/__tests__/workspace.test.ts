/**
 * WorkspaceActor Tests
 *
 * Tests for workspace actor definition.
 *
 * @module lib/actors/__tests__/workspace.test
 */

import { describe, it, expect } from 'vitest'
import { workspace } from '../actors/workspace'

describe('WorkspaceActor', () => {
  it('should be defined', () => {
    expect(workspace).toBeDefined()
  })

  it('should be a valid actor definition', () => {
    // RivetKit actors are objects with internal structure
    expect(typeof workspace).toBe('object')
  })
})
