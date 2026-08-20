// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import React, { useMemo } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import * as Effect from 'effect/Effect';
import * as RpcTest from 'effect/unstable/rpc/RpcTest';
import { StatusComponent, LocalityComponent } from '../src/schemas/components.js';
import { trustSpecimenId } from '../src/schemas/identifiers.js';
import { localityOf, nextStatus, statusOf } from '../src/schemas/specimen.js';
import type { Specimen } from '../src/schemas/specimen.js';
import { createCatalog, type SpecimenRpcClient } from '../src/ui/catalog-stx.js';
import { AnalogCard } from '../src/ui/AnalogCard.js';
import { AppShell } from '../src/ui/AppShell.js';
import { DossierView } from '../src/ui/DossierView.js';
import { IntakeDrop } from '../src/ui/IntakeDrop.js';
import { SpecimenRail } from '../src/ui/SpecimenRail.js';
import { WorkingPanel } from '../src/ui/WorkingPanel.js';
import { jpegWithGps, jpegWithoutGps } from './fixtures.js';
import { MemoryCatalogLive } from '../testbed/memory-rpc.js';
import { SpecimenRpcs } from '../src/rpc/SpecimenRpcs.js';

afterEach(() => {
  cleanup();
});

const BANISHED = [
  'SP-2023-084',
  'SEQ-882.C',
  'SP-9942-X',
  'SPC-88.94X',
  'SESSION_ID',
  '98A-F',
  'NO RECORDS',
  'NO SELECTION',
  'DRAG_AND_DROP_ASSETS',
  '99.8%',
  'OD-',
  'OPTICAL_SCAN',
  'SCAN_MACRO',
  'ISO-CHROM',
  'R:0.992',
  'R: 0.992',
  'PX-',
  'BOT-',
  'COL-',
  'GEK-',
];

function TerminalPage({ client }: { readonly client: SpecimenRpcClient }) {
  const catalog = useMemo(() => createCatalog(client), [client]);
  return React.createElement(IntakeDrop, { catalog });
}

function WorkbenchPage({ client }: { readonly client: SpecimenRpcClient }) {
  const catalog = useMemo(() => createCatalog(client), [client]);
  return React.createElement(SpecimenRail, { catalog });
}

function CatalogPage({ client }: { readonly client: SpecimenRpcClient }) {
  const catalog = useMemo(() => createCatalog(client), [client]);
  return React.createElement(AppShell, { catalog });
}

function AssayPage({ client }: { readonly client: SpecimenRpcClient }) {
  const catalog = useMemo(() => createCatalog(client), [client]);
  return React.createElement(WorkingPanel, { catalog });
}

function DactylPage({ client }: { readonly client: SpecimenRpcClient }) {
  const catalog = useMemo(() => createCatalog(client), [client]);
  return React.createElement(AnalogCard, { catalog });
}

function AccessionPage({ client }: { readonly client: SpecimenRpcClient }) {
  const catalog = useMemo(() => createCatalog(client), [client]);
  return React.createElement(DossierView, { catalog });
}

const promotingClient = (initial: Specimen) => {
  let specimen = initial;
  const calls = { promote: 0 };
  const client: SpecimenRpcClient = {
    List: () => Effect.succeed([specimen]),
    Get: () => Effect.succeed(specimen),
    Intake: () => Effect.die('Intake should not run'),
    Promote: () => {
      calls.promote += 1;
      const current = statusOf(specimen) ?? 'raw';
      const next = nextStatus(current);
      specimen = {
        ...specimen,
        components: specimen.components.map((component) =>
          component._tag === 'Status' ? new StatusComponent({ value: next }) : component,
        ),
      };
      return Effect.succeed(specimen);
    },
  };
  return { client, calls };
};

const emptyClient = (): SpecimenRpcClient => ({
  List: () => Effect.succeed([]),
  Get: () => Effect.die('Get should not run on empty catalog'),
  Intake: () => Effect.die('Intake should not run'),
  Promote: () => Effect.die('Promote should not run on empty catalog'),
});

describe('IntakeDrop Terminal + SpecimenRail Workbench', () => {
  it('Terminal v1 now-slots: Intake, List, SYS_ONLINE, Status, Claim, Media, unknown locality', async () => {
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
      Promote: () => Effect.die('Promote should not run'),
    };

    const view = render(React.createElement(TerminalPage, { client }));

    await waitFor(() => {
      expect(calls.list).toBeGreaterThan(0);
    });
    expect(view.getByTestId('intake-zone').textContent).toContain('Initiate_Intake_Protocol');
    expect(view.container.textContent).toContain('SPECIMEN_DB');
    expect(view.container.textContent).toContain('SYS_ONLINE');
    expect(view.container.textContent).toContain('Local Catalog');
    expect(view.getAllByTestId('kicker').map((node) => node.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'CLASS / ORDER',
      'EXTRACTION VECTOR',
      'THERMAL BASE',
      'SPECTROSCOPY',
      'CELLULAR VIABILITY',
      'PROTOCOL ID',
    ]);
    expect(view.getByTestId('card-chrome')).toBeTruthy();
    expect(view.container.textContent).not.toContain('DRAG_AND_DROP_ASSETS');
    expect(view.container.className).not.toContain('sdb-shell');

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
    expect(view.queryByTestId('card-chrome')).toBeNull();
    expect(view.getByTestId('status-pill').getAttribute('data-status')).toBe('raw');
    expect(view.getByTestId('locality').textContent).toBe('unknown');
    expect(view.getByTestId('claim').textContent).toBe('');
    expect(view.getByTestId('media-bytes')).toBeTruthy();
    expect(view.container.textContent).toContain('IMG_SRC: field.jpg');
    expect(view.queryByTestId('rail-query')).toBeNull();
    expect(view.queryByTestId('rail-filters')).toBeNull();
    expect(view.container.textContent).not.toContain('Q QUERY ACCESSION ID');
    expect(calls.get).toBeGreaterThan(0);

    const getsAfterIntake = calls.get;
    await act(async () => {
      fireEvent.click(view.getByTestId('specimen-card'));
    });
    await waitFor(() => {
      expect(calls.get).toBeGreaterThan(getsAfterIntake);
    });
    expect(view.getByTestId('detail-id').textContent).toContain(id);
    expect(view.getByTestId('detail-locality').textContent).toBe('unknown');
    expect(view.getByTestId('detail-status').getAttribute('data-status')).toBe('raw');

    const html = view.container.textContent ?? '';
    for (const banned of BANISHED) {
      expect(html).not.toContain(banned);
    }
  });

  it('Workbench page is its own layout with empty card chrome and List on mount', async () => {
    const calls = { list: 0 };
    const client: SpecimenRpcClient = {
      List: () => {
        calls.list += 1;
        return Effect.succeed([]);
      },
      Get: () => Effect.die('Get should not run'),
      Intake: () => Effect.die('Intake should not run'),
      Promote: () => Effect.die('Promote should not run'),
    };

    const view = render(React.createElement(WorkbenchPage, { client }));
    await waitFor(() => {
      expect(calls.list).toBeGreaterThan(0);
    });
    expect(view.container.textContent).toContain('SpecimenDB // Core');
    expect(view.container.textContent).toContain('Initiate Intake Sequence // Drop Telemetry Data');
    expect(view.container.textContent).toContain('PROPERTIES LOG');
    expect(view.container.textContent).toContain('VIEWPORT_XZ');
    expect(view.getByTestId('card-chrome')).toBeTruthy();
    expect(view.getByTestId('intake-zone')).toBeTruthy();
    expect(view.getByTestId('rail-query')).toBeTruthy();
    expect(view.getByTestId('rail-filters').textContent).toContain('RAW');
    expect(view.getByTestId('rail-filters').textContent).toContain('FILED');
    expect(view.getByTestId('rail-filters').textContent).toContain('WORKING');
    expect(view.getAllByTestId('kicker').map((node) => node.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'CLASSIFICATION',
      'STRUCTURAL METRICS',
      'OBSERVATION LOG',
    ]);
    const html = view.container.textContent ?? '';
    for (const banned of BANISHED) {
      expect(html).not.toContain(banned);
    }
  });

  it('empty catalog keeps card chrome on both pages', async () => {
    const terminal = render(React.createElement(TerminalPage, { client: emptyClient() }));
    await waitFor(() => {
      expect(terminal.getByTestId('card-chrome')).toBeTruthy();
    });
    expect(terminal.container.textContent).not.toContain('NO RECORDS');
    expect(terminal.container.textContent).not.toContain('NO SELECTION');
    terminal.unmount();

    const workbench = render(React.createElement(WorkbenchPage, { client: emptyClient() }));
    await waitFor(() => {
      expect(workbench.getByTestId('card-chrome')).toBeTruthy();
    });
    expect(workbench.container.textContent).not.toContain('NO RECORDS');
    expect(workbench.container.textContent).not.toContain('NO SELECTION');
  });

  it('status filter and accession query are live List on the Workbench rail', async () => {
    const rawId = trustSpecimenId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    const filedId = trustSpecimenId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    const raw: Specimen = {
      id: rawId,
      createdAt: '2026-08-20T00:00:00.000Z',
      components: [new StatusComponent({ value: 'raw' }), new LocalityComponent({ state: 'unknown' })],
    };
    const filed: Specimen = {
      id: filedId,
      createdAt: '2026-08-20T00:00:01.000Z',
      components: [new StatusComponent({ value: 'filed' }), new LocalityComponent({ state: 'unknown' })],
    };
    const client: SpecimenRpcClient = {
      List: () => Effect.succeed([raw, filed]),
      Get: (payload) =>
        Effect.succeed(payload.specimenId === filedId ? filed : raw),
      Intake: () => Effect.die('Intake should not run'),
      Promote: () => Effect.die('Promote should not run'),
    };

    const view = render(React.createElement(WorkbenchPage, { client }));
    await waitFor(() => {
      expect(view.getAllByTestId('specimen-card')).toHaveLength(2);
    });

    await act(async () => {
      fireEvent.click(view.getByTestId('rail-filters').querySelector('[data-filter="filed"]')!);
    });
    await waitFor(() => {
      expect(view.getAllByTestId('specimen-id').map((node) => node.textContent)).toEqual([filedId]);
    });

    await act(async () => {
      fireEvent.click(view.getByTestId('rail-filters').querySelector('[data-filter="all"]')!);
    });
    await waitFor(() => {
      expect(view.getAllByTestId('specimen-card')).toHaveLength(2);
    });

    await act(async () => {
      fireEvent.change(view.getByTestId('rail-query'), { target: { value: 'aaaa' } });
    });
    await waitFor(() => {
      expect(view.getAllByTestId('specimen-id').map((node) => node.textContent)).toEqual([rawId]);
    });

    await act(async () => {
      fireEvent.change(view.getByTestId('rail-query'), { target: { value: 'field.jpg' } });
    });
    await waitFor(() => {
      expect(view.getByTestId('card-chrome')).toBeTruthy();
      expect(view.queryByTestId('specimen-card')).toBeNull();
    });
  });

  it('rejects non JPEG/HEIC at Intake and leaves the card template', async () => {
    let intake = 0;
    const client: SpecimenRpcClient = {
      List: () => Effect.succeed([]),
      Get: () => Effect.die('Get should not run'),
      Intake: () => {
        intake += 1;
        return Effect.die('csv is later');
      },
      Promote: () => Effect.die('Promote should not run'),
    };
    const view = render(React.createElement(TerminalPage, { client }));
    await waitFor(() => {
      expect(view.getByTestId('card-chrome')).toBeTruthy();
    });
    const csv = new File(['a,b\n1,2'], 'packet.csv', { type: 'text/csv' });
    await act(async () => {
      fireEvent.change(view.getByTestId('intake-file'), { target: { files: [csv] } });
    });
    await waitFor(() => {
      expect(view.getByTestId('intake-error').textContent).toBe('JPEG/HEIC first');
    });
    expect(intake).toBe(0);
    expect(view.getByTestId('card-chrome')).toBeTruthy();
  });

  it('Workbench Intake fills Status and Claim slots and leaves the photo well empty', async () => {
    const id = trustSpecimenId('11111111-1111-4111-8111-111111111111');
    const specimen: Specimen = {
      id,
      createdAt: '2026-08-20T00:00:00.000Z',
      components: [new StatusComponent({ value: 'raw' }), new LocalityComponent({ state: 'unknown' })],
    };
    let items: Specimen[] = [];
    const client: SpecimenRpcClient = {
      List: () => Effect.succeed(items),
      Get: (payload) => {
        const hit = items.find((row) => row.id === payload.specimenId);
        if (hit === undefined) return Effect.succeed(specimen);
        return Effect.succeed(hit);
      },
      Intake: ({ filename }) => {
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
      Promote: () => Effect.die('Promote should not run'),
    };
    const view = render(React.createElement(WorkbenchPage, { client }));
    await waitFor(() => {
      expect(view.getByTestId('card-chrome')).toBeTruthy();
    });
    const file = new File([jpegWithoutGps()], 'field.jpg', { type: 'image/jpeg' });
    await act(async () => {
      fireEvent.change(view.getByTestId('intake-file'), { target: { files: [file] } });
    });
    await waitFor(() => {
      expect(view.getByTestId('specimen-id').textContent).toBe(id);
    });
    expect(view.getByTestId('status-pill').getAttribute('data-status')).toBe('raw');
    expect(view.getByTestId('claim').textContent).toBe('');
    expect(view.getByTestId('media-bytes')).toBeTruthy();
    expect(view.getByTestId('locality').textContent).toBe('unknown');
  });

  it('Workbench no-GPS JPEG files raw + unknown and rail status chrome Promotes to filed', async () => {
    const id = trustSpecimenId('11111111-1111-4111-8111-111111111111');
    let specimen: Specimen = {
      id,
      createdAt: '2026-08-20T00:00:00.000Z',
      components: [new StatusComponent({ value: 'raw' }), new LocalityComponent({ state: 'unknown' })],
    };
    let items: Specimen[] = [];
    const client: SpecimenRpcClient = {
      List: () => Effect.succeed(items),
      Get: () => Effect.succeed(items[0] ?? specimen),
      Intake: ({ filename }) => {
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
        specimen = next;
        items = [next];
        return Effect.succeed({ specimenId: id, components: next.components });
      },
      Promote: () => {
        const next = nextStatus(statusOf(specimen) ?? 'raw');
        specimen = {
          ...specimen,
          components: specimen.components.map((component) =>
            component._tag === 'Status' ? new StatusComponent({ value: next }) : component,
          ),
        };
        items = [specimen];
        return Effect.succeed(specimen);
      },
    };

    const view = render(React.createElement(WorkbenchPage, { client }));
    await waitFor(() => {
      expect(view.getByTestId('card-chrome')).toBeTruthy();
    });
    const file = new File([jpegWithoutGps()], 'field.jpg', { type: 'image/jpeg' });
    await act(async () => {
      fireEvent.change(view.getByTestId('intake-file'), { target: { files: [file] } });
    });
    await waitFor(() => {
      expect(view.getByTestId('status-pill').getAttribute('data-status')).toBe('raw');
    });
    expect(view.getByTestId('locality').textContent).toBe('unknown');
    expect(view.container.textContent).not.toContain('SP-2023-084');
    expect(view.getByTestId('media-bytes')).toBeTruthy();

    await act(async () => {
      fireEvent.click(view.getByTestId('status-pill'));
    });
    await waitFor(() => {
      expect(view.getByTestId('status-pill').getAttribute('data-status')).toBe('filed');
    });
    expect(view.getByTestId('locality').textContent).toBe('unknown');
  });

  it('shows unknown locality for a real JPEG without EXIF GPS, and real coords when GPS exists', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const client = yield* RpcTest.makeClient(SpecimenRpcs);
          const catalog = createCatalog(client);

          const view = render(React.createElement(IntakeDrop, { catalog }));

          yield* Effect.promise(() =>
            waitFor(() => {
              expect(view.getByTestId('rail-online').textContent).toContain('ONLINE');
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
              expect(view.getByTestId('claim').textContent).toBe('');
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
          expect(html).not.toContain('SPC-88.94X');
          expect(html).not.toContain('99.8%');
          view.unmount();
        }),
      ).pipe(Effect.provide(MemoryCatalogLive)) as Effect.Effect<void>,
    );
  });

  it('keeps the Terminal 4px scrollbar chrome visible on both pages', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const css = readFileSync(resolve(process.cwd(), 'src/ui/catalog.css'), 'utf8');
    expect(css).toContain('width: 4px');
    expect(css).toContain('height: 4px');
    expect(css).toContain('scrollbar-width: thin');
    expect(css).toContain('scrollbar-color: #333333 #000000');
    expect(css).toContain('background: #000000');
    expect(css).toContain('border-left: 1px solid #1a1a1a');
    expect(css).toContain('background: #333333');
    expect(css).toContain('background: #555555');
    expect(css).toContain('::-webkit-scrollbar');
    expect(css).not.toContain('scrollbar-width: none');
    expect(css).not.toMatch(/::-webkit-scrollbar\s*\{[^}]*display:\s*none/);
  });

  it('does not restyle both pages into one Inter / IBM Plex / charcoal token sheet', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const css = readFileSync(resolve(process.cwd(), 'src/ui/catalog.css'), 'utf8');
    expect(css).not.toContain('--charcoal-100');
    expect(css).not.toContain('--font-sans');
    expect(css).not.toContain('--font-mono');
    expect(css).toMatch(/\.sdb-terminal\s*\{[^}]*font-family:\s*Inter/s);
    expect(css).toMatch(/\.sdb-workbench\s*\{[^}]*IBM Plex Mono/s);
    expect(css).toContain('ui-monospace');
    expect(css).toContain('background-size: 24px 24px');
    expect(css).toContain('rgba(255, 255, 255, 0.04)');
    expect(css).toContain('width: 6px');
    expect(css).toContain('height: 6px');
    expect(css).toContain('height: 48px');
    expect(css).toContain('height: 208px');
    expect(css).toContain('height: 160px');
    expect(css).toContain('width: 420px');
    expect(css).toContain('box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5)');
    expect(css).toContain('border: 1px dashed #333');
    expect(css).toContain('color: #888');
    expect(css).toContain('border: 1px solid #222');
  });
});

describe('six full pages', () => {
  const pages: ReadonlyArray<{
    readonly name: string;
    readonly Page: (props: { readonly client: SpecimenRpcClient }) => React.ReactElement;
    readonly testId: string;
    readonly copy: ReadonlyArray<string>;
  }> = [
    {
      name: 'Terminal',
      Page: TerminalPage,
      testId: 'intake-drop',
      copy: ['Initiate_Intake_Protocol', 'Local Catalog', 'SYS_ONLINE', 'VOL: 04'],
    },
    {
      name: 'Workbench',
      Page: WorkbenchPage,
      testId: 'specimen-rail',
      copy: ['SpecimenDB // Core', 'VIEWPORT_XZ', 'PROPERTIES LOG', 'LOCAL_STORAGE // ACTIVE_WORKBENCH'],
    },
    {
      name: 'Assay',
      Page: AssayPage,
      testId: 'working-panel',
      copy: ['INITIATE_INTAKE_PROTOCOL', 'CURRENT_FOCUS_RECORD', 'WORKING SET', 'CH-01'],
    },
    {
      name: 'Dactyl',
      Page: DactylPage,
      testId: 'dactyl-grid',
      copy: ['DACTYL // ANALOG CARD', 'ACTIVE QUEUE', 'DROP_FIELD_MEDIA'],
    },
    {
      name: 'Catalog',
      Page: CatalogPage,
      testId: 'app-shell',
      copy: ['SPECIMEN_DB / CATALOG', 'Drop specimen media', 'Catalog'],
    },
    {
      name: 'Accession',
      Page: AccessionPage,
      testId: 'dossier-view',
      copy: ['PHOTO RAIL', 'Taxonomy', 'Field metrics', 'Spectral grid', 'Observer log'],
    },
  ];

  for (const page of pages) {
    it(`${page.name} is a full page with empty card chrome and no fake ids`, async () => {
      const view = render(React.createElement(page.Page, { client: emptyClient() }));
      await waitFor(() => {
        expect(view.getByTestId(page.testId)).toBeTruthy();
      });
      expect(view.getByTestId('card-chrome')).toBeTruthy();
      const html = view.container.textContent ?? '';
      for (const snippet of page.copy) {
        expect(html).toContain(snippet);
      }
      for (const banned of BANISHED) {
        expect(html).not.toContain(banned);
      }
      view.unmount();
    });
  }

  it('Assay/Dactyl/Catalog/Accession now-rows file a no-GPS JPEG as raw + unknown', async () => {
    const id = trustSpecimenId('11111111-1111-4111-8111-111111111111');
    const specimen: Specimen = {
      id,
      createdAt: '2026-08-20T00:00:00.000Z',
      components: [new StatusComponent({ value: 'raw' }), new LocalityComponent({ state: 'unknown' })],
    };
    const makeClient = (): SpecimenRpcClient => {
      let items: Specimen[] = [];
      return {
        List: () => Effect.succeed(items),
        Get: (payload) => {
          const hit = items.find((row) => row.id === payload.specimenId);
          if (hit === undefined) return Effect.succeed(specimen);
          return Effect.succeed(hit);
        },
        Intake: ({ filename }) => {
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
        Promote: () => Effect.die('Promote should not run'),
      };
    };

    const surfaces = [AssayPage, DactylPage, CatalogPage, AccessionPage];
    for (const Page of surfaces) {
      const view = render(React.createElement(Page, { client: makeClient() }));
      await waitFor(() => {
        expect(view.getByTestId('card-chrome')).toBeTruthy();
      });
      const file = new File([jpegWithoutGps()], 'field.jpg', { type: 'image/jpeg' });
      await act(async () => {
        fireEvent.change(view.getByTestId('intake-file'), { target: { files: [file] } });
      });
      await waitFor(() => {
        expect(view.getByTestId('specimen-id').textContent).toBe(id);
      });
      expect(view.getByTestId('status-pill').getAttribute('data-status')).toBe('raw');
      expect(view.getByTestId('locality').textContent).toBe('unknown');
      expect(view.getByTestId('claim').textContent).toBe('');
      view.unmount();
    }
  });

  it('keeps Assay 4px rail scrollbars and Dactyl 6px scrollbars', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const assay = readFileSync(resolve(process.cwd(), 'src/ui/assay.css'), 'utf8');
    expect(assay).toContain('--bg-void: #000');
    expect(assay).toContain('--bg-charcoal: #0a0a0a');
    expect(assay).toContain('--bg-charcoal-elevated: #111');
    expect(assay).toContain('--border-dim: #1a1a1a');
    expect(assay).toContain('--text-primary: #a1a1aa');
    expect(assay).toContain('--raw: #f59e0b');
    expect(assay).toContain('--filed: #06b6d4');
    expect(assay).toContain('--working: #10b981');
    expect(assay).toContain('--dead: #f43f5e');
    expect(assay).toContain('width: 440px');
    expect(assay).toContain('height: 112px');
    expect(assay).toContain('width: 4px');
    const dactyl = readFileSync(resolve(process.cwd(), 'src/ui/dactyl.css'), 'utf8');
    expect(dactyl).toContain('background: #020202');
    expect(dactyl).toContain('width: 6px');
    expect(dactyl).toContain('background: #1a1a1a');
    expect(dactyl).toContain('#083344');
    expect(dactyl).toContain('#06b6d4');
    expect(dactyl).toContain('width: 320px');
  });

  it('status chrome promotes raw → filed → working → dead on every page and stops', async () => {
    const pages = [TerminalPage, WorkbenchPage, AssayPage, DactylPage, CatalogPage, AccessionPage];
    for (const Page of pages) {
      const id = trustSpecimenId('11111111-1111-4111-8111-111111111111');
      const { client, calls } = promotingClient({
        id,
        createdAt: '2026-08-20T00:00:00.000Z',
        components: [new StatusComponent({ value: 'raw' }), new LocalityComponent({ state: 'unknown' })],
      });
      const view = render(React.createElement(Page, { client }));
      await waitFor(() => {
        expect(view.getByTestId('status-pill').getAttribute('data-status')).toBe('raw');
      });
      for (const status of ['filed', 'working', 'dead'] as const) {
        await act(async () => {
          fireEvent.click(view.getByTestId('status-pill'));
        });
        await waitFor(() => {
          expect(view.getByTestId('status-pill').getAttribute('data-status')).toBe(status);
        });
      }
      await act(async () => {
        fireEvent.click(view.getByTestId('status-pill'));
      });
      await waitFor(() => {
        expect(view.getByTestId('status-pill').getAttribute('data-status')).toBe('dead');
      });
      expect(calls.promote).toBe(4);
      view.unmount();
    }
  });

  it('empty card chrome does not Promote', async () => {
    let promote = 0;
    const client: SpecimenRpcClient = {
      List: () => Effect.succeed([]),
      Get: () => Effect.die('Get should not run on empty catalog'),
      Intake: () => Effect.die('Intake should not run'),
      Promote: () => {
        promote += 1;
        return Effect.die('Promote should not run');
      },
    };
    const view = render(React.createElement(TerminalPage, { client }));
    await waitFor(() => {
      expect(view.getByTestId('card-chrome')).toBeTruthy();
    });
    const chromeStatus = view.getByTestId('card-chrome').querySelector('[data-status="raw"]');
    expect(chromeStatus).toBeTruthy();
    await act(async () => {
      fireEvent.click(chromeStatus!);
    });
    expect(promote).toBe(0);
    expect(view.getByTestId('card-chrome').querySelector('[data-promote]')).toBeNull();
    const analysis = [...view.container.querySelectorAll('[data-status="working"]')].find((node) =>
      node.textContent?.includes('ANALYSIS_ACTIVE'),
    );
    expect(analysis).toBeTruthy();
    await act(async () => {
      fireEvent.click(analysis!);
    });
    expect(promote).toBe(0);
  });

  it('commits the functionalization journal as SoT with the now-rows', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const journal = readFileSync(resolve(process.cwd(), 'docs/functionalization-journal.md'), 'utf8');
    for (const id of [
      'F-001',
      'F-002',
      'F-003',
      'F-004',
      'F-005',
      'F-006',
      'F-009',
      'F-027',
      'F-028',
      'F-030',
      'F-032',
      'F-035',
      'F-047',
      'F-048',
      'F-051',
      'F-052',
      'F-062',
      'F-063',
      'F-068',
      'F-069',
      'F-074',
      'F-076',
      'F-078',
      'F-079',
      'F-098',
      'F-100',
      'F-101',
      'F-102',
      'F-105',
    ]) {
      expect(journal).toContain(id);
    }
    expect(journal).toContain('never');
    expect(journal).toContain('F-091');
    expect(journal).toContain('Specimen is the only type');
    expect(journal).toContain('F-106');
    expect(journal).toContain('F-107');
    expect(journal).toContain('F-108');
    expect(journal).toContain('F-109');
    expect(journal).toContain('Promote');
  });
});
