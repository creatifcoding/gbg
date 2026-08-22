// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import React, { useMemo } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react';
import * as Effect from 'effect/Effect';
import * as RpcTest from 'effect/unstable/rpc/RpcTest';
import {
  BytesComponent,
  ClaimComponent,
  ExifComponent,
  GeneratedComponent,
  LocalityComponent,
  MediaComponent,
  ObservationComponent,
  StatusComponent,
  TagComponent,
  TaxonComponent,
  UsedComponent,
} from '../src/schemas/components.js';
import { trustEntityRef, trustSpecimenId } from '../src/schemas/identifiers.js';
import { decodeLabEntity } from '../src/schemas/provenance.js';
import {
  ACCEPTED_BOUNDARIES,
  EMPTY_RAIL_CARD_VIDS,
  REFUSED_BOUNDARIES,
  W7_BOUNDARY,
  WORKBENCH_COMPOSITION,
} from '../src/ui/WorkbenchComposition.js';
import type { WorkbenchProvenance } from '../src/ui/WorkbenchRecord.js';
import { localityOf, nextStatus, statusOf } from '../src/schemas/specimen.js';
import type { Specimen } from '../src/schemas/specimen.js';
import {
  createCatalog,
  type SpecimenRpcClient,
} from '../src/ui/catalog-stx.js';
import { AnalogCard } from '../src/ui/AnalogCard.js';
import { AppShell } from '../src/ui/AppShell.js';
import { DossierView } from '../src/ui/DossierView.js';
import { IntakeDrop } from '../src/ui/IntakeDrop.js';
import { SpecimenRail } from '../src/ui/SpecimenRail.js';
import { WorkingPanel } from '../src/ui/WorkingPanel.js';
import {
  WORKBENCH_CHROME,
  createWorkbenchSockets,
} from '../src/ui/WorkbenchSockets.js';
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
  'VOL: 04',
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

function WorkbenchPage({
  client,
  provenance,
}: {
  readonly client: SpecimenRpcClient;
  readonly provenance?: WorkbenchProvenance;
}) {
  const catalog = useMemo(() => createCatalog(client), [client]);
  return React.createElement(SpecimenRail, { catalog, provenance });
}

const emptyWorkbenchCards = (view: {
  getAllByTestId: (id: string) => HTMLElement[];
  queryByTestId: (id: string) => HTMLElement | null;
}) => {
  const cards = view.getAllByTestId('card-chrome');
  expect(cards).toHaveLength(EMPTY_RAIL_CARD_VIDS.length);
  expect(cards.map((card) => card.getAttribute('vid'))).toEqual([
    ...EMPTY_RAIL_CARD_VIDS,
  ]);
  expect(view.queryByTestId('specimen-card')).toBeNull();
  for (const card of cards) {
    expect(card.querySelector('.workbench-empty-title')).toBeTruthy();
    expect(card.querySelector('.workbench-empty-status')).toBeTruthy();
    expect(card.querySelector('.workbench-empty-claim')).toBeTruthy();
    expect(card.querySelector('.workbench-empty-caption')).toBeTruthy();
    expect(card.querySelector('.workbench-empty-locality')).toBeTruthy();
    expect(card.querySelectorAll('.workbench-empty-tag')).toHaveLength(3);
    expect(card.querySelector('[data-socket="title"]')?.textContent).toBe('');
    expect(card.querySelector('[data-socket="status"]')?.textContent).toBe('');
    expect(card.querySelector('[data-socket="claim"]')?.textContent).toBe('');
    expect(card.querySelector('[data-socket="scan-type"]')?.textContent).toBe(
      ''
    );
    expect(card.querySelector('[data-socket="locality"]')?.textContent).toBe(
      ''
    );
    expect(
      [...card.querySelectorAll('[data-socket="tag"]')].map(
        (node) => node.textContent
      )
    ).toEqual(['', '', '']);
    expect(card.querySelector('[data-socket="media"]')).toBeTruthy();
    expect(card.textContent).not.toMatch(/WORKING|RAW|FILED/i);
  }
  return cards;
};

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
          component._tag === 'Status'
            ? new StatusComponent({ value: next })
            : component
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
      components: [
        new StatusComponent({ value: 'raw' }),
        new LocalityComponent({ state: 'unknown' }),
      ],
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
    expect(view.getByTestId('intake-zone').textContent).toContain(
      'Initiate_Intake_Protocol'
    );
    expect(view.container.textContent).toContain('SPECIMEN_DB');
    expect(view.container.textContent).toContain('SYS_ONLINE');
    expect(view.container.textContent).toContain('Local Catalog');
    expect(
      view
        .getAllByTestId('kicker')
        .map((node) => node.textContent?.replace(/\s+/g, ' ').trim())
    ).toEqual([
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

    const file = new File([jpegWithoutGps()], 'field.jpg', {
      type: 'image/jpeg',
    });
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
    expect(view.getByTestId('status-pill').getAttribute('data-status')).toBe(
      'raw'
    );
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
    expect(view.getByTestId('protocol-id').textContent).toBe(id);
    expect(view.getByTestId('detail-locality').textContent).toBe('unknown');
    expect(view.getByTestId('detail-status').getAttribute('data-status')).toBe(
      'raw'
    );
    expect(view.queryByTestId('detail-exif')).toBeNull();

    const html = view.container.textContent ?? '';
    for (const banned of BANISHED) {
      expect(html).not.toContain(banned);
    }
  });

  it('Workbench page is the Variant HTML as one component', async () => {
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
    expect(view.getByTestId('specimen-rail')).toBeTruthy();
    expect(view.container.textContent).toContain('SpecimenDB // Core');
    expect(view.container.textContent).toContain(
      'Initiate Intake Sequence // Drop Telemetry Data'
    );
    expect(view.container.textContent).toContain('Properties Log');
    expect(view.container.textContent).toContain('VIEWPORT_XZ');
    expect(view.container.textContent).toContain('Classification');
    expect(view.container.textContent).toContain('Structural Metrics');
    expect(view.container.textContent).toContain('Observation Log');
    expect(view.container.textContent).toContain('ACTIVE_RENDER');
    expect(view.queryByTestId('rail-query')).toBeNull();
    expect(view.queryByTestId('rail-filters')).toBeNull();
    emptyWorkbenchCards(view);
    await waitFor(() => {
      expect(calls.list).toBeGreaterThan(0);
    });
    emptyWorkbenchCards(view);
    const html = view.container.textContent ?? '';
    expect(html).not.toContain('SP-9942-X');
    expect(html).not.toContain('OPTICAL_SCAN');
    expect(html).not.toContain('R: 0.992');
    expect(html).not.toContain('Chordata');
    expect(html).not.toContain('Q QUERY ACCESSION ID');
    expect(html).not.toContain('DRAG_AND_DROP_ASSETS');
    view.unmount();
  });

  it('empty catalog keeps card chrome on both pages', async () => {
    const terminal = render(
      React.createElement(TerminalPage, { client: emptyClient() })
    );
    await waitFor(() => {
      expect(terminal.getByTestId('card-chrome')).toBeTruthy();
    });
    expect(terminal.getByTestId('protocol-id').textContent).toBe('');
    expect(terminal.container.textContent).not.toContain('NO RECORDS');
    expect(terminal.container.textContent).not.toContain('NO SELECTION');
    terminal.unmount();

    const workbench = render(
      React.createElement(WorkbenchPage, { client: emptyClient() })
    );
    await waitFor(() => {
      expect(workbench.getByTestId('specimen-rail')).toBeTruthy();
      emptyWorkbenchCards(workbench);
    });
    expect(workbench.getByTestId('last-updated').textContent).toBe(
      'LAST_UPDATED'
    );
    expect(workbench.container.textContent).not.toContain('NO RECORDS');
    expect(workbench.container.textContent).not.toContain('NO SELECTION');
    workbench.unmount();
  });

  it('Workbench does not bind query, filters, or intake-file', async () => {
    const view = render(
      React.createElement(WorkbenchPage, { client: emptyClient() })
    );
    await waitFor(() => {
      emptyWorkbenchCards(view);
    });
    expect(view.queryByTestId('rail-query')).toBeNull();
    expect(view.queryByTestId('rail-filters')).toBeNull();
    expect(view.queryByTestId('intake-file')).toBeNull();
    expect(view.queryByTestId('specimen-card')).toBeNull();
    view.unmount();
  });

  it('keeps Workbench source scrollbar treatment', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const css = readFileSync(
      resolve(process.cwd(), 'src/ui/ImportedWorkbench.css'),
      'utf8'
    );
    expect(css).toContain('width: 4px');
    expect(css).toContain('height: 4px');
    expect(css).toContain('border-left: 1px solid #1a1a1a');
    expect(css).toContain('background: #333');
    expect(css).toContain('background: #555');
    expect(css).toContain('scrollbar-width: thin');
    expect(css).toContain('min-width: 9ch');
    expect(css).toContain('min-width: 4.75rem');
    expect(css).toContain('min-width: 7ch');
    expect(css).toContain('min-width: 12ch');
    expect(css).toContain('workbench-empty-caption');
    expect(css).toContain('workbench-empty-value');
    expect(css).not.toContain('scrollbar-width: none');
    expect(css).not.toMatch(
      /\.imported-workbench \*::-webkit-scrollbar\s*\{[^}]*display:\s*none/s
    );
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
      fireEvent.change(view.getByTestId('intake-file'), {
        target: { files: [csv] },
      });
    });
    await waitFor(() => {
      expect(view.getByTestId('intake-error').textContent).toBe(
        'JPEG/HEIC first'
      );
    });
    expect(intake).toBe(0);
    expect(view.getByTestId('card-chrome')).toBeTruthy();
  });

  it('Workbench drop zone and Export DB / Run Sim are look-only chrome', async () => {
    const blobs: Blob[] = [];
    const realCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (obj) => {
      if (obj instanceof Blob) blobs.push(obj);
      return realCreate(obj);
    };
    const downloads: string[] = [];
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function clickStub(
      this: HTMLAnchorElement
    ) {
      downloads.push(this.download);
    };

    try {
      const view = render(
        React.createElement(WorkbenchPage, { client: emptyClient() })
      );
      expect(view.container.textContent).toContain(
        'Initiate Intake Sequence // Drop Telemetry Data'
      );
      expect(view.container.textContent).toContain('Export DB');
      expect(view.container.textContent).toContain('Run Sim');
      expect(view.queryByTestId('intake-file')).toBeNull();

      const buttons = [...view.container.querySelectorAll('button')];
      for (const button of buttons) {
        await act(async () => {
          fireEvent.click(button);
        });
      }
      expect(blobs).toHaveLength(0);
      expect(downloads).toHaveLength(0);
      view.unmount();
    } finally {
      URL.createObjectURL = realCreate;
      HTMLAnchorElement.prototype.click = realClick;
    }
  });

  it('Terminal PROTOCOL ID and process log bind branded id and arrived EXIF tags', async () => {
    const id = trustSpecimenId('11111111-1111-4111-8111-111111111111');
    const specimen: Specimen = {
      id,
      createdAt: '2026-08-20T00:00:00.000Z',
      components: [
        new StatusComponent({ value: 'raw' }),
        new LocalityComponent({ state: 'unknown' }),
        new ExifComponent({
          tags: {
            DateTimeOriginal: '2026:08:20 12:00:00',
            Make: 'FieldCam',
            GPSLatitude: 37,
          },
        }),
      ],
    };
    const client: SpecimenRpcClient = {
      List: () => Effect.succeed([specimen]),
      Get: () => Effect.succeed(specimen),
      Intake: () => Effect.die('Intake should not run'),
      Promote: () => Effect.die('Promote should not run'),
    };
    const view = render(React.createElement(TerminalPage, { client }));
    await waitFor(() => {
      expect(view.getByTestId('specimen-id').textContent).toBe(id);
    });
    await act(async () => {
      fireEvent.click(view.getByTestId('specimen-card'));
    });
    await waitFor(() => {
      expect(view.getByTestId('protocol-id').textContent).toBe(id);
    });
    const lines = view
      .getAllByTestId('detail-exif')
      .map((node) => node.textContent);
    expect(lines).toContain('DateTimeOriginal 2026:08:20 12:00:00');
    expect(lines).toContain('Make FieldCam');
    expect(view.container.textContent).not.toContain('GPSLatitude');
    expect(view.container.textContent).not.toContain('SP-2023-084');
  });

  it('Workbench Phase 0 keeps blank slots and does not Promote', async () => {
    let promote = 0;
    const client: SpecimenRpcClient = {
      List: () => Effect.succeed([]),
      Get: () => Effect.die('Get should not run'),
      Intake: () => Effect.die('Intake should not run'),
      Promote: () => {
        promote += 1;
        return Effect.die('Promote should not run');
      },
    };
    const view = render(React.createElement(WorkbenchPage, { client }));
    const html = view.container.textContent ?? '';
    emptyWorkbenchCards(view);
    expect(html).toContain('Phylum');
    expect(html).toContain('Class');
    expect(html).toContain('Order');
    expect(html).toContain('Family');
    expect(html).not.toContain('SP-9942-X');
    expect(html).not.toContain('Chordata');
    expect(html).not.toContain('Mammalia');
    expect(html).not.toContain('14.5995');
    expect(html).not.toContain('120.4 MPa');
    expect(view.queryByTestId('status-pill')).toBeNull();
    expect(view.queryByTestId('intake-file')).toBeNull();
    expect(promote).toBe(0);
    view.unmount();
  });

  it('Workbench sockets start empty and chrome labels still render', async () => {
    const first = createWorkbenchSockets();
    const second = createWorkbenchSockets();
    expect(first.status).not.toBe(second.status);
    expect(first.intake.get().mode).toBe('chrome');
    expect(first.selectedId.get().well._tag).toBe('IdEmpty');
    expect(first.railQuery.get().query).toBe('');
    expect(first.title.get().well._tag).toBe('IdEmpty');
    expect(first.status.get().phase).toBe('empty');
    expect(first.locality.get().well._tag).toBe('LocalityEmpty');
    expect(first.claim.get().well._tag).toBe('TextEmpty');
    expect(first.tags.get().first._tag).toBe('TagEmpty');
    expect(first.tags.get().second._tag).toBe('TagEmpty');
    expect(first.tags.get().third._tag).toBe('TagEmpty');
    expect(first.media.get().well._tag).toBe('MediaEmpty');
    expect(first.media.get().caption._tag).toBe('TextEmpty');
    expect(first.taxon.get().phylum._tag).toBe('TextEmpty');
    expect(first.taxon.get().class._tag).toBe('TextEmpty');
    expect(first.taxon.get().order._tag).toBe('TextEmpty');
    expect(first.taxon.get().family._tag).toBe('TextEmpty');
    expect(first.metrics.get().tensile._tag).toBe('TextEmpty');
    expect(first.metrics.get().density._tag).toBe('TextEmpty');
    expect(first.metrics.get().hardness._tag).toBe('TextEmpty');
    expect(first.metrics.get().overlap._tag).toBe('TextEmpty');
    expect(first.metrics.get().note._tag).toBe('TextEmpty');
    expect(first.observation.get().first._tag).toBe('TextEmpty');
    expect(first.observation.get().second._tag).toBe('TextEmpty');
    expect(first.lastUpdated.get().well._tag).toBe('InstantEmpty');
    expect(first.viewport.get().mag._tag).toBe('TextEmpty');
    expect(first.viewport.get().readout._tag).toBe('TextEmpty');

    const view = render(
      React.createElement(WorkbenchPage, { client: emptyClient() })
    );
    await waitFor(() => {
      emptyWorkbenchCards(view);
    });
    expect(
      view.container.querySelector('[data-chrome="header"]')?.textContent
    ).toBe(WORKBENCH_CHROME.header);
    expect(
      view.container.querySelector('[data-chrome="intake"]')?.textContent
    ).toContain(WORKBENCH_CHROME.intake);
    expect(
      view.container.querySelector('[data-chrome="viewport-xz"]')?.textContent
    ).toBe(WORKBENCH_CHROME.viewport);
    expect(
      view.container.querySelector('[data-chrome="mag"]')?.textContent
    ).toBe(WORKBENCH_CHROME.mag);
    expect(
      view.container.querySelector('[data-chrome="active-render"]')?.textContent
    ).toContain(WORKBENCH_CHROME.activeRender);
    expect(
      view.container.querySelector('[data-chrome="export-db"]')?.textContent
    ).toBe(WORKBENCH_CHROME.exportDb);
    expect(
      view.container.querySelector('[data-chrome="run-sim"]')?.textContent
    ).toBe(WORKBENCH_CHROME.runSim);
    expect(
      view.container.querySelector('[data-chrome="classification"]')
        ?.textContent
    ).toBe(WORKBENCH_CHROME.classification);
    expect(
      view.container.querySelector('[data-chrome="structural-metrics"]')
        ?.textContent
    ).toBe(WORKBENCH_CHROME.structuralMetrics);
    expect(
      view.container.querySelector('[data-chrome="observation-log"]')
        ?.textContent
    ).toBe(WORKBENCH_CHROME.observationLog);
    expect(
      view.container.querySelector('[data-chrome="last-updated"]')?.textContent
    ).toBe(WORKBENCH_CHROME.lastUpdated);
    expect(
      view.container.querySelector('[data-socket="viewport-mag"]')?.textContent
    ).toBe(WORKBENCH_CHROME.mag);
    expect(
      view.container.querySelector('[data-socket="viewport-readout"]')
        ?.textContent
    ).toBe('');
    expect(
      view.container.querySelector('[data-socket="taxon-phylum"]')?.textContent
    ).toBe('');
    expect(
      view.container.querySelector('[data-socket="taxon-class"]')?.textContent
    ).toBe('');
    expect(
      view.container.querySelector('[data-socket="taxon-order"]')?.textContent
    ).toBe('');
    expect(
      view.container.querySelector('[data-socket="taxon-family"]')?.textContent
    ).toBe('');
    expect(
      view.container.querySelector('[data-socket="metrics-tensile"]')
        ?.textContent
    ).toBe('');
    expect(
      view.container.querySelector('[data-socket="observation-first"]')
        ?.textContent
    ).toBe('');
    expect(
      view.container.querySelector('[data-socket="last-updated"]')?.textContent
    ).toBe('');
    expect(view.container.querySelector('.workbench-empty-stage-id')).toBeTruthy();
    expect(
      view.container.querySelector('.workbench-empty-stage-claim')
    ).toBeTruthy();
    expect(view.container.querySelectorAll('.workbench-empty-value').length).toBe(
      8
    );
    expect(
      view.container.querySelector('.workbench-empty-timestamp')
    ).toBeTruthy();
    expect(view.queryByTestId('rail-query')).toBeNull();
    expect(view.queryByTestId('status-pill')).toBeNull();
    const html = view.container.textContent ?? '';
    expect(html).not.toContain('400x');
    expect(html).not.toContain('SP-9942-X');
    expect(html).not.toContain('OPTICAL_SCAN');
    expect(html).not.toContain('R: 0.992');
    expect(html).not.toContain('Chordata');
    expect(html).not.toContain('WORKING');
    view.unmount();
  });

  it('Workbench composition IR accepts named regions and refuses shell splits', () => {
    const accepted = ACCEPTED_BOUNDARIES.map((boundary) => boundary.name);
    expect(accepted).toEqual([
      'WorkbenchHeader',
      'WorkbenchCardList',
      'WorkbenchCard',
      'WorkbenchIntakeChrome',
      'WorkbenchStage',
      'WorkbenchViewport',
      'WorkbenchPropertiesLog',
      'WorkbenchClassification',
      'WorkbenchStructuralMetrics',
      'WorkbenchObservationLog',
      'WorkbenchPropertyRow',
    ]);
    expect(REFUSED_BOUNDARIES.map((boundary) => boundary.name)).toEqual([
      'DocumentShell',
      'FlexSplit',
      'SpacingWrapper',
      'LabelControlSplit',
      'W7Pane',
    ]);
    expect(W7_BOUNDARY.status).toBe('no-separate-pane');
    expect(WORKBENCH_COMPOSITION.stylingOnly).toBe(true);
    expect(WORKBENCH_COMPOSITION.vid).toBe('12');
    expect([...EMPTY_RAIL_CARD_VIDS]).toEqual(['22', '41', '60']);
  });

  it('Workbench lists real specimens and binds Status, Locality, Media, Claim, tags, Taxon, Used, Generated, Bytes, Observation, createdAt', async () => {
    const id = trustSpecimenId('11111111-1111-4111-8111-111111111111');
    const used = trustEntityRef('gbg:step:B01@fe8f875a');
    const generated = trustEntityRef('gbg:sheet:S01@pr58');
    const bytesSha = 'fe8f875a80b37a1003f05f3a0190fbe2f0417842';
    const specimen: Specimen = {
      id,
      createdAt: '2026-08-20T00:00:00.000Z',
      components: [
        new StatusComponent({ value: 'filed' }),
        new LocalityComponent({ state: 'unknown' }),
        new MediaComponent({
          kind: 'jpeg',
          filename: 'field.jpg',
          assetPath: `memory://${id}/field.jpg`,
          mediaType: 'image/jpeg',
          byteLength: 22,
        }),
        new ClaimComponent({ text: 'attached-claim' }),
        new TagComponent({ value: 'attached-tag' }),
        new TaxonComponent({
          rank: 'phylum',
          scientificName: 'attached-phylum',
        }),
        new TaxonComponent({ rank: 'class', scientificName: 'attached-class' }),
        new ObservationComponent({ text: 'attached-observation' }),
        new UsedComponent({ target: used }),
        new GeneratedComponent({ target: generated }),
        new BytesComponent({ gitSha: bytesSha }),
      ],
    };
    const client: SpecimenRpcClient = {
      List: () => Effect.succeed([specimen]),
      Get: () => Effect.succeed(specimen),
      Intake: () => Effect.die('Intake should not run'),
      Promote: () => Effect.die('Promote should not run'),
    };
    const view = render(React.createElement(WorkbenchPage, { client }));
    await waitFor(() => {
      expect(view.getByTestId('specimen-id').textContent).toBe(id);
    });
    expect(view.queryByTestId('card-chrome')).toBeNull();
    expect(view.getByTestId('status-pill').getAttribute('data-status')).toBe(
      'filed'
    );
    expect(view.getByTestId('locality').textContent).toBe('unknown');
    expect(view.getByTestId('claim').textContent).toBe('attached-claim');
    expect(view.getByTestId('tag').textContent).toBe('attached-tag');
    expect(view.getByTestId('media-caption').textContent).toContain(
      'field.jpg'
    );
    expect(view.getByTestId('media-caption').textContent).toContain('22 B');
    expect(view.getByTestId('media-caption').textContent).toContain(bytesSha);
    expect(view.queryByTestId('media-bytes')).toBeNull();
    expect(view.queryByTestId('intake-file')).toBeNull();

    await act(async () => {
      fireEvent.click(view.getByTestId('specimen-card'));
    });
    await waitFor(() => {
      expect(view.getByTestId('detail-id').textContent).toBe(id);
    });
    expect(view.getByTestId('detail-claim').textContent).toBe('attached-claim');
    expect(view.getByTestId('taxon-phylum').textContent).toBe(
      'attached-phylum'
    );
    expect(view.getByTestId('taxon-class').textContent).toBe('attached-class');
    expect(view.getByTestId('taxon-order').textContent).toBe('');
    expect(view.getByTestId('taxon-family').textContent).toBe('');
    expect(view.getByTestId('observation').textContent).toContain(
      'attached-observation'
    );
    expect(view.getByTestId('last-updated').textContent).toContain(
      'LAST_UPDATED'
    );
    expect(view.getByTestId('last-updated').textContent).toContain(
      '2026-08-20T00:00:00.000Z'
    );
    expect(view.getByTestId('provenance-note').textContent).toContain(used);
    expect(view.getByTestId('provenance-note').textContent).toContain(
      generated
    );
    expect(view.container.textContent).not.toContain('Chordata');
    expect(view.container.textContent).not.toContain('120.4 MPa');
    expect(view.container.textContent).not.toContain('SP-9942-X');
    expect(view.container.textContent).not.toContain('R: 0.992');
    view.unmount();
  });

  it('Workbench does not default missing Status to raw or missing Locality to unknown', async () => {
    const id = trustSpecimenId('11111111-1111-4111-8111-111111111111');
    const specimen: Specimen = {
      id,
      createdAt: '2026-08-20T00:00:00.000Z',
      components: [new ClaimComponent({ text: 'claim-only' })],
    };
    const client: SpecimenRpcClient = {
      List: () => Effect.succeed([specimen]),
      Get: () => Effect.succeed(specimen),
      Intake: () => Effect.die('Intake should not run'),
      Promote: () => Effect.die('Promote should not run'),
    };
    const view = render(React.createElement(WorkbenchPage, { client }));
    await waitFor(() => {
      expect(view.getByTestId('specimen-id').textContent).toBe(id);
    });
    expect(view.queryByTestId('status-pill')).toBeNull();
    expect(view.queryByTestId('locality')).toBeNull();
    expect(view.getByTestId('claim').textContent).toBe('claim-only');
    const card = view.getByTestId('specimen-card');
    expect(card.textContent).not.toContain('raw');
    expect(card.querySelector('[vid="36"]')?.textContent).toBe('');
    view.unmount();
  });

  it('Workbench paints a real preview URL and fixed Locality without inventing GPS', async () => {
    const id = trustSpecimenId('11111111-1111-4111-8111-111111111111');
    const specimen: Specimen = {
      id,
      createdAt: '2026-08-20T00:00:00.000Z',
      components: [
        new StatusComponent({ value: 'raw' }),
        new LocalityComponent({
          state: 'fixed',
          latitude: 37,
          longitude: -122,
          source: 'exif',
        }),
        new MediaComponent({
          kind: 'jpeg',
          filename: 'located.jpg',
          assetPath: `memory://${id}/located.jpg`,
          mediaType: 'image/jpeg',
          byteLength: 8,
        }),
      ],
    };
    const client: SpecimenRpcClient = {
      List: () => Effect.succeed([specimen]),
      Get: () => Effect.succeed(specimen),
      Intake: () => Effect.die('Intake should not run'),
      Promote: () => Effect.die('Promote should not run'),
    };
    const catalog = createCatalog(client);
    catalog.store.set({
      ...catalog.store.get(),
      previews: { [id]: 'blob:http://localhost/preview' },
    });
    const view = render(React.createElement(SpecimenRail, { catalog }));
    await waitFor(() => {
      expect(view.getByTestId('media-bytes')).toBeTruthy();
    });
    expect(view.getByTestId('media-bytes').getAttribute('src')).toBe(
      'blob:http://localhost/preview'
    );
    expect(view.getByTestId('locality').textContent).toContain('37.0000° N');
    expect(view.getByTestId('locality').textContent).toContain('122.0000° W');
    expect(view.container.textContent).not.toContain('14.5995');
    view.unmount();
  });

  it('Workbench optional LabEntity fills Used, Generated, and W7; empty rail cards stay empty', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const fixturesDir = join(
      dirname(fileURLToPath(import.meta.url)),
      'fixtures',
      'provenance'
    );
    const entity = decodeLabEntity(
      JSON.parse(
        readFileSync(
          join(fixturesDir, 'activity-freecad-part-occt.json'),
          'utf8'
        )
      ) as unknown
    );
    const view = render(
      React.createElement(WorkbenchPage, {
        client: emptyClient(),
        provenance: { kind: 'lab-entity', entity },
      })
    );
    await waitFor(() => {
      emptyWorkbenchCards(view);
    });
    expect(view.getByTestId('provenance-note').textContent).toContain(
      'gbg:step:B01@fe8f875a'
    );
    expect(view.queryByTestId('media-caption')).toBeNull();
    expect(view.queryByTestId('media-metadata')).toBeNull();
    expect(view.getAllByTestId('w7').map((node) => node.textContent)).toEqual(
      expect.arrayContaining([
        'W7 WHO freecad-part-occt',
        'W7 WHERE unknown',
        'W7 WHY #28',
        'W7 HOW freecad-part-occt',
      ])
    );
    expect(view.queryByTestId('intake-file')).toBeNull();
    expect(W7_BOUNDARY.status).toBe('no-separate-pane');
    view.unmount();
  });

  it('Workbench promotes a real Status pill and leaves empty chrome inert', async () => {
    const id = trustSpecimenId('11111111-1111-4111-8111-111111111111');
    const { client, calls } = promotingClient({
      id,
      createdAt: '2026-08-20T00:00:00.000Z',
      components: [new StatusComponent({ value: 'raw' })],
    });
    const view = render(React.createElement(WorkbenchPage, { client }));
    await waitFor(() => {
      expect(view.getByTestId('status-pill').getAttribute('data-status')).toBe(
        'raw'
      );
    });
    await act(async () => {
      fireEvent.click(view.getByTestId('status-pill'));
    });
    await waitFor(() => {
      expect(view.getByTestId('status-pill').getAttribute('data-status')).toBe(
        'filed'
      );
    });
    expect(calls.promote).toBe(1);
    view.unmount();
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
              expect(view.getByTestId('rail-online').textContent).toContain(
                'ONLINE'
              );
            })
          );

          const bare = new File([jpegWithoutGps()], 'leaf.jpg', {
            type: 'image/jpeg',
          });
          yield* Effect.promise(() =>
            act(async () => {
              fireEvent.change(view.getByTestId('intake-file'), {
                target: { files: [bare] },
              });
            })
          );
          yield* Effect.promise(() =>
            waitFor(() => {
              expect(view.getAllByTestId('locality')[0]?.textContent).toBe(
                'unknown'
              );
              expect(
                view.getByTestId('status-pill').getAttribute('data-status')
              ).toBe('raw');
              expect(view.getByTestId('claim').textContent).toBe('');
            })
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
              const localities = view
                .getAllByTestId('locality')
                .map((n) => n.textContent);
              expect(localities).toContain('unknown');
              expect(
                localities.some((text) => text?.includes('37.0000° N'))
              ).toBe(true);
            })
          );

          const html = view.container.textContent ?? '';
          expect(html).not.toContain('SP-2023-084');
          expect(html).not.toContain('SEQ-882.C');
          expect(html).not.toContain('SPC-88.94X');
          expect(html).not.toContain('99.8%');
          view.unmount();
        })
      ).pipe(Effect.provide(MemoryCatalogLive)) as Effect.Effect<void>
    );
  });

  it('keeps the Terminal 4px scrollbar chrome visible on both pages', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const css = readFileSync(
      resolve(process.cwd(), 'src/ui/catalog.css'),
      'utf8'
    );
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
    const css = readFileSync(
      resolve(process.cwd(), 'src/ui/catalog.css'),
      'utf8'
    );
    expect(css).not.toContain('--charcoal-100');
    expect(css).not.toContain('--font-sans');
    expect(css).not.toContain('--font-mono');
    expect(css).toMatch(/\.sdb-terminal\s*\{[^}]*font-family:\s*Inter/s);
    expect(css).toMatch(/\.sdb-workbench\s*\{[^}]*IBM Plex Mono/s);
    expect(css).toContain('ui-monospace');
    expect(css).toContain('background-size: 24px 24px');
    expect(css).toContain('rgba(255, 255, 255, 0.02)');
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
    readonly Page: (props: {
      readonly client: SpecimenRpcClient;
    }) => React.ReactElement;
    readonly testId: string;
    readonly copy: ReadonlyArray<string>;
    readonly emptyChrome: boolean;
    readonly stripTheater: boolean;
  }> = [
    {
      name: 'Terminal',
      Page: TerminalPage,
      testId: 'intake-drop',
      copy: ['Initiate_Intake_Protocol', 'Local Catalog', 'SYS_ONLINE'],
      emptyChrome: true,
      stripTheater: true,
    },
    {
      name: 'Workbench',
      Page: WorkbenchPage,
      testId: 'specimen-rail',
      copy: ['SpecimenDB // Core', 'VIEWPORT_XZ', 'Properties Log'],
      emptyChrome: true,
      stripTheater: true,
    },
    {
      name: 'Assay',
      Page: AssayPage,
      testId: 'working-panel',
      copy: [
        'INITIATE_INTAKE_PROTOCOL',
        'CURRENT_FOCUS_RECORD',
        'VIEWPORT_01',
        'INSTRUMENT_READOUT',
        'ENV_CONTEXT',
        'OBSERVATION_LOG',
        'CH_01_VIS',
      ],
      emptyChrome: true,
      stripTheater: true,
    },
    {
      name: 'Dactyl',
      Page: DactylPage,
      testId: 'dactyl-grid',
      copy: ['INITIATE INTAKE', 'Active Queue', 'SYSTEM.CORE'],
      emptyChrome: true,
      stripTheater: true,
    },
    {
      name: 'Catalog',
      Page: CatalogPage,
      testId: 'app-shell',
      copy: ['SPECIMEN_DB / CATALOG', 'Intake Drop Zone', 'SPECIMEN_DB'],
      emptyChrome: true,
      stripTheater: true,
    },
    {
      name: 'Accession',
      Page: AccessionPage,
      testId: 'dossier-view',
      copy: [
        'PHOTO RAIL',
        'TAXONOMY_DATA',
        'FIELD_METRICS',
        'SPECTRAL_ANALYSIS',
        'OBSERVER_LOG',
      ],
      emptyChrome: true,
      stripTheater: true,
    },
  ];

  for (const page of pages) {
    it(`${page.name} is a full page${
      page.emptyChrome ? ' with empty card chrome' : ''
    }`, async () => {
      const view = render(
        React.createElement(page.Page, { client: emptyClient() })
      );
      await waitFor(() => {
        expect(view.getByTestId(page.testId)).toBeTruthy();
      });
      if (page.emptyChrome) {
        if (page.name === 'Workbench') {
          emptyWorkbenchCards(view);
        } else {
          expect(view.getByTestId('card-chrome')).toBeTruthy();
        }
      }
      const html = view.container.textContent ?? '';
      for (const snippet of page.copy) {
        expect(html).toContain(snippet);
      }
      if (page.stripTheater) {
        for (const banned of BANISHED) {
          expect(html).not.toContain(banned);
        }
      }
      view.unmount();
    });
  }

  it('Assay/Dactyl/Catalog/Accession now-rows file a no-GPS JPEG as raw + unknown', async () => {
    const id = trustSpecimenId('11111111-1111-4111-8111-111111111111');
    const specimen: Specimen = {
      id,
      createdAt: '2026-08-20T00:00:00.000Z',
      components: [
        new StatusComponent({ value: 'raw' }),
        new LocalityComponent({ state: 'unknown' }),
      ],
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
          return Effect.succeed({
            specimenId: id,
            components: next.components,
          });
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
      const file = new File([jpegWithoutGps()], 'field.jpg', {
        type: 'image/jpeg',
      });
      await act(async () => {
        fireEvent.change(view.getByTestId('intake-file'), {
          target: { files: [file] },
        });
      });
      await waitFor(() => {
        expect(view.getByTestId('specimen-id').textContent).toBe(id);
      });
      expect(view.getByTestId('status-pill').getAttribute('data-status')).toBe(
        'raw'
      );
      expect(view.getByTestId('locality').textContent).toBe('unknown');
      expect(view.getByTestId('claim').textContent).toBe('');
      view.unmount();
    }
  });

  it('keeps Assay 4px rail scrollbars and Dactyl 6px scrollbars', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const assay = readFileSync(
      resolve(process.cwd(), 'src/ui/assay.css'),
      'utf8'
    );
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
    const dactyl = readFileSync(
      resolve(process.cwd(), 'src/ui/dactyl.css'),
      'utf8'
    );
    expect(dactyl).toContain('background: #020202');
    expect(dactyl).toContain('width: 6px');
    expect(dactyl).toContain('background: #1a1a1a');
    expect(dactyl).toContain('#083344');
    expect(dactyl).toContain('#06b6d4');
    expect(dactyl).toContain('width: 320px');
  });

  it('status chrome promotes raw → filed → working → dead on every page and stops', async () => {
    const pages = [
      TerminalPage,
      AssayPage,
      DactylPage,
      CatalogPage,
      AccessionPage,
    ];
    for (const Page of pages) {
      const id = trustSpecimenId('11111111-1111-4111-8111-111111111111');
      const { client, calls } = promotingClient({
        id,
        createdAt: '2026-08-20T00:00:00.000Z',
        components: [
          new StatusComponent({ value: 'raw' }),
          new LocalityComponent({ state: 'unknown' }),
        ],
      });
      const view = render(React.createElement(Page, { client }));
      await waitFor(() => {
        expect(
          view.getByTestId('status-pill').getAttribute('data-status')
        ).toBe('raw');
      });
      for (const status of ['filed', 'working', 'dead'] as const) {
        await act(async () => {
          fireEvent.click(view.getByTestId('status-pill'));
        });
        await waitFor(() => {
          expect(
            view.getByTestId('status-pill').getAttribute('data-status')
          ).toBe(status);
        });
      }
      await act(async () => {
        fireEvent.click(view.getByTestId('status-pill'));
      });
      await waitFor(() => {
        expect(
          view.getByTestId('status-pill').getAttribute('data-status')
        ).toBe('dead');
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
    const chromeStatus = view
      .getByTestId('card-chrome')
      .querySelector('[data-status="raw"]');
    expect(chromeStatus).toBeTruthy();
    await act(async () => {
      fireEvent.click(chromeStatus!);
    });
    expect(promote).toBe(0);
    expect(
      view.getByTestId('card-chrome').querySelector('[data-promote]')
    ).toBeNull();
    const analysis = [
      ...view.container.querySelectorAll('[data-status="working"]'),
    ].find((node) => node.textContent?.includes('ANALYSIS_ACTIVE'));
    expect(analysis).toBeTruthy();
    await act(async () => {
      fireEvent.click(analysis!);
    });
    expect(promote).toBe(0);
  });

  it('commits the functionalization journal as SoT with the now-rows', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const journal = readFileSync(
      resolve(process.cwd(), 'docs/functionalization-journal.md'),
      'utf8'
    );
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
      'F-110',
      'F-111',
      'F-112',
      'F-113',
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
    const synth = readFileSync(
      resolve(process.cwd(), 'docs/page-function-synth.md'),
      'utf8'
    );
    expect(synth).toContain('Page-function synth');
    expect(synth).toContain('GetMedia');
    expect(synth).toContain('EXECUTE ASSAY');
    expect(synth).toContain('capture→store');
  });
});
