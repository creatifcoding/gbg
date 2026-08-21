/**
 * AppShell — full Catalog page. Lift of e90f6c74 HTML + run-06.jsx.
 * 380px rail, intake drop, thin SPECIMEN_DB chrome. Not a mashed Terminal shell.
 * Breadcrumbs stay SPECIMEN_DB / CATALOG — never OD-* as data.
 *
 * @module @tmnl/specimendb/ui
 */

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useFocus, useStx } from '@tmnl/stx';
import { statusOf } from '../schemas/specimen.js';
import type { Specimen } from '../schemas/specimen.js';
import type { SpecimenStatus } from '../schemas/components.js';
import { at, localityLabel, onStatusPromote, visibleSpecimens, type CatalogState, type CatalogSurface } from './catalog-stx.js';
import { claimLine, imgSrcLabel, mediaLabel, tagSlots } from './catalog-view.js';
import { useIntakeBind, type IntakeBind } from './intake-bind.js';
import './catalog-app.css';

type ShellContextValue = {
  readonly catalog: CatalogSurface;
  readonly bind: IntakeBind;
};

const ShellContext = createContext<ShellContextValue | null>(null);

const useShell = (): ShellContextValue => {
  const ctx = useContext(ShellContext);
  if (ctx === null) {
    throw new Error('AppShell compound components must be used within AppShell');
  }
  return ctx;
};

const SCAN_WELLS = ['SEM_SCAN_01', 'CT_SLICE_Y', 'SPECTRA_XYZ'] as const;
const METRIC_ROWS = ['Specimen Mass', 'Impact Velocity', 'Peak Force', 'C-Axis Modulus', 'Helicoidal Pitch'] as const;
const CONTEXT_ROWS = ['Depth', 'Salinity', 'Temp', 'Substrate'] as const;

const StatusChip = ({
  status,
  testId,
  inline,
  onPromote,
}: {
  readonly status: SpecimenStatus;
  readonly testId?: string;
  readonly inline?: boolean;
  readonly onPromote?: (event: { readonly stopPropagation: () => void; readonly preventDefault: () => void }) => void;
}) => (
  <span
    className="sdb-c-chip"
    data-status={status}
    data-inline={inline ? 'true' : undefined}
    data-testid={testId}
    {...(onPromote !== undefined ? { 'data-promote': 'true', onClick: onPromote } : {})}
  >
    {status}
  </span>
);

export type AppShellProps = {
  readonly catalog: CatalogSurface;
  readonly children?: ReactNode;
};

function AppShellRoot({ catalog, children }: AppShellProps) {
  const bind = useIntakeBind(catalog);

  useEffect(() => {
    void catalog.list();
  }, [catalog]);

  return (
    <ShellContext.Provider value={{ catalog, bind }}>
      <div className="sdb-catalog" data-testid="app-shell">
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
            <aside className="sdb-c-rail">
              <header className="sdb-c-rail-head">
                <div className="sdb-c-rail-brand">
                  <i className="ph ph-hexagon" />
                  <span>SPECIMEN_DB</span>
                </div>
                <span className="sdb-c-sys">SYS.09</span>
              </header>
              <AppShellIntake />
              <AppShellCards />
            </aside>
            <div className="sdb-c-outlet sdb-c-scanlines">
              <div className="sdb-c-grid-bg" />
              <AppShellHeader />
              <AppShellOutlet />
            </div>
          </>
        )}
      </div>
    </ShellContext.Provider>
  );
}

function AppShellHeader() {
  return (
    <header className="sdb-c-header">
      <nav className="sdb-c-crumb" data-testid="catalog-crumb">
        SPECIMEN_DB / CATALOG
      </nav>
      <div className="sdb-c-actions">
        <button type="button" className="sdb-c-btn">
          <i className="ph ph-sliders-horizontal" />
          Adjust Parameters
        </button>
        <button type="button" className="sdb-c-btn">
          <i className="ph ph-export" />
          Export Dataset
        </button>
      </div>
    </header>
  );
}

function AppShellIntake() {
  const { catalog, bind } = useShell();
  const intakeStatus = useFocus(
    catalog.store,
    at<CatalogState['intakeStatus']>(catalog.store.lens.intakeStatus),
  );
  const intakeError = useFocus(
    catalog.store,
    at<CatalogState['intakeError']>(catalog.store.lens.intakeError),
  );

  return (
    <section className="sdb-c-intake">
      <button
        type="button"
        className="sdb-c-zone"
        data-testid="intake-zone"
        data-active={bind.active ? 'true' : 'false'}
        data-status={intakeStatus}
        onClick={bind.open}
        onDragEnter={bind.onDragEnter}
        onDragOver={bind.onDragOver}
        onDragLeave={bind.onDragLeave}
        onDrop={bind.onDrop}
      >
        <span className="sdb-c-corner sdb-c-corner-tl" />
        <span className="sdb-c-corner sdb-c-corner-tr" />
        <span className="sdb-c-corner sdb-c-corner-bl" />
        <span className="sdb-c-corner sdb-c-corner-br" />
        <i className="ph ph-download-simple" />
        <span className="sdb-c-zone-title">
          {intakeStatus === 'dropping' ? 'Filing…' : 'Intake Drop Zone'}
        </span>
      </button>
      {intakeError !== null ? (
        <p className="sdb-c-error" data-testid="intake-error">
          {intakeError}
        </p>
      ) : null}
    </section>
  );
}

function CatalogCardChrome() {
  return (
    <article className="sdb-c-card" data-empty="true" data-testid="card-chrome">
      <div className="sdb-c-well">
        <span className="sdb-c-well-fill" />
        <span className="sdb-c-well-dot">
          <span />
        </span>
        <span className="sdb-c-chip" data-status="raw">
          raw
        </span>
      </div>
      <div className="sdb-c-card-body">
        <p className="sdb-c-claim" data-testid="claim" />
        <div className="sdb-c-tags">
          {tagSlots().map((_, index) => (
            <span className="sdb-c-tag" key={`empty-tag-${index}`} />
          ))}
        </div>
        <div className="sdb-c-meta">
          <span className="sdb-c-id" />
          <span className="sdb-c-locality" data-testid="locality">
            unknown
          </span>
        </div>
      </div>
    </article>
  );
}

function AppShellCards() {
  const { catalog } = useShell();
  const { value } = useStx(catalog.store);
  const rows = visibleSpecimens(value);

  return (
    <section className="sdb-c-list sdb-c-scroll" data-testid="rail-list">
      {rows.length === 0 ? (
        <CatalogCardChrome />
      ) : (
        rows.map((specimen) => <AppShellCard key={specimen.id} specimen={specimen} />)
      )}
    </section>
  );
}

function AppShellCard({ specimen }: { readonly specimen: Specimen }) {
  const { catalog } = useShell();
  const selectedId = useFocus(
    catalog.store,
    at<CatalogState['selectedId']>(catalog.store.lens.selectedId),
  );
  const previews = useFocus(
    catalog.store,
    at<CatalogState['previews']>(catalog.store.lens.previews),
  );
  const status = (statusOf(specimen) ?? 'raw') satisfies SpecimenStatus;
  const media = mediaLabel(specimen);
  const preview = previews[specimen.id];

  return (
    <button
      type="button"
      className="sdb-c-card"
      data-testid="specimen-card"
      data-status={status}
      data-selected={selectedId === specimen.id ? 'true' : 'false'}
      onClick={() => void catalog.select(specimen.id)}
    >
      <div className="sdb-c-well">
        <span className="sdb-c-well-fill" />
        <span className="sdb-c-well-dot">
          <span />
        </span>
        {preview !== undefined ? <img src={preview} alt="" /> : null}
        <StatusChip status={status} testId="status-pill" onPromote={onStatusPromote(catalog, specimen.id)} />
      </div>
      <div className="sdb-c-card-body">
        <p className="sdb-c-claim" data-testid="claim">
          {claimLine(specimen)}
        </p>
        <div className="sdb-c-tags">
          {tagSlots(specimen).map((tag, index) => (
            <span className="sdb-c-tag" key={`${specimen.id}:tag:${index}`}>
              {tag}
            </span>
          ))}
        </div>
        <div className="sdb-c-meta">
          <span className="sdb-c-id" data-testid="specimen-id">
            {specimen.id}
          </span>
          <span className="sdb-c-locality" data-testid="locality">
            {localityLabel(specimen)}
          </span>
        </div>
        {media !== '' ? <span className="sdb-c-media">{media}</span> : null}
      </div>
    </button>
  );
}

function AppShellOutlet() {
  const { catalog } = useShell();
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
    <div className="sdb-c-body sdb-c-scroll" data-testid="specimen-detail">
      <div className="sdb-c-lead">
        <h1 className="sdb-c-title" data-testid="detail-id">
          {selected?.id ?? ''}
        </h1>
        {status !== undefined && selected !== null ? (
          <StatusChip
            status={status}
            inline
            testId="detail-status"
            onPromote={onStatusPromote(catalog, selected.id)}
          />
        ) : null}
        <p className="sdb-c-lead-claim" data-testid="detail-claim">
          {selected === null ? '' : claimLine(selected)}
        </p>
        {selected !== null ? (
          <p className="sdb-c-locality" data-testid="detail-locality">
            {localityLabel(selected)}
          </p>
        ) : null}

        <div className="sdb-c-stage">
          <div>
            <figure className="sdb-c-photo">
              {preview !== undefined ? <img src={preview} alt="" /> : null}
              <span className="sdb-c-photo-cap">{selected === null ? 'IMG_SRC' : imgSrcLabel(selected)}</span>
            </figure>
            <div className="sdb-c-scans">
              {SCAN_WELLS.map((well) => (
                <div className="sdb-c-scan" key={well}>
                  <header className="sdb-c-scan-head">
                    <span>{well}</span>
                    <i className="ph ph-scan" />
                  </header>
                  <div className="sdb-c-scan-well" />
                </div>
              ))}
            </div>
          </div>
          <div className="sdb-c-side">
            <section className="sdb-c-wellbox">
              <h2>
                <span className="sdb-c-dot" />
                Morphological Metrics
              </h2>
              <dl className="sdb-c-dl">
                {METRIC_ROWS.map((row) => (
                  <div key={row}>
                    <dt>{row}</dt>
                    <dd />
                  </div>
                ))}
              </dl>
            </section>
            <section className="sdb-c-wellbox">
              <h2>
                <span className="sdb-c-dot" />
                Collection Context
              </h2>
              <dl className="sdb-c-dl">
                {CONTEXT_ROWS.map((row) => (
                  <div key={row}>
                    <dt>{row}</dt>
                    <dd />
                  </div>
                ))}
              </dl>
            </section>
            <section className="sdb-c-log">
              <h2>
                <span>Sys_Log // Live Compute</span>
                <span className="sdb-c-dot" />
              </h2>
              <div className="sdb-c-log-body" />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export const AppShell = Object.assign(AppShellRoot, {
  Header: AppShellHeader,
  Intake: AppShellIntake,
  Cards: AppShellCards,
  Card: AppShellCard,
});
