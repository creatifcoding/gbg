/**
 * DataplaneDebugPanel Component Tests
 *
 * Tests for the debug panel component:
 * - Renders port/link/plane counts
 * - Displays graph status
 * - Collapsible sections work
 * - Action buttons trigger callbacks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import { DataplaneDebugPanel } from '../DataplaneDebugPanel';

// Mock the atoms module
vi.mock('../../atoms', () => ({
  portsAtom: { toString: () => 'portsAtom' },
  linksAtom: { toString: () => 'linksAtom' },
  planesAtom: { toString: () => 'planesAtom' },
  versionAtom: { toString: () => 'versionAtom' },
  graphInitializedAtom: { toString: () => 'graphInitializedAtom' },
  portCountAtom: { toString: () => 'portCountAtom' },
  linkCountAtom: { toString: () => 'linkCountAtom' },
  planeCountAtom: { toString: () => 'planeCountAtom' },
}));

// Mock useAtomValue to return appropriate values for each atom
vi.mock('@effect-atom/atom-react', () => ({
  useAtomValue: vi.fn((atom) => {
    const atomName = atom?.toString?.() ?? '';
    if (atomName === 'portsAtom') return [];
    if (atomName === 'linksAtom') return [];
    if (atomName === 'planesAtom') return [];
    if (atomName === 'versionAtom') return 1;
    if (atomName === 'graphInitializedAtom') return true;
    if (atomName === 'portCountAtom') return 3;
    if (atomName === 'linkCountAtom') return 2;
    if (atomName === 'planeCountAtom') return 1;
    return undefined;
  }),
}));

describe('DataplaneDebugPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header with title', () => {
    render(<DataplaneDebugPanel />);
    expect(screen.getByText('Dataplane Debug')).toBeInTheDocument();
  });

  it('starts collapsed by default', () => {
    render(<DataplaneDebugPanel />);
    // Status bar should not be visible when collapsed
    expect(screen.queryByText('Version:')).not.toBeInTheDocument();
  });

  it('starts expanded when defaultExpanded is true', () => {
    render(<DataplaneDebugPanel defaultExpanded />);
    expect(screen.getByText('Version:')).toBeInTheDocument();
  });

  it('expands when header is clicked', () => {
    render(<DataplaneDebugPanel />);

    // Click the header button
    const headerButton = screen.getByRole('button', { name: /dataplane debug/i });
    fireEvent.click(headerButton);

    // Status bar should now be visible
    expect(screen.getByText('Version:')).toBeInTheDocument();
  });

  it('renders action buttons when callbacks provided', () => {
    const onSave = vi.fn();
    const onLoad = vi.fn();
    const onClear = vi.fn();

    render(
      <DataplaneDebugPanel
        defaultExpanded
        onSave={onSave}
        onLoad={onLoad}
        onClear={onClear}
      />
    );

    // Find save button by title
    const saveButton = screen.getByTitle('Save to SQLite');
    expect(saveButton).toBeInTheDocument();

    // Find load button
    const loadButton = screen.getByTitle('Load from SQLite');
    expect(loadButton).toBeInTheDocument();

    // Find clear button
    const clearButton = screen.getByTitle('Clear all');
    expect(clearButton).toBeInTheDocument();
  });

  it('calls onSave when save button clicked', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<DataplaneDebugPanel onSave={onSave} />);

    const saveButton = screen.getByTitle('Save to SQLite');
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('calls onLoad when load button clicked', async () => {
    const onLoad = vi.fn().mockResolvedValue(undefined);

    render(<DataplaneDebugPanel onLoad={onLoad} />);

    const loadButton = screen.getByTitle('Load from SQLite');
    fireEvent.click(loadButton);

    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it('calls onClear when clear button clicked', async () => {
    const onClear = vi.fn().mockResolvedValue(undefined);

    render(<DataplaneDebugPanel onClear={onClear} />);

    const clearButton = screen.getByTitle('Clear all');
    fireEvent.click(clearButton);

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('does not render action buttons when callbacks not provided', () => {
    render(<DataplaneDebugPanel />);

    expect(screen.queryByTitle('Save to SQLite')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Load from SQLite')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Clear all')).not.toBeInTheDocument();
  });

  it('displays section titles when expanded', () => {
    render(<DataplaneDebugPanel defaultExpanded />);

    expect(screen.getByText('Ports')).toBeInTheDocument();
    expect(screen.getByText('Links')).toBeInTheDocument();
    expect(screen.getByText('Planes')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <DataplaneDebugPanel className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});
