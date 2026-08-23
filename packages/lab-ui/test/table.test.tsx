import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BLANK_TABLE_ROWS, Table } from '../src/index.ts';

describe('blank table', () => {
  it('draws a table with blank sockets', () => {
    const { container } = render(<Table />);
    expect(container.querySelector('[data-table]')).not.toBeNull();
    const sockets = container.querySelectorAll('[data-socket="value"]');
    expect(sockets.length).toBeGreaterThan(0);
    for (const socket of sockets) {
      expect(socket.textContent).toBe('');
    }
  });

  it('ships blank default rows', () => {
    for (const row of BLANK_TABLE_ROWS) {
      expect(row.a).toBe('');
      expect(row.b).toBe('');
      expect(row.c).toBe('');
    }
  });
});
