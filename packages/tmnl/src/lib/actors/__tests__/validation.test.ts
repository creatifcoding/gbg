/**
 * Validation Tests - Effect Schema Wrappers
 *
 * Tests for Effect Schema validation layer that wraps RivetKit APIs.
 * Ensures invalid data is caught BEFORE reaching RivetKit's Zod.
 *
 * @module lib/actors/__tests__/validation.test
 */

import { describe, it, expect } from 'vitest'
import { Schema, Either } from 'effect'
import {
  CreateBufferParams,
  OpenBufferParams,
  CloseBufferParams,
  CreateTabParams,
  CreateWindowParams,
  UpdateTabParams,
  UpdateWindowParams,
  validateParamsSync,
} from '../schemas/actions'
import {
  RegistryConfigSchema,
  ActorConfigSchema,
  RivetConfigError,
  ActorConfigError,
} from '../schemas/rivet-config'

// =============================================================================
// Action Parameter Validation Tests
// =============================================================================

describe('CreateBufferParams Validation', () => {
  it('validates valid params', () => {
    const params = {
      userId: 'user-1',
      type: 'document',
      name: 'Test Buffer',
      uri: 'ydoc://test',
    }

    const result = Schema.decodeUnknownSync(CreateBufferParams)(params)
    expect(result.name).toBe('Test Buffer')
    expect(result.type).toBe('document')
  })

  it('validates params with options', () => {
    const params = {
      userId: 'user-1',
      type: 'document',
      name: 'Test Buffer',
      uri: 'ydoc://test',
      options: {
        ysweetDocId: 'doc-123',
        filePath: '/path/to/file.md',
      },
    }

    const result = Schema.decodeUnknownSync(CreateBufferParams)(params)
    expect(result.options?.ysweetDocId).toBe('doc-123')
    expect(result.options?.filePath).toBe('/path/to/file.md')
  })

  it('rejects invalid buffer type', () => {
    const params = {
      userId: 'user-1',
      type: 'invalid-type',
      name: 'Test',
      uri: 'ydoc://test',
    }

    expect(() => Schema.decodeUnknownSync(CreateBufferParams)(params)).toThrow()
  })

  it('rejects empty name', () => {
    const params = {
      userId: 'user-1',
      type: 'document',
      name: '',
      uri: 'ydoc://test',
    }

    expect(() => Schema.decodeUnknownSync(CreateBufferParams)(params)).toThrow()
  })

  it('rejects missing required fields', () => {
    const params = {
      userId: 'user-1',
      type: 'document',
      // name is missing
      uri: 'ydoc://test',
    }

    expect(() => Schema.decodeUnknownSync(CreateBufferParams)(params)).toThrow()
  })
})

describe('OpenBufferParams Validation', () => {
  it('validates valid params', () => {
    const params = {
      userId: 'user-1',
      bufferId: 'buffer-abc123',
    }

    const result = Schema.decodeUnknownSync(OpenBufferParams)(params)
    expect(result.userId).toBe('user-1')
    expect(result.bufferId).toBe('buffer-abc123')
  })

  it('rejects missing userId', () => {
    const params = {
      bufferId: 'buffer-abc123',
    }

    expect(() => Schema.decodeUnknownSync(OpenBufferParams)(params)).toThrow()
  })
})

describe('CreateTabParams Validation', () => {
  it('validates valid params', () => {
    const params = {
      name: 'New Tab',
    }

    const result = Schema.decodeUnknownSync(CreateTabParams)(params)
    expect(result.name).toBe('New Tab')
  })

  it('validates params with options', () => {
    const params = {
      name: 'Pinned Tab',
      options: {
        isPinned: true,
        layout: { type: 'split', direction: 'horizontal' },
      },
    }

    const result = Schema.decodeUnknownSync(CreateTabParams)(params)
    expect(result.options?.isPinned).toBe(true)
    expect(result.options?.layout).toEqual({ type: 'split', direction: 'horizontal' })
  })

  it('rejects empty name', () => {
    const params = {
      name: '',
    }

    expect(() => Schema.decodeUnknownSync(CreateTabParams)(params)).toThrow()
  })
})

describe('CreateWindowParams Validation', () => {
  it('validates valid params', () => {
    const params = {
      bufferId: 'buffer-abc123',
    }

    const result = Schema.decodeUnknownSync(CreateWindowParams)(params)
    expect(result.bufferId).toBe('buffer-abc123')
  })

  it('validates params with majorMode', () => {
    const params = {
      bufferId: 'buffer-abc123',
      majorMode: 'typescript',
    }

    const result = Schema.decodeUnknownSync(CreateWindowParams)(params)
    expect(result.majorMode).toBe('typescript')
  })
})

describe('UpdateTabParams Validation', () => {
  it('validates valid params', () => {
    const params = {
      tabId: 'tab-123',
      updates: {
        name: 'Renamed Tab',
        isPinned: true,
      },
    }

    const result = Schema.decodeUnknownSync(UpdateTabParams)(params)
    expect(result.updates.name).toBe('Renamed Tab')
    expect(result.updates.isPinned).toBe(true)
  })

  it('validates empty updates', () => {
    const params = {
      tabId: 'tab-123',
      updates: {},
    }

    const result = Schema.decodeUnknownSync(UpdateTabParams)(params)
    expect(result.updates).toEqual({})
  })
})

describe('UpdateWindowParams Validation', () => {
  it('validates valid params with scroll', () => {
    const params = {
      windowId: 'win-123',
      updates: {
        scroll: { x: 0, y: 100 },
      },
    }

    const result = Schema.decodeUnknownSync(UpdateWindowParams)(params)
    expect(result.updates.scroll?.y).toBe(100)
  })

  it('validates valid params with cursor', () => {
    const params = {
      windowId: 'win-123',
      updates: {
        cursor: {
          offset: 42,
          line: 10,
          column: 5,
        },
      },
    }

    const result = Schema.decodeUnknownSync(UpdateWindowParams)(params)
    expect(result.updates.cursor?.offset).toBe(42)
    expect(result.updates.cursor?.line).toBe(10)
  })

  it('validates valid params with mode', () => {
    const params = {
      windowId: 'win-123',
      updates: {
        mode: {
          major: 'typescript',
          minor: ['lsp', 'prettier'],
        },
      },
    }

    const result = Schema.decodeUnknownSync(UpdateWindowParams)(params)
    expect(result.updates.mode?.major).toBe('typescript')
    expect(result.updates.mode?.minor).toEqual(['lsp', 'prettier'])
  })
})

// =============================================================================
// Registry Config Validation Tests
// =============================================================================

describe('RegistryConfigSchema Validation', () => {
  it('validates valid config', () => {
    const config = {
      use: {
        workspace: { state: {}, actions: {} },
        session: { state: {}, actions: {} },
      },
    }

    const result = Schema.decodeUnknownSync(RegistryConfigSchema)(config)
    expect(result.use).toBeDefined()
    expect(Object.keys(result.use)).toContain('workspace')
    expect(Object.keys(result.use)).toContain('session')
  })

  it('rejects missing use property', () => {
    const config = {}

    expect(() => Schema.decodeUnknownSync(RegistryConfigSchema)(config)).toThrow()
  })

  it('validates empty use object', () => {
    const config = {
      use: {},
    }

    // Empty use is technically valid (no actors registered)
    const result = Schema.decodeUnknownSync(RegistryConfigSchema)(config)
    expect(result.use).toEqual({})
  })
})

// =============================================================================
// Actor Config Validation Tests
// =============================================================================

describe('ActorConfigSchema Validation', () => {
  it('validates valid actor config', () => {
    const config = {
      state: { count: 0 },
      actions: {
        increment: () => {},
        decrement: () => {},
      },
    }

    const result = Schema.decodeUnknownSync(ActorConfigSchema)(config)
    expect(result.actions).toBeDefined()
  })

  it('validates config with options', () => {
    const config = {
      state: { count: 0 },
      actions: {
        increment: () => {},
      },
      options: {
        stateSaveInterval: 1000,
        actionTimeout: 5000,
      },
    }

    const result = Schema.decodeUnknownSync(ActorConfigSchema)(config)
    expect(result.options?.stateSaveInterval).toBe(1000)
    expect(result.options?.actionTimeout).toBe(5000)
  })

  it('validates config with lifecycle hooks', () => {
    const config = {
      state: { count: 0 },
      actions: {},
      onCreate: () => {},
      onDestroy: () => {},
    }

    const result = Schema.decodeUnknownSync(ActorConfigSchema)(config)
    expect(result.onCreate).toBeDefined()
    expect(result.onDestroy).toBeDefined()
  })

  it('rejects missing actions property', () => {
    const config = {
      state: { count: 0 },
      // actions is missing
    }

    expect(() => Schema.decodeUnknownSync(ActorConfigSchema)(config)).toThrow()
  })
})

// =============================================================================
// validateParamsSync Helper Tests
// =============================================================================

describe('validateParamsSync Helper', () => {
  it('returns validated params on success', () => {
    const params = validateParamsSync(CreateBufferParams)({
      userId: 'user-1',
      type: 'document',
      name: 'Test',
      uri: 'ydoc://test',
    })

    expect(params.name).toBe('Test')
    expect(params.type).toBe('document')
  })

  it('throws on validation failure', () => {
    expect(() =>
      validateParamsSync(CreateBufferParams)({
        userId: 'user-1',
        type: 'invalid',
        name: '',
        uri: 'ydoc://test',
      })
    ).toThrow()
  })
})

// =============================================================================
// Error Types Tests
// =============================================================================

describe('Error Types', () => {
  it('RivetConfigError has correct properties', () => {
    const error = new RivetConfigError('Test error', 'registry', 'use.workspace')

    expect(error._tag).toBe('RivetConfigError')
    expect(error.context).toBe('registry')
    expect(error.path).toBe('use.workspace')
    expect(error.message).toBe('Test error')
  })

  it('ActorConfigError has correct properties', () => {
    const error = new ActorConfigError('Test error', 'workspace')

    expect(error._tag).toBe('ActorConfigError')
    expect(error.actorName).toBe('workspace')
    expect(error.message).toBe('Test error')
  })
})
