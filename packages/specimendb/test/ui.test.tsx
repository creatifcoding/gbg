// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import React, { useMemo } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import * as Effect from 'effect/Effect';
import * as RpcTest from 'effect/unstable/rpc/RpcTest';
import { StatusComponent, LocalityComponent } from '../src/schemas/components.js';
import { trustSpecimenId } from '../src/schemas/identifiers.js';
import { localityOf, statusOf } from '../src/schemas/specimen.js';
import type { Specimen } from '../src/schemas/specimen.js';
import { createCatalog, type SpecimenRpcClient } from '../src/ui/catalog-stx.js';
import { IntakeDrop } from '../src/ui/IntakeDrop.js';
import { SpecimenRail } from '../src/ui/SpecimenRail.js';
import { jpegWithGps, jpegWithoutGps } from './fixtures.js';
import { MemoryCatalogLive } from '../testbed/memory-rpc.js';
import { SpecimenRpcs } from '../src/rpc/SpecimenRpcs.js';

afterEach(() => {
  cleanup();
});

const BANISHED_IDS = ['SP-2023-084', 'SEQ-882.C', 'SP-9942-X'];

function Shell({ client }: { readonly client: SpecimenRpcClient }) {
  const catalog = useMemo(() => createCatalog(client), [client]);
  return React.createElement(
    'div',
    { className: 'sdb-shell' },
    React.createElement(SpecimenRail, { catalog }),
    React.createElement(
      'div',
      { className: 'sdb-stage' },
      React.createElement(IntakeDrop, { catalog }),
      React.createElement(SpecimenRail, { catalog }, React.createElement(SpecimenRail.Detail)),
    ),
  );
}

describe('IntakeDrop + SpecimenRail', () => {
  it('calls List on mount, Intake on pick, Get on select', async () => {
    const calls = { intake: 0, list: 0, get: 0 };
    const id = trustSpecimenId('11111111-1111-4111-8111-111111111111');
    const specimen: Specimen = {
      id,
      createdAt: '2026-08-20T00:00:00.000Z',
      components: [new StatusComponent({ value: 'raw' }), new LocalityComponent({ state: 'unknown' })],
    };
    let items: Specimen[] = [];

    const client: SpecimenRpcClient = {
      List: () => {
        calls.list += 1;
        return Effect.succeed(items);
      },
      Get: (payload) => {
        calls.get += 1;
        const hit = items.find((row) => row.id === payload.specimenId);
        if (hit === undefined) return Effect.succeed(specimen);
        return Effect.succeed(hit);
      },
      Intake: ({ filename }) => {
        calls.intake += 1;
        const next: Specimen = {
          ...specimen,
          components: [
            ...specimen.components,
            {
              _tag: 'Media' as const,
              kind: 'jpeg' as const,
              filename,
              assetPath: `memory://${id}/${filename}`,
              mediaType: 'image/jpeg',
              byteLength: 1,
            },
          ],
        };
        items = [next];
        return Effect.succeed({ specimenId: id, components: next.components });
      },
    };

    const view = render(React.createElement(Shell, { client }));

    await waitFor(() => {
      expect(calls.list).toBeGreaterThan(0);
    });
    expect(view.getByTestId('intake-zone').textContent).toContain('Initiate_Intake_Protocol');
    expect(view.container.textContent).toContain('SpecimenDB // Core');
    expect(view.container.textContent).not.toContain('DRAG_AND_DROP_ASSETS');

    const file = new File([jpegWithoutGps()], 'field.jpg', { type: 'image/jpeg' });
    const input = view.getByTestId('intake-file') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(calls.intake).toBe(1);
    });
    await waitFor(() => {
      expect(view.getByTestId('specimen-id').textContent).toBe(id);
    });
    expect(view.getByTestId('status-pill').getAttribute('data-status')).toBe('raw');
    expect(view.getByTestId('locality').textContent).toBe('unknown');

    const getBeforeSelect = calls.get;
    await act(async () => {
      fireEvent.click(view.getByTestId('specimen-card'));
    });
    await waitFor(() => {
      expect(calls.get).toBeGreaterThan(getBeforeSelect);
    });
    expect(view.getByTestId('detail-id').textContent).toBe(id);
    expect(view.getByTestId('detail-locality').textContent).toBe('unknown');
    expect(view.getByTestId('detail-status').getAttribute('data-status')).toBe('raw');

    const html = view.container.textContent ?? '';
    for (const banned of BANISHED_IDS) {
      expect(html).not.toContain(banned);
    }
  });

  it('shows unknown locality for a real JPEG without EXIF GPS, and real coords when GPS exists', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const client = yield* RpcTest.makeClient(SpecimenRpcs);
          const catalog = createCatalog(client);

          const view = render(
            React.createElement('div', { className: 'sdb-shell' }, [
              React.createElement(SpecimenRail, { catalog, key: 'rail' }),
              React.createElement(IntakeDrop, { catalog, key: 'drop' }),
              React.createElement(
                SpecimenRail,
                { catalog, key: 'detail' },
                React.createElement(SpecimenRail.Detail),
              ),
            ]),
          );

          yield* Effect.promise(() =>
            waitFor(() => {
              expect(view.getByTestId('rail-online').textContent).toBe('ONLINE');
            }),
          );

          const bare = new File([jpegWithoutGps()], 'leaf.jpg', { type: 'image/jpeg' });
          yield* Effect.promise(() =>
            act(async () => {
              fireEvent.change(view.getByTestId('intake-file'), { target: { files: [bare] } });
            }),
          );
          yield* Effect.promise(() =>
            waitFor(() => {
              expect(view.getAllByTestId('locality')[0]?.textContent).toBe('unknown');
              expect(view.getByTestId('status-pill').getAttribute('data-status')).toBe('raw');
            }),
          );

          const located = yield* client.Intake({
            bytes: jpegWithGps(),
            filename: 'located.jpg',
          });
          expect(statusOf(located)).toBe('raw');
          expect(localityOf(located)?.state).toBe('fixed');
          expect(localityOf(located)?.latitude).toBe(37);
          expect(localityOf(located)?.longitude).toBe(-122);

          yield* Effect.promise(() => catalog.list());
          yield* Effect.promise(() =>
            waitFor(() => {
              const localities = view.getAllByTestId('locality').map((n) => n.textContent);
              expect(localities).toContain('unknown');
              expect(localities.some((text) => text?.includes('37.0000° N'))).toBe(true);
            }),
          );

          const html = view.container.textContent ?? '';
          expect(html).not.toContain('SP-2023-084');
          expect(html).not.toContain('SEQ-882.C');
          view.unmount();
        }),
      ).pipe(Effect.provide(MemoryCatalogLive)) as Effect.Effect<void>,
    );
  });
});
