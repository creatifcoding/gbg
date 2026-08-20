/**
 * AnalogCard — Dactyl card template and full-page grid.
 * AnalogCard is not a second type. Active Queue is chrome.
 *
 * @module @tmnl/specimendb/ui
 */

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useFocus, useStx } from '@tmnl/stx';
import { statusOf } from '../schemas/specimen.js';
import type { Specimen } from '../schemas/specimen.js';
import type { SpecimenStatus } from '../schemas/components.js';
import { at, localityLabel, visibleSpecimens, type CatalogState, type CatalogSurface } from './catalog-stx.js';
import { claimLine } from './catalog-view.js';
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
}: {
  readonly status: SpecimenStatus;
  readonly testId?: string;
}) => (
  <span className="sdb-d-chip" data-status={status} data-testid={testId}>
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
              <AnalogCardIntake />
              <AnalogCardQueue />
            </aside>
            <main className="sdb-d-main">
              <header className="sdb-d-head">DACTYL // ANALOG CARD</header>
              <AnalogCardGrid />
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
    <>
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
        <span>
          {intakeStatus === 'dropping' ? 'INTAKE_IN_FLIGHT' : 'DROP_FIELD_MEDIA'}
        </span>
      </button>
      {intakeError !== null ? (
        <p className="sdb-d-error" data-testid="intake-error">
          {intakeError}
        </p>
      ) : null}
    </>
  );
}

function AnalogCardQueue() {
  return (
    <section className="sdb-d-queue" data-testid="active-queue">
      <div className="sdb-d-kicker">ACTIVE QUEUE</div>
      {QUEUE_SLOTS.map((_, index) => (
        <div className="sdb-d-queue-slot" key={`queue-${index}`} />
      ))}
    </section>
  );
}

function AnalogCardChrome() {
  return (
    <article className="sdb-d-card" data-empty="true" data-testid="card-chrome">
      <div className="sdb-d-well" />
      <div className="sdb-d-card-body">
        <span className="sdb-d-chip" data-status="raw">
          raw
        </span>
        <p className="sdb-d-claim" data-testid="claim" />
        <span className="sdb-d-locality" data-testid="locality">
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
    <div className="sdb-d-grid" data-testid="rail-list">
      {rows.length === 0 ? (
        <AnalogCardChrome />
      ) : (
        rows.map((specimen) => <AnalogCardCard key={specimen.id} specimen={specimen} />)
      )}
    </div>
  );
}

function AnalogCardCard({ specimen }: { readonly specimen: Specimen }) {
  const { catalog } = useDactyl();
  const selectedId = useFocus(
    catalog.store,
    at<CatalogState['selectedId']>(catalog.store.lens.selectedId),
  );
  const status = (statusOf(specimen) ?? 'raw') satisfies SpecimenStatus;

  return (
    <button
      type="button"
      className="sdb-d-card"
      data-testid="specimen-card"
      data-selected={selectedId === specimen.id ? 'true' : 'false'}
      onClick={() => void catalog.select(specimen.id)}
    >
      <div className="sdb-d-well" />
      <div className="sdb-d-card-body">
        <div className="sdb-d-idrow">
          <span className="sdb-d-id" data-testid="specimen-id">
            {specimen.id}
          </span>
          <StatusChip status={status} testId="status-pill" />
        </div>
        <p className="sdb-d-claim" data-testid="claim">
          {claimLine(specimen)}
        </p>
        <span className="sdb-d-locality" data-testid="locality">
          {localityLabel(specimen)}
        </span>
      </div>
    </button>
  );
}

export const AnalogCard = Object.assign(AnalogCardRoot, {
  Intake: AnalogCardIntake,
  Queue: AnalogCardQueue,
  Grid: AnalogCardGrid,
  Card: AnalogCardCard,
});
