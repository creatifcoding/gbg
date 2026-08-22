import { render } from '@testing-library/react';
import type { ICellRendererParams, IHeaderParams } from 'ag-grid-community';
import { describe, expect, it } from 'vitest';
import { BLANK_ROWS, Grid } from '../src/index.ts';
import {
  HeaderCell,
  SocketCell,
  StatusCell,
  ValueCell,
} from '../src/components/grid-cells.tsx';
import { createVantaGridTheme } from '../src/lib/grid-theme.ts';
import { VANTA_COLORS } from '../src/lib/vanta.ts';

const cellParams = { value: undefined } as ICellRendererParams;
const headerParams = { displayName: 'cell' } as IHeaderParams;

describe('blank grid', () => {
  it('draws a grid frame', () => {
    const { container } = render(<Grid />);
    expect(container.querySelector('[data-grid]')).not.toBeNull();
  });

  it('ships blank default rows', () => {
    for (const row of BLANK_ROWS) {
      expect(row.cell).toBe('');
      expect(row.status).toBe('');
      expect(row.value).toBe('');
    }
  });

  it('draws empty socket, pill, and value cells', () => {
    const socket = render(<SocketCell {...cellParams} />);
    expect(socket.container.querySelector('[data-socket="value"]')?.textContent).toBe(
      '',
    );

    const status = render(<StatusCell {...cellParams} />);
    const pill = status.container.querySelector('[data-tone="empty"]');
    expect(pill).not.toBeNull();
    expect(pill?.textContent).toBe('');

    const value = render(<ValueCell {...cellParams} />);
    expect(value.container.textContent).toBe('');

    const header = render(<HeaderCell {...headerParams} />);
    expect(header.container.textContent?.toLowerCase()).toContain('cell');
  });

  it('builds the grid theme from VANTA void', () => {
    expect(createVantaGridTheme()).toBeTruthy();
    expect(VANTA_COLORS.surface.void).toBe('#000000');
  });
});
