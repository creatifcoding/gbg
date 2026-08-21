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
import { statusOf } from '../schemas/specimen.js';
import type { Specimen } from '../schemas/specimen.js';
import { at, localityLabel, onStatusPromote, visibleSpecimens, type CatalogState, type CatalogSurface } from './catalog-stx.js';
import { claimLine, imgSrcLabel } from './catalog-view.js';
import { Intake } from './Intake.js';
import { Locality } from './Locality.js';
import { Media } from './Media.js';
import { Status } from './Status.js';
import { useIntakeBind, type IntakeBind } from './intake-bind.js';
import './accession.css';

type DossierContextValue = {
  readonly catalog: CatalogSurface;
  readonly bind: IntakeBind;
};

const DossierContext = createContext<DossierContextValue | null>(null);

const useDossier = (): DossierContextValue => {
  const ctx = useContext(DossierContext);
  if (ctx === null) {
    throw new Error('DossierView compound components must be used within DossierView');
  }
  return ctx;
};

const TAXON_RANKS = ['KINGDOM', 'PHYLUM', 'CLASS', 'ORDER', 'FAMILY', 'GENUS', 'SPECIES'] as const;
const SPECTRAL_COLS = ['WAVELENGTH (NM)', 'REFLECTANCE (%)', 'ABSORPTION (%)', 'SCATTER (%)'] as const;
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
    at<CatalogState['intakeStatus']>(catalog.store.lens.intakeStatus),
  );
  const intakeError = useFocus(
    catalog.store,
    at<CatalogState['intakeError']>(catalog.store.lens.intakeError),
  );

  return (
    <Intake kind="live" className="sdb-x-zone" bind={bind} status={intakeStatus} error={intakeError}>
      <span className="sdb-x-zone-kicker">// ACCESSION_INTAKE</span>
      <span>{intakeStatus === 'dropping' ? 'INTAKE_IN_FLIGHT' : 'DROP FIELD MEDIA'}</span>
    </Intake>
  );
}

function PhotoChrome() {
  return (
    <article className="sdb-x-thumb" data-empty="true" data-testid="card-chrome">
      <Media kind="empty" className="sdb-x-thumb-well" />
      <Status kind="empty" tag="span" className="sdb-x-chip" />
      <Locality kind="empty" tag="span" />
    </article>
  );
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
          <DossierThumb key={specimen.id} specimen={specimen} preview={previews[specimen.id]} />
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
    at<CatalogState['selectedId']>(catalog.store.lens.selectedId),
  );
  const status = statusOf(specimen);

  return (
    <button
      type="button"
      className="sdb-x-thumb"
      data-testid="specimen-card"
      data-selected={selectedId === specimen.id ? 'true' : 'false'}
      onClick={() => void catalog.select(specimen.id)}
    >
      {preview !== undefined ? (
        <Media kind="bytes" className="sdb-x-thumb-well" src={preview} testId="media-bytes" />
      ) : (
        <Media kind="empty" className="sdb-x-thumb-well" />
      )}
      <span className="sdb-x-id" data-testid="specimen-id">
        {specimen.id}
      </span>
      {status !== undefined ? (
        <Status
          kind="value"
          tag="span"
          className="sdb-x-chip"
          value={status}
          testId="status-pill"
          onPromote={onStatusPromote(catalog, specimen.id)}
        />
      ) : (
        <Status kind="empty" tag="span" className="sdb-x-chip" />
      )}
      <Locality kind="value" tag="span" testId="locality" label={localityLabel(specimen)} />
      <span data-testid="claim">{claimLine(specimen)}</span>
    </button>
  );
}

function DossierViewBody() {
  const { catalog } = useDossier();
  const selected = useFocus(
    catalog.store,
    at<CatalogState['selected']>(catalog.store.lens.selected),
  );
  const previews = useFocus(
    catalog.store,
    at<CatalogState['previews']>(catalog.store.lens.previews),
  );
  const status = selected === null ? undefined : statusOf(selected);
  const preview = selected === null ? undefined : previews[selected.id];

  return (
    <div className="sdb-x-dossier" data-testid="specimen-detail">
      <Intake kind="chrome" className="sdb-x-intake-well">
        <div className="sdb-x-kicker">// ACCESSION_INTAKE</div>
        <div className="sdb-x-dropcap">DROP FIELD MEDIA</div>
      </Intake>

      <header className="sdb-x-lead">
        {preview !== undefined ? (
          <Media kind="bytes" className="sdb-x-photo" src={preview}>
            <span className="sdb-x-imgsrc">{selected === null ? 'IMG_SRC' : imgSrcLabel(selected)}</span>
          </Media>
        ) : (
          <Media kind="empty" className="sdb-x-photo">
            <span className="sdb-x-imgsrc">{selected === null ? 'IMG_SRC' : imgSrcLabel(selected)}</span>
          </Media>
        )}
        <div className="sdb-x-lead-copy">
          <div className="sdb-x-meta">
            {status !== undefined && selected !== null ? (
              <Status
                kind="value"
                tag="span"
                className="sdb-x-chip"
                value={status}
                testId="detail-status"
                onPromote={onStatusPromote(catalog, selected.id)}
              />
            ) : (
              <Status kind="empty" tag="span" className="sdb-x-chip" testId="detail-status" />
            )}
            <span>LAST_MODIFIED</span>
          </div>
          <h1 className="sdb-x-id-lg" data-testid="detail-id">
            {selected?.id ?? ''}
          </h1>
          <p className="sdb-x-claim" data-testid="detail-claim">
            {selected === null ? '' : claimLine(selected)}
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
                  <td />
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
              {selected === null ? (
                <Locality kind="empty" tag="div" className="sdb-x-metric-val" testId="detail-locality" />
              ) : (
                <Locality
                  kind="value"
                  tag="div"
                  className="sdb-x-metric-val"
                  testId="detail-locality"
                  label={localityLabel(selected)}
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
          <div className="sdb-x-log" />
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
