/**
 * Block Commands Tests
 *
 * Tests for Telegram block command parsing and handling.
 */

import { describe, it, expect } from 'vitest';
import { parseBlockCommand } from '../blocks';

describe('Block Commands', () => {
  describe('parseBlockCommand', () => {
    it('should parse /block:create with args', () => {
      const result = parseBlockCommand('/block:create text');
      expect(result).toEqual({ command: 'create', args: 'text' });
    });

    it('should parse /block:create without args', () => {
      const result = parseBlockCommand('/block:create');
      expect(result).toEqual({ command: 'create', args: '' });
    });

    it('should parse /block:delete with id', () => {
      const result = parseBlockCommand('/block:delete abc123');
      expect(result).toEqual({ command: 'delete', args: 'abc123' });
    });

    it('should parse /block:info with id', () => {
      const result = parseBlockCommand('/block:info block-xyz');
      expect(result).toEqual({ command: 'info', args: 'block-xyz' });
    });

    it('should parse /block:focus with id', () => {
      const result = parseBlockCommand('/block:focus my-block');
      expect(result).toEqual({ command: 'focus', args: 'my-block' });
    });

    it('should parse /block:sync', () => {
      const result = parseBlockCommand('/block:sync');
      expect(result).toEqual({ command: 'sync', args: '' });
    });

    it('should trim args whitespace', () => {
      const result = parseBlockCommand('/block:create   text   ');
      expect(result).toEqual({ command: 'create', args: 'text' });
    });

    it('should handle multi-word args', () => {
      const result = parseBlockCommand('/block:create data-grid with options');
      expect(result).toEqual({ command: 'create', args: 'data-grid with options' });
    });

    it('should return null for regular commands', () => {
      const result = parseBlockCommand('/start');
      expect(result).toBeNull();
    });

    it('should return null for /blocks command', () => {
      const result = parseBlockCommand('/blocks');
      expect(result).toBeNull();
    });

    it('should return null for regular messages', () => {
      const result = parseBlockCommand('Hello, how are you?');
      expect(result).toBeNull();
    });

    it('should return null for messages starting with /block without colon', () => {
      const result = parseBlockCommand('/block');
      expect(result).toBeNull();
    });

    it('should handle various subcommand names', () => {
      const commands = ['create', 'delete', 'info', 'focus', 'sync', 'update', 'list'];
      for (const cmd of commands) {
        const result = parseBlockCommand(`/block:${cmd} arg`);
        expect(result).toEqual({ command: cmd, args: 'arg' });
      }
    });
  });
});
