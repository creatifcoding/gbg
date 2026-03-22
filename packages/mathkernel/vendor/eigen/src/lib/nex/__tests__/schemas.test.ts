/**
 * NEX Schemas Tests
 *
 * Validates Effect Schema definitions for NEX protocol messages.
 */

import { describe, it, expect } from 'vitest'
import { Schema } from 'effect'
import {
  AuctionRequest,
  AuctionResponse,
  StartWorkloadRequest,
  WorkloadDeployResponse,
  WorkloadListResponse,
  RpcRequest,
  RpcResponse,
  WorkloadStartedEvent,
  WorkloadStoppedEvent,
  NexEvent,
  LogEntry,
} from '../schemas'

describe('NEX Schemas', () => {
  describe('AuctionRequest', () => {
    it('should decode valid auction request', () => {
      const input = {
        type: 'native',
        tags: { env: 'production', region: 'us-west' },
        lifecycle: 'service',
      }

      const result = Schema.decodeUnknownSync(AuctionRequest)(input)

      expect(result.type).toBe('native')
      expect(result.tags['env']).toBe('production')
      expect(result.lifecycle).toBe('service')
    })

    it('should reject invalid lifecycle', () => {
      const input = {
        type: 'native',
        tags: {},
        lifecycle: 'invalid',
      }

      expect(() => Schema.decodeUnknownSync(AuctionRequest)(input)).toThrow()
    })
  })

  describe('AuctionResponse', () => {
    it('should decode valid auction response', () => {
      const input = {
        bidderId: 'bid-123',
        nodeId: 'node-456',
        tags: { capacity: 'high' },
        lifecycles: ['service', 'job'],
      }

      const result = Schema.decodeUnknownSync(AuctionResponse)(input)

      expect(result.bidderId).toBe('bid-123')
      expect(result.nodeId).toBe('node-456')
      expect(result.lifecycles).toContain('service')
    })
  })

  describe('StartWorkloadRequest', () => {
    it('should decode with optional description', () => {
      const input = {
        name: 'my-service',
        type: 'native',
        lifecycle: 'service',
        startRequest: { uri: 'file:///app/bin' },
        tags: {},
      }

      const result = Schema.decodeUnknownSync(StartWorkloadRequest)(input)

      expect(result.name).toBe('my-service')
      expect(result.description).toBeUndefined()
    })

    it('should decode with description', () => {
      const input = {
        name: 'my-service',
        description: 'My awesome service',
        type: 'native',
        lifecycle: 'job',
        startRequest: {},
        tags: { team: 'platform' },
      }

      const result = Schema.decodeUnknownSync(StartWorkloadRequest)(input)

      expect(result.description).toBe('My awesome service')
      expect(result.lifecycle).toBe('job')
    })
  })

  describe('WorkloadDeployResponse', () => {
    it('should decode deploy response', () => {
      const input = {
        workloadId: 'wl-789',
        nodeId: 'node-456',
        status: 'running',
      }

      const result = Schema.decodeUnknownSync(WorkloadDeployResponse)(input)

      expect(result.workloadId).toBe('wl-789')
      expect(result.status).toBe('running')
    })
  })

  describe('WorkloadListResponse', () => {
    it('should decode list of workloads', () => {
      const input = {
        workloads: [
          {
            workloadId: 'wl-1',
            name: 'svc-1',
            type: 'native',
            lifecycle: 'service',
            nodeId: 'node-1',
          },
          {
            workloadId: 'wl-2',
            name: 'job-1',
            type: 'native',
            lifecycle: 'job',
            nodeId: 'node-2',
            status: 'running',
          },
        ],
      }

      const result = Schema.decodeUnknownSync(WorkloadListResponse)(input)

      expect(result.workloads).toHaveLength(2)
      expect(result.workloads[0].name).toBe('svc-1')
      expect(result.workloads[1].status).toBe('running')
    })
  })

  describe('RpcRequest', () => {
    it('should decode RPC request', () => {
      const input = {
        method: 'getData',
        params: { id: 123, options: { include: ['a', 'b'] } },
      }

      const result = Schema.decodeUnknownSync(RpcRequest)(input)

      expect(result.method).toBe('getData')
      expect(result.params).toEqual({ id: 123, options: { include: ['a', 'b'] } })
    })
  })

  describe('RpcResponse', () => {
    it('should decode success response', () => {
      const input = {
        result: { data: [1, 2, 3] },
      }

      const result = Schema.decodeUnknownSync(RpcResponse)(input)

      expect(result.result).toEqual({ data: [1, 2, 3] })
      expect(result.error).toBeUndefined()
    })

    it('should decode error response', () => {
      const input = {
        result: null,
        error: 'Something went wrong',
      }

      const result = Schema.decodeUnknownSync(RpcResponse)(input)

      expect(result.result).toBeNull()
      expect(result.error).toBe('Something went wrong')
    })
  })

  describe('Lifecycle Events', () => {
    it('should decode WorkloadStartedEvent', () => {
      const input = {
        _tag: 'WorkloadStarted',
        workloadId: 'wl-123',
        nodeId: 'node-456',
        name: 'my-service',
        namespace: 'default',
        type: 'native',
        lifecycle: 'service',
        timestamp: '2026-01-24T10:00:00Z',
      }

      const result = Schema.decodeUnknownSync(WorkloadStartedEvent)(input)

      expect(result._tag).toBe('WorkloadStarted')
      expect(result.workloadId).toBe('wl-123')
      expect(result.namespace).toBe('default')
    })

    it('should decode WorkloadStoppedEvent', () => {
      const input = {
        _tag: 'WorkloadStopped',
        workloadId: 'wl-123',
        nodeId: 'node-456',
        error: 'Process exited unexpectedly',
        exitCode: 1,
      }

      const result = Schema.decodeUnknownSync(WorkloadStoppedEvent)(input)

      expect(result._tag).toBe('WorkloadStopped')
      expect(result.error).toBe('Process exited unexpectedly')
      expect(result.exitCode).toBe(1)
    })

    it('should decode NexEvent union', () => {
      const started = {
        _tag: 'WorkloadStarted',
        workloadId: 'wl-1',
        nodeId: 'node-1',
        name: 'svc',
        namespace: 'default',
        type: 'native',
        lifecycle: 'service',
      }

      const stopped = {
        _tag: 'WorkloadStopped',
        workloadId: 'wl-1',
        nodeId: 'node-1',
      }

      const startResult = Schema.decodeUnknownSync(NexEvent)(started)
      const stopResult = Schema.decodeUnknownSync(NexEvent)(stopped)

      expect(startResult._tag).toBe('WorkloadStarted')
      expect(stopResult._tag).toBe('WorkloadStopped')
    })
  })

  describe('LogEntry', () => {
    it('should decode log entry', () => {
      const input = {
        workloadId: 'wl-123',
        stream: 'stdout',
        data: 'Hello, world!',
        timestamp: new Date().toISOString(),
      }

      const result = Schema.decodeUnknownSync(LogEntry)(input)

      expect(result.workloadId).toBe('wl-123')
      expect(result.stream).toBe('stdout')
      expect(result.data).toBe('Hello, world!')
      expect(result.timestamp).toBeInstanceOf(Date)
    })

    it('should reject invalid stream type', () => {
      const input = {
        workloadId: 'wl-123',
        stream: 'stdin', // invalid
        data: 'test',
        timestamp: new Date().toISOString(),
      }

      expect(() => Schema.decodeUnknownSync(LogEntry)(input)).toThrow()
    })
  })
})
