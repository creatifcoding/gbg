/**
 * AnalogCard — Dactyl card template and full-page grid.
 * Lift of 94e9fc0d HTML: w-80 intake, Active Queue chrome, analog card grid,
 * SYSTEM.CORE footer + list count. AnalogCard is not a second type.
 *
 * @module @tmnl/specimendb/ui
 */

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useFocus, useStx } from '@tmnl/stx';
import { statusOf } from '../schemas/specimen.js';
import type { Specimen } from '../schemas/specimen.js';
import type { SpecimenStatus } from '../schemas/components.js';
import { at, localityLabel, onStatusPromote, visibleSpecimens, type CatalogState, type CatalogSurface } from './catalog-stx.js';
import { claimLine, tagSlots } from './catalog-view.js';
import { useIntakeBind, type IntakeBind } from './intake-bind.js';
import './dactyl.css';

type DactylContextValue = {
  readonly catalog: CatalogSurface;
  readonly bind: IntakeBind;
};

const DactylContext = createContext<DactylContextValue | null>(null);

const useDactyl = (): DactylContextValue => {
  const ctx = useContext(DactylContext);
  if (ctx === null) {
    throw new Error('AnalogCard compound components must be used within AnalogCard');
  }
  return ctx;
};

const QUEUE_SLOTS = ['', '', ''] as const;

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
    className="sdb-d-chip"
    data-status={status}
    data-testid={testId}
    {...(onPromote !== undefined ? { 'data-promote': 'true', onClick: onPromote } : {})}
  >
    {status}
  </span>
);

export type AnalogCardPageProps = {
  readonly catalog: CatalogSurface;
  readonly children?: ReactNode;
};

function AnalogCardRoot({ catalog, children }: AnalogCardPageProps) {
  const bind = useIntakeBind(catalog);

  useEffect(() => {
    void catalog.list();
  }, [catalog]);

  return (
    <DactylContext.Provider value={{ catalog, bind }}>
      <div className="sdb-dactyl" data-testid="dactyl-grid">
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
            <aside className="sdb-d-intake">
              <header className="sdb-d-brand">
                <div className="sdb-d-brand-row">
                  <i className="ph-fill ph-hexagon" />
                  <h1>
                    SPECIMEN<span>_DB</span>
                  </h1>
                  <span className="sdb-d-cursor" />
                </div>
                <span className="sdb-d-ver">v2.1.4</span>
              </header>
              <AnalogCardIntake />
              <AnalogCardQueue />
              <div className="sdb-d-sync">
                <span>
                  <i className="ph ph-hard-drives" /> DB_SYNC
                </span>
                <span className="sdb-d-sync-ok">OK</span>
              </div>
            </aside>
            <main className="sdb-d-main">
              <AnalogCardHead />
              <AnalogCardGrid />
              <AnalogCardFoot />
            </main>
          </>
        )}
      </div>
    </DactylContext.Provider>
  );
}

function AnalogCardIntake() {
  const { catalog, bind } = useDactyl();
  const intakeStatus = useFocus(
    catalog.store,
    at<CatalogState['intakeStatus']>(catalog.store.lens.intakeStatus),
  );
  const intakeError = useFocus(
    catalog.store,
    at<CatalogState['intakeError']>(catalog.store.lens.intakeError),
  );

  return (
    <div className="sdb-d-zone-wrap">
      <button
        type="button"
        className="sdb-d-zone"
        data-testid="intake-zone"
        data-active={bind.active ? 'true' : 'false'}
        data-status={intakeStatus}
        onClick={bind.open}
        onDragEnter={bind.onDragEnter}
        onDragOver={bind.onDragOver}
        onDragLeave={bind.onDragLeave}
        onDrop={bind.onDrop}
      >
        <span className="sdb-d-corner sdb-d-corner-tl" />
        <span className="sdb-d-corner sdb-d-corner-tr" />
        <span className="sdb-d-corner sdb-d-corner-bl" />
        <span className="sdb-d-corner sdb-d-corner-br" />
        <i className="ph ph-scan" />
        <span className="sdb-d-zone-title">
          {intakeStatus === 'dropping' ? 'INTAKE_IN_FLIGHT' : 'INITIATE INTAKE'}
        </span>
        <span className="sdb-d-zone-sub">DROP RAW DATA OR DRAG FILES</span>
      </button>
      {intakeError !== null ? (
        <p className="sdb-d-error" data-testid="intake-error">
          {intakeError}
        </p>
      ) : null}
    </div>
  );
}

function AnalogCardQueue() {
  return (
    <section className="sdb-d-queue" data-testid="active-queue">
      <div className="sdb-d-queue-head">
        <span>Active Queue</span>
        <span />
      </div>
      {QUEUE_SLOTS.map((_, index) => (
        <div className="sdb-d-queue-slot" key={`queue-${index}`} />
      ))}
    </section>
  );
}

function AnalogCardHead() {
  const { catalog } = useDactyl();
  const { value, set } = useStx(catalog.store);
  return (
    <header className="sdb-d-head">
      <div className="sdb-d-head-left">
        <span>
          <i className="ph ph-funnel-simple" /> Filter Parameters
        </span>
        <span className="sdb-d-head-div" />
        <span className="sdb-d-viewing">
          VIEWING: <span>GLOBAL_CATALOG</span>
        </span>
      </div>
      <div className="sdb-d-query-wrap">
        <i className="ph ph-magnifying-glass" />
        <input
          className="sdb-d-query"
          data-testid="rail-query"
          value={value.query}
          placeholder="QUERY DATABASE..."
          onChange={(event) => set({ ...value, query: event.target.value })}
          spellCheck={false}
        />
      </div>
    </header>
  );
}

function AnalogCardChrome() {
  return (
    <article className="sdb-d-card" data-empty="true" data-testid="card-chrome">
      <div className="sdb-d-well">
        <i className="ph-light ph-bug" />
        <span className="sdb-d-chip" data-status="raw">
          raw
        </span>
        <span className="sdb-d-id" />
      </div>
      <div className="sdb-d-card-body">
        <p className="sdb-d-claim" data-testid="claim" />
        <div className="sdb-d-tags">
          {tagSlots().map((_, index) => (
            <span className="sdb-d-tag" key={`empty-tag-${index}`} />
          ))}
        </div>
        <span className="sdb-d-locality" data-testid="locality">
          <i className="ph ph-crosshair" />
          unknown
        </span>
      </div>
    </article>
  );
}

function AnalogCardGrid() {
  const { catalog } = useDactyl();
  const { value } = useStx(catalog.store);
  const rows = visibleSpecimens(value);

  return (
    <div className="sdb-d-grid-wrap">
      <div className="sdb-d-grid" data-testid="rail-list">
        {rows.length === 0 ? (
          <AnalogCardChrome />
        ) : (
          rows.map((specimen) => <AnalogCardCard key={specimen.id} specimen={specimen} />)
        )}
      </div>
    </div>
  );
}

function AnalogCardCard({ specimen }: { readonly specimen: Specimen }) {
  const { catalog } = useDactyl();
  const selectedId = useFocus(
    catalog.store,
    at<CatalogState['selectedId']>(catalog.store.lens.selectedId),
  );
  const previews = useFocus(
    catalog.store,
    at<CatalogState['previews']>(catalog.store.lens.previews),
  );
  const status = (statusOf(specimen) ?? 'raw') satisfies SpecimenStatus;
  const preview = previews[specimen.id];

  return (
    <button
      type="button"
      className="sdb-d-card"
      data-testid="specimen-card"
      data-selected={selectedId === specimen.id ? 'true' : 'false'}
      onClick={() => void catalog.select(specimen.id)}
    >
      <div className="sdb-d-well">
        <i className="ph-light ph-bug" />
        {preview !== undefined ? <img src={preview} alt="" /> : null}
        <StatusChip status={status} testId="status-pill" onPromote={onStatusPromote(catalog, specimen.id)} />
        <span className="sdb-d-id" data-testid="specimen-id">
          {specimen.id}
        </span>
      </div>
      <div className="sdb-d-card-body">
        <p className="sdb-d-claim" data-testid="claim">
          {claimLine(specimen)}
        </p>
        <div className="sdb-d-tags">
          {tagSlots(specimen).map((tag, index) => (
            <span className="sdb-d-tag" key={`${specimen.id}:tag:${index}`}>
              {tag}
            </span>
          ))}
        </div>
        <span className="sdb-d-locality" data-testid="locality">
          <i className="ph ph-crosshair" />
          {localityLabel(specimen)}
        </span>
      </div>
    </button>
  );
}

function AnalogCardFoot() {
  const { catalog } = useDactyl();
  const { value } = useStx(catalog.store);
  const count = visibleSpecimens(value).length;
  const online = useFocus(catalog.store, at<CatalogState['online']>(catalog.store.lens.online));
  return (
    <footer className="sdb-d-foot">
      <div className="sdb-d-foot-left">
        <span>SYSTEM.CORE // {online ? 'ONLINE' : 'OFFLINE'}</span>
        <span>LOAD</span>
      </div>
      <span className="sdb-d-foot-count">{count} SPECIMENS LOADED INTO VIEW</span>
    </footer>
  );
}

export const AnalogCard = Object.assign(AnalogCardRoot, {
  Intake: AnalogCardIntake,
  Queue: AnalogCardQueue,
  Grid: AnalogCardGrid,
  Card: AnalogCardCard,
});
