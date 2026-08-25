/**
 * DossierView — full Accession page. Fat dossier chrome from Variant board stills
 * (no HTML extract on the branch). Id / taxonomy / field-metrics / spectral /
 * observer-log wells stay drawn. Now-slots only when a selected specimen exists.
 * Status / Locality / Media / Intake are the same primitives as Workbench.
 *
 * @module @tmnl/specimendb/ui
 */

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useFocus, useStx } from '@tmnl/stx';
import type { Specimen } from '../schemas/specimen.js';
import {
  at,
  onStatusPromote,
  visibleSpecimens,
  type CatalogState,
  type CatalogSurface,
} from './catalog-stx.js';
import { imgSrcLabel } from './catalog-view.js';
import { Intake } from './Intake.js';
import { Locality } from './Locality.js';
import { Media } from './Media.js';
import { Status } from './Status.js';
import { useIntakeBind, type IntakeBind } from './intake-bind.js';
import {
  EMPTY_WORKBENCH_VIEW,
  projectWorkbenchRecord,
  wellText,
  type WorkbenchRecordView,
} from './WorkbenchRecord.js';
import './accession.css';

type DossierContextValue = {
  readonly catalog: CatalogSurface;
  readonly bind: IntakeBind;
};

const DossierContext = createContext<DossierContextValue | null>(null);

const useDossier = (): DossierContextValue => {
  const ctx = useContext(DossierContext);
  if (ctx === null) {
    throw new Error(
      'DossierView compound components must be used within DossierView'
    );
  }
  return ctx;
};

const TAXON_RANKS = [
  'KINGDOM',
  'PHYLUM',
  'CLASS',
  'ORDER',
  'FAMILY',
  'GENUS',
  'SPECIES',
] as const;
const SPECTRAL_COLS = [
  'WAVELENGTH (NM)',
  'REFLECTANCE (%)',
  'ABSORPTION (%)',
  'SCATTER (%)',
] as const;
const SPECTRAL_ROWS = 6;

export type DossierViewProps = {
  readonly catalog: CatalogSurface;
  readonly children?: ReactNode;
};

function DossierViewRoot({ catalog, children }: DossierViewProps) {
  const bind = useIntakeBind(catalog);

  useEffect(() => {
    void catalog.list();
  }, [catalog]);

  return (
    <DossierContext.Provider value={{ catalog, bind }}>
      <div className="sdb-dossier" data-testid="dossier-view">
        {children ?? (
          <>
            <aside className="sdb-x-rail">
              <header className="sdb-x-rail-head">PHOTO RAIL</header>
              <DossierViewIntake />
              <DossierViewRail />
            </aside>
            <main className="sdb-x-main">
              <DossierViewBody />
            </main>
          </>
        )}
      </div>
    </DossierContext.Provider>
  );
}

function DossierViewIntake() {
  const { catalog, bind } = useDossier();
  const intakeStatus = useFocus(
    catalog.store,
    at<CatalogState['intakeStatus']>(catalog.store.lens.intakeStatus)
  );
  const intakeError = useFocus(
    catalog.store,
    at<CatalogState['intakeError']>(catalog.store.lens.intakeError)
  );

  return (
    <Intake
      kind="live"
      className="sdb-x-zone"
      bind={bind}
      status={intakeStatus}
      error={intakeError}
    >
      <span className="sdb-x-zone-kicker">// ACCESSION_INTAKE</span>
      <span>
        {intakeStatus === 'dropping' ? 'INTAKE_IN_FLIGHT' : 'DROP FIELD MEDIA'}
      </span>
    </Intake>
  );
}

function PhotoChrome() {
  return (
    <article
      className="sdb-x-thumb"
      data-empty="true"
      data-testid="card-chrome"
    >
      <Media kind="empty" className="sdb-x-thumb-well" />
      <Status kind="empty" tag="span" className="sdb-x-chip" />
      <Locality kind="empty" tag="span" />
    </article>
  );
}

function DossierThumbMedia({ view }: { readonly view: WorkbenchRecordView }) {
  if (view.media.kind === 'preview') {
    return (
      <Media
        kind="bytes"
        className="sdb-x-thumb-well"
        src={view.media.src}
        testId="media-bytes"
      />
    );
  }
  if (view.media.kind === 'metadata') {
    return (
      <Media
        kind="label"
        className="sdb-x-thumb-well"
        label={view.media.caption}
        labelClassName="sdb-x-imgsrc"
        testId="media-metadata"
      />
    );
  }
  return <Media kind="empty" className="sdb-x-thumb-well" />;
}

function DossierViewRail() {
  const { catalog } = useDossier();
  const { value } = useStx(catalog.store);
  const rows = visibleSpecimens(value);
  const previews = value.previews;

  return (
    <div className="sdb-x-thumbs" data-testid="rail-list">
      {rows.length === 0 ? (
        <PhotoChrome />
      ) : (
        rows.map((specimen) => (
          <DossierThumb
            key={specimen.id}
            specimen={specimen}
            preview={previews[specimen.id]}
          />
        ))
      )}
    </div>
  );
}

function DossierThumb({
  specimen,
  preview,
}: {
  readonly specimen: Specimen;
  readonly preview?: string;
}) {
  const { catalog } = useDossier();
  const selectedId = useFocus(
    catalog.store,
    at<CatalogState['selectedId']>(catalog.store.lens.selectedId)
  );
  const view = projectWorkbenchRecord({ kind: 'specimen', specimen, preview });

  return (
    <button
      type="button"
      className="sdb-x-thumb"
      data-testid="specimen-card"
      data-selected={selectedId === specimen.id ? 'true' : 'false'}
      onClick={() => void catalog.select(specimen.id)}
    >
      <DossierThumbMedia view={view} />
      <span className="sdb-x-id" data-testid="specimen-id">
        {specimen.id}
      </span>
      {view.status.kind === 'value' ? (
        <Status
          kind="value"
          tag="span"
          className="sdb-x-chip"
          value={view.status.value}
          testId="status-pill"
          onPromote={onStatusPromote(catalog, specimen.id)}
        />
      ) : (
        <Status kind="empty" tag="span" className="sdb-x-chip" />
      )}
      {view.locality.kind === 'value' ? (
        <Locality
          kind="value"
          tag="span"
          testId="locality"
          label={view.locality.label}
        />
      ) : (
        <Locality kind="empty" tag="span" />
      )}
      <span data-testid="claim">{wellText(view.claim)}</span>
    </button>
  );
}

function DossierLeadMedia({
  view,
  sourceLabel,
}: {
  readonly view: WorkbenchRecordView;
  readonly sourceLabel: string;
}) {
  if (view.media.kind === 'preview') {
    return (
      <Media kind="bytes" className="sdb-x-photo" src={view.media.src}>
        <span className="sdb-x-imgsrc">{sourceLabel}</span>
      </Media>
    );
  }
  if (view.media.kind === 'metadata') {
    return (
      <Media
        kind="label"
        className="sdb-x-photo"
        label={view.media.caption}
        labelClassName="sdb-x-imgsrc"
        testId="detail-media-metadata"
      />
    );
  }
  return (
    <Media kind="empty" className="sdb-x-photo">
      <span className="sdb-x-imgsrc">{sourceLabel}</span>
    </Media>
  );
}

const taxonValue = (
  view: WorkbenchRecordView,
  rank: (typeof TAXON_RANKS)[number]
): string => {
  switch (rank) {
    case 'PHYLUM':
      return wellText(view.taxon.phylum);
    case 'CLASS':
      return wellText(view.taxon.class);
    case 'ORDER':
      return wellText(view.taxon.order);
    case 'FAMILY':
      return wellText(view.taxon.family);
    case 'KINGDOM':
    case 'GENUS':
    case 'SPECIES':
      return '';
    default: {
      const _exhaustive: never = rank;
      return _exhaustive;
    }
  }
};

function DossierViewBody() {
  const { catalog } = useDossier();
  const selected = useFocus(
    catalog.store,
    at<CatalogState['selected']>(catalog.store.lens.selected)
  );
  const previews = useFocus(
    catalog.store,
    at<CatalogState['previews']>(catalog.store.lens.previews)
  );
  const preview = selected === null ? undefined : previews[selected.id];
  const view =
    selected === null
      ? EMPTY_WORKBENCH_VIEW
      : projectWorkbenchRecord({
          kind: 'specimen',
          specimen: selected,
          preview,
        });
  const observationLines = view.observations.flatMap((observation) =>
    observation.kind === 'value' ? [observation.text] : []
  );

  return (
    <div className="sdb-x-dossier" data-testid="specimen-detail">
      <Intake kind="chrome" className="sdb-x-intake-well">
        <div className="sdb-x-kicker">// ACCESSION_INTAKE</div>
        <div className="sdb-x-dropcap">DROP FIELD MEDIA</div>
      </Intake>

      <header className="sdb-x-lead">
        <DossierLeadMedia
          view={view}
          sourceLabel={selected === null ? 'IMG_SRC' : imgSrcLabel(selected)}
        />
        <div className="sdb-x-lead-copy">
          <div className="sdb-x-meta">
            {view.status.kind === 'value' && selected !== null ? (
              <Status
                kind="value"
                tag="span"
                className="sdb-x-chip"
                value={view.status.value}
                testId="detail-status"
                onPromote={onStatusPromote(catalog, selected.id)}
              />
            ) : (
              <Status
                kind="empty"
                tag="span"
                className="sdb-x-chip"
                testId="detail-status"
              />
            )}
            <span>LAST_MODIFIED</span>
          </div>
          <h1 className="sdb-x-id-lg" data-testid="detail-id">
            {selected?.id ?? ''}
          </h1>
          <p className="sdb-x-claim" data-testid="detail-claim">
            {wellText(view.claim)}
          </p>
          <div className="sdb-x-actions">
            <button type="button" className="sdb-x-btn">
              [ INITIATE_SCAN ]
            </button>
            <button type="button" className="sdb-x-btn">
              [ EDIT_RECORD ]
            </button>
          </div>
        </div>
      </header>

      <div className="sdb-x-wells">
        <section className="sdb-x-section">
          <h2>// TAXONOMY_DATA</h2>
          <table className="sdb-x-table">
            <tbody>
              {TAXON_RANKS.map((rank) => (
                <tr key={rank}>
                  <th>{rank}</th>
                  <td>{taxonValue(view, rank)}</td>
                </tr>
              ))}
              <tr>
                <th>CONFIDENCE</th>
                <td />
              </tr>
            </tbody>
          </table>
        </section>

        <section className="sdb-x-section">
          <h2>// FIELD_METRICS</h2>
          <div className="sdb-x-metrics">
            <div className="sdb-x-metric">
              <div className="sdb-x-kicker">COORDINATES</div>
              {view.locality.kind === 'value' ? (
                <Locality
                  kind="value"
                  tag="div"
                  className="sdb-x-metric-val"
                  testId="detail-locality"
                  label={view.locality.label}
                />
              ) : (
                <Locality
                  kind="empty"
                  tag="div"
                  className="sdb-x-metric-val"
                  testId="detail-locality"
                />
              )}
            </div>
            <div className="sdb-x-metric">
              <div className="sdb-x-kicker">ELEVATION</div>
              <div className="sdb-x-metric-val" />
            </div>
            <div className="sdb-x-metric">
              <div className="sdb-x-kicker">TEMP_AMBIENT</div>
              <div className="sdb-x-metric-val" />
            </div>
          </div>
        </section>

        <section className="sdb-x-section">
          <h2>// SPECTRAL_ANALYSIS [REFLECTANCE]</h2>
          <table className="sdb-x-table sdb-x-spectra-table">
            <thead>
              <tr>
                {SPECTRAL_COLS.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: SPECTRAL_ROWS }, (_, row) => (
                <tr key={`band-${row}`}>
                  {SPECTRAL_COLS.map((col) => (
                    <td key={`${row}:${col}`} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="sdb-x-section sdb-x-span">
          <h2>// OBSERVER_LOG</h2>
          <div className="sdb-x-log">
            {observationLines.map((line, index) => (
              <p key={`${index}:${line}`}>{line}</p>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export const DossierView = Object.assign(DossierViewRoot, {
  Intake: DossierViewIntake,
  Rail: DossierViewRail,
  Body: DossierViewBody,
});
