/**
 * InteractiveShellConfig Schema Tests
 *
 * Validates Schema.Class construction, default values,
 * and constraint satisfaction.
 */

import { describe, it, expect } from 'vitest'
import { Schema } from 'effect'
import { InteractiveShellConfig } from '../config'

describe('InteractiveShellConfig', () => {
  describe('default construction', () => {
    it('creates instance with all defaults', () => {
      const config = new InteractiveShellConfig({})
      expect(config.defaultCols).toBe(120)
      expect(config.defaultRows).toBe(24)
      expect(config.maxOutputBuffer).toBe(524288)
      expect(config.defaultMode).toBe('interactive')
      expect(config.defaultTimeout).toBe(0)
      expect(config.quietThreshold).toBe(5000)
      expect(config.completionNotifyLines).toBe(50)
      expect(config.completionNotifyMaxChars).toBe(5000)
      expect(config.poolMinSize).toBe(1)
      expect(config.poolMaxSize).toBe(8)
    })

    it('defaultShell falls back to /bin/bash', () => {
      const config = new InteractiveShellConfig({})
      // Should be process.env.SHELL or /bin/bash
      expect(typeof config.defaultShell).toBe('string')
      expect(config.defaultShell.length).toBeGreaterThan(0)
    })
  })

  describe('custom construction', () => {
    it('accepts custom values', () => {
      const config = new InteractiveShellConfig({
        defaultCols: 80,
        defaultRows: 40,
        maxOutputBuffer: 1024,
        defaultMode: 'dispatch',
        defaultTimeout: 30000,
        quietThreshold: 10000,
        poolMinSize: 2,
        poolMaxSize: 16,
      })
      expect(config.defaultCols).toBe(80)
      expect(config.defaultRows).toBe(40)
      expect(config.maxOutputBuffer).toBe(1024)
      expect(config.defaultMode).toBe('dispatch')
      expect(config.defaultTimeout).toBe(30000)
      expect(config.quietThreshold).toBe(10000)
      expect(config.poolMinSize).toBe(2)
      expect(config.poolMaxSize).toBe(16)
    })

    it('accepts hands-free mode', () => {
      const config = new InteractiveShellConfig({ defaultMode: 'hands-free' })
      expect(config.defaultMode).toBe('hands-free')
    })
  })

  describe('schema decode', () => {
    const decode = Schema.decodeUnknownSync(InteractiveShellConfig)

    it('decodes empty object to defaults', () => {
      const config = decode({})
      expect(config.defaultCols).toBe(120)
      expect(config.defaultRows).toBe(24)
    })

    it('decodes partial object', () => {
      const config = decode({ defaultCols: 200, poolMaxSize: 4 })
      expect(config.defaultCols).toBe(200)
      expect(config.poolMaxSize).toBe(4)
      // Others should be defaults
      expect(config.defaultRows).toBe(24)
    })

    it('rejects invalid mode literal', () => {
      expect(() => decode({ defaultMode: 'invalid' })).toThrow()
    })

    it('rejects non-number for numeric fields', () => {
      expect(() => decode({ defaultCols: 'wide' })).toThrow()
    })
  })

  describe('schema encode roundtrip', () => {
    const encode = Schema.encodeSync(InteractiveShellConfig)
    const decode = Schema.decodeUnknownSync(InteractiveShellConfig)

    it('encode → decode roundtrip preserves values', () => {
      const original = new InteractiveShellConfig({
        defaultCols: 160,
        defaultMode: 'dispatch',
        quietThreshold: 3000,
      })
      const encoded = encode(original)
      const decoded = decode(encoded)
      expect(decoded.defaultCols).toBe(160)
      expect(decoded.defaultMode).toBe('dispatch')
      expect(decoded.quietThreshold).toBe(3000)
    })
  })
})
