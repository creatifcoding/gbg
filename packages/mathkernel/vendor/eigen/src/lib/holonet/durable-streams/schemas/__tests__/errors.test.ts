/**
 * Error Schemas Tests
 */

import { describe, it, expect } from 'vitest';
import {
  // Auth Errors
  InvalidTokenError,
  ForbiddenError,
  TokenRefreshRequired,
  // Protocol Errors
  InvalidOffsetError,
  StreamNotFoundError,
  StreamExistsError,
  ContentTypeMismatch,
  SequenceConflictError,
  // Live Mode Errors
  LongPollTimeoutError,
  SSEConnectionError,
  SubscriptionError,
  // Internal Errors
  NatsConnectionError,
  UnexpectedError,
  // Helpers
  ERROR_STATUS_CODES,
  getStatusCode,
  toErrorResponse,
  type DurableStreamError,
} from '../errors';

describe('Error Schemas', () => {
  describe('Auth Errors', () => {
    it('creates InvalidTokenError', () => {
      const error = new InvalidTokenError({ reason: 'Token expired' });
      expect(error._tag).toBe('InvalidTokenError');
      expect(error.reason).toBe('Token expired');
    });

    it('creates ForbiddenError', () => {
      const error = new ForbiddenError({
        operation: 'append',
        requiredPermission: 'stream:write',
        streamId: 'my-stream',
      });
      expect(error._tag).toBe('ForbiddenError');
      expect(error.operation).toBe('append');
      expect(error.streamId).toBe('my-stream');
    });

    it('creates TokenRefreshRequired', () => {
      const error = new TokenRefreshRequired({ expiresIn: 60 });
      expect(error._tag).toBe('TokenRefreshRequired');
      expect(error.expiresIn).toBe(60);
    });
  });

  describe('Protocol Errors', () => {
    it('creates InvalidOffsetError', () => {
      const error = new InvalidOffsetError({
        offset: 'abc',
        reason: 'Must be a number',
      });
      expect(error._tag).toBe('InvalidOffsetError');
      expect(error.offset).toBe('abc');
    });

    it('creates StreamNotFoundError', () => {
      const error = new StreamNotFoundError({ streamId: 'missing-stream' });
      expect(error._tag).toBe('StreamNotFoundError');
      expect(error.streamId).toBe('missing-stream');
    });

    it('creates StreamExistsError', () => {
      const error = new StreamExistsError({ streamId: 'existing-stream' });
      expect(error._tag).toBe('StreamExistsError');
      expect(error.streamId).toBe('existing-stream');
    });

    it('creates ContentTypeMismatch', () => {
      const error = new ContentTypeMismatch({
        streamId: 'typed-stream',
        expected: 'application/json; schema=Event',
        received: 'text/plain',
      });
      expect(error._tag).toBe('ContentTypeMismatch');
      expect(error.expected).toBe('application/json; schema=Event');
      expect(error.received).toBe('text/plain');
    });

    it('creates SequenceConflictError', () => {
      const error = new SequenceConflictError({
        streamId: 'my-stream',
        producerId: 'producer-1',
        expectedSeq: 10,
        receivedSeq: 5,
      });
      expect(error._tag).toBe('SequenceConflictError');
      expect(error.expectedSeq).toBe(10);
      expect(error.receivedSeq).toBe(5);
    });
  });

  describe('Live Mode Errors', () => {
    it('creates LongPollTimeoutError', () => {
      const error = new LongPollTimeoutError({
        streamId: 'my-stream',
        timeout: 30000,
        lastOffset: 100,
      });
      expect(error._tag).toBe('LongPollTimeoutError');
      expect(error.timeout).toBe(30000);
    });

    it('creates SSEConnectionError', () => {
      const error = new SSEConnectionError({
        streamId: 'my-stream',
        reason: 'Client disconnected',
        lastOffset: 50,
      });
      expect(error._tag).toBe('SSEConnectionError');
      expect(error.reason).toBe('Client disconnected');
    });

    it('creates SubscriptionError', () => {
      const error = new SubscriptionError({
        streamId: 'my-stream',
        consumerName: 'consumer-1',
        reason: 'Consumer not found',
      });
      expect(error._tag).toBe('SubscriptionError');
      expect(error.consumerName).toBe('consumer-1');
    });
  });

  describe('Internal Errors', () => {
    it('creates NatsConnectionError', () => {
      const error = new NatsConnectionError({
        reason: 'Connection refused',
        cause: new Error('ECONNREFUSED'),
      });
      expect(error._tag).toBe('NatsConnectionError');
      expect(error.reason).toBe('Connection refused');
    });

    it('creates UnexpectedError', () => {
      const error = new UnexpectedError({
        message: 'Something went wrong',
        cause: new Error('Unknown'),
      });
      expect(error._tag).toBe('UnexpectedError');
      expect(error.message).toBe('Something went wrong');
    });
  });

  describe('ERROR_STATUS_CODES', () => {
    it('maps auth errors to 4xx', () => {
      expect(ERROR_STATUS_CODES.InvalidTokenError).toBe(401);
      expect(ERROR_STATUS_CODES.ForbiddenError).toBe(403);
      expect(ERROR_STATUS_CODES.TokenRefreshRequired).toBe(401);
    });

    it('maps protocol errors to 4xx', () => {
      expect(ERROR_STATUS_CODES.InvalidOffsetError).toBe(400);
      expect(ERROR_STATUS_CODES.StreamNotFoundError).toBe(404);
      expect(ERROR_STATUS_CODES.StreamExistsError).toBe(409);
      expect(ERROR_STATUS_CODES.SchemaNotFoundError).toBe(400);
      expect(ERROR_STATUS_CODES.SchemaValidationError).toBe(422);
    });

    it('maps live mode errors appropriately', () => {
      expect(ERROR_STATUS_CODES.LongPollTimeoutError).toBe(204);
      expect(ERROR_STATUS_CODES.SSEConnectionError).toBe(500);
      expect(ERROR_STATUS_CODES.SubscriptionError).toBe(500);
    });

    it('maps internal errors to 5xx', () => {
      expect(ERROR_STATUS_CODES.NatsConnectionError).toBe(503);
      expect(ERROR_STATUS_CODES.CodecError).toBe(500);
      expect(ERROR_STATUS_CODES.UnexpectedError).toBe(500);
    });
  });

  describe('getStatusCode', () => {
    it('returns correct status code for each error type', () => {
      const errors: DurableStreamError[] = [
        new InvalidTokenError({ reason: 'test' }),
        new ForbiddenError({ operation: 'test', requiredPermission: 'test' }),
        new StreamNotFoundError({ streamId: 'test' }),
        new NatsConnectionError({ reason: 'test' }),
      ];

      expect(getStatusCode(errors[0])).toBe(401);
      expect(getStatusCode(errors[1])).toBe(403);
      expect(getStatusCode(errors[2])).toBe(404);
      expect(getStatusCode(errors[3])).toBe(503);
    });
  });

  describe('toErrorResponse', () => {
    it('converts StreamNotFoundError to response', () => {
      const error = new StreamNotFoundError({ streamId: 'my-stream' });
      const response = toErrorResponse(error);

      expect(response.error).toBe('stream_not_found');
      expect(response.message).toContain('my-stream');
      expect(response.message).toContain('not found');
      expect(response.code).toBe('StreamNotFoundError');
      expect(response.details).toEqual({ streamId: 'my-stream' });
    });

    it('converts ForbiddenError to response', () => {
      const error = new ForbiddenError({
        operation: 'append',
        requiredPermission: 'stream:write',
      });
      const response = toErrorResponse(error);

      expect(response.error).toBe('forbidden');
      expect(response.message).toContain('append');
      expect(response.message).toContain('stream:write');
      expect(response.code).toBe('ForbiddenError');
    });

    it('converts NatsConnectionError to response', () => {
      const error = new NatsConnectionError({ reason: 'Connection refused' });
      const response = toErrorResponse(error);

      expect(response.error).toBe('nats_connection');
      expect(response.message).toContain('Connection refused');
      expect(response.code).toBe('NatsConnectionError');
    });

    it('converts SequenceConflictError to response with details', () => {
      const error = new SequenceConflictError({
        streamId: 'my-stream',
        producerId: 'p1',
        expectedSeq: 10,
        receivedSeq: 5,
      });
      const response = toErrorResponse(error);

      expect(response.error).toBe('sequence_conflict');
      expect(response.details).toEqual({
        streamId: 'my-stream',
        producerId: 'p1',
        expectedSeq: 10,
        receivedSeq: 5,
      });
    });
  });
});
