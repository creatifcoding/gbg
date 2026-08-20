/**
 * DossierView — full Accession page. Fat dossier: photo rail, claim, status,
 * empty taxonomy table, field-metrics wells, empty spectral grid, empty log.
 *
 * @module @tmnl/specimendb/ui
 */

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useFocus, useStx } from '@tmnl/stx';
import { statusOf } from '../schemas/specimen.js';
import type { Specimen } from '../schemas/specimen.js';
import type { SpecimenStatus } from '../schemas/components.js';
import { at, localityLabel, onStatusPromote, visibleSpecimens, type CatalogState, type CatalogSurface } from './catalog-stx.js';
import { claimLine, imgSrcLabel } from './catalog-view.js';
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

const TAXON_RANKS = ['Kingdom', 'Phylum', 'Class', 'Order', 'Family', 'Genus', 'Species'] as const;
const SPECTRAL_BANDS = ['UV', 'VIOLET', 'BLUE', 'GREEN', 'RED', 'NIR'] as const;

const StatusChip = ({
  status,
  testId,
  onPromote,
}: {
  readonly status: SpecimenStatus;
  readonly testId?: string;
  readonly onPromote?: (event: { readonly stopPropagation: () => void; readonly preventDefault: () => void }) => void;
}) => (
  <span
    className="sdb-x-chip"
    data-status={status}
    data-testid={testId}
    {...(onPromote !== undefined ? { 'data-promote': 'true', onClick: onPromote } : {})}
  >
    {status}
  </span>
);

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
        <input
          ref={bind.inputRef}
          className="sdb-file-input"
          data-testid="intake-file"
          type="file"
          accept="image/jpeg,image/heic,image/heif,.jpg,.jpeg,.heic,.heif"
          multiple
          onChange={bind.onChange}
        />
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
    <>
      <button
        type="button"
        className="sdb-x-zone"
        data-testid="intake-zone"
        data-active={bind.active ? 'true' : 'false'}
        data-status={intakeStatus}
        onClick={bind.open}
        onDragEnter={bind.onDragEnter}
        onDragOver={bind.onDragOver}
        onDragLeave={bind.onDragLeave}
        onDrop={bind.onDrop}
      >
        {intakeStatus === 'dropping' ? 'INTAKE_IN_FLIGHT' : 'FILE TO DOSSIER'}
      </button>
      {intakeError !== null ? (
        <p className="sdb-x-error" data-testid="intake-error">
          {intakeError}
        </p>
      ) : null}
    </>
  );
}

function PhotoChrome() {
  return (
    <article className="sdb-x-thumb" data-empty="true" data-testid="card-chrome">
      <div className="sdb-x-thumb-well" />
      <span className="sdb-x-chip" data-status="raw">
        raw
      </span>
      <span data-testid="locality">unknown</span>
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
  const status = (statusOf(specimen) ?? 'raw') satisfies SpecimenStatus;

  return (
    <button
      type="button"
      className="sdb-x-thumb"
      data-testid="specimen-card"
      data-selected={selectedId === specimen.id ? 'true' : 'false'}
      onClick={() => void catalog.select(specimen.id)}
    >
      <div className="sdb-x-thumb-well">
        {preview !== undefined ? <img src={preview} alt="" data-testid="media-bytes" /> : null}
      </div>
      <span className="sdb-x-id" data-testid="specimen-id">
        {specimen.id}
      </span>
      <span
        className="sdb-x-chip"
        data-status={status}
        data-testid="status-pill"
        data-promote="true"
        onClick={onStatusPromote(catalog, specimen.id)}
      >
        {status}
      </span>
      <span data-testid="locality">{localityLabel(specimen)}</span>
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
  const status = selected === null ? undefined : (statusOf(selected) ?? 'raw');
  const preview = selected === null ? undefined : previews[selected.id];

  return (
    <div className="sdb-x-dossier" data-testid="specimen-detail">
      <header className="sdb-x-lead">
        <div className="sdb-x-photo">
          {preview !== undefined ? <img src={preview} alt="" /> : null}
          <span className="sdb-x-imgsrc">{selected === null ? 'IMG_SRC' : imgSrcLabel(selected)}</span>
        </div>
        <div className="sdb-x-lead-copy">
          <h1 className="sdb-x-id-lg" data-testid="detail-id">
            {selected?.id ?? ''}
          </h1>
          <p className="sdb-x-claim" data-testid="detail-claim">
            {selected === null ? '' : claimLine(selected)}
          </p>
          {status !== undefined && selected !== null ? (
            <StatusChip
              status={status}
              testId="detail-status"
              onPromote={onStatusPromote(catalog, selected.id)}
            />
          ) : (
            <span className="sdb-x-chip" data-status="raw">
              raw
            </span>
          )}
        </div>
      </header>

      <section className="sdb-x-section">
        <h2>Taxonomy</h2>
        <table className="sdb-x-table">
          <tbody>
            {TAXON_RANKS.map((rank) => (
              <tr key={rank}>
                <th>{rank}</th>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="sdb-x-section">
        <h2>Field metrics</h2>
        <div className="sdb-x-metrics">
          <div className="sdb-x-metric">
            <div className="sdb-x-kicker">Locality</div>
            <div data-testid="detail-locality">{selected === null ? 'unknown' : localityLabel(selected)}</div>
          </div>
          <div className="sdb-x-metric">
            <div className="sdb-x-kicker">Elev</div>
            <div />
          </div>
          <div className="sdb-x-metric">
            <div className="sdb-x-kicker">Temp</div>
            <div />
          </div>
        </div>
      </section>

      <section className="sdb-x-section">
        <h2>Spectral grid</h2>
        <div className="sdb-x-spectra">
          {SPECTRAL_BANDS.map((band) => (
            <div className="sdb-x-band" key={band}>
              <div className="sdb-x-kicker">{band}</div>
              <div className="sdb-x-band-well" />
            </div>
          ))}
        </div>
      </section>

      <section className="sdb-x-section">
        <h2>Observer log</h2>
        <div className="sdb-x-log" />
      </section>
    </div>
  );
}

export const DossierView = Object.assign(DossierViewRoot, {
  Intake: DossierViewIntake,
  Rail: DossierViewRail,
  Body: DossierViewBody,
});
