/**
 * AppShell — full Catalog page. Routed catalog + intake drop.
 * Hosts catalog cards. Not a mashed Terminal/Workbench shell.
 *
 * @module @tmnl/specimendb/ui
 */

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useFocus, useStx } from '@tmnl/stx';
import { statusOf } from '../schemas/specimen.js';
import type { Specimen } from '../schemas/specimen.js';
import type { SpecimenStatus } from '../schemas/components.js';
import { at, localityLabel, onStatusPromote, visibleSpecimens, type CatalogState, type CatalogSurface } from './catalog-stx.js';
import { claimLine, mediaLabel } from './catalog-view.js';
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
    className="sdb-c-chip"
    data-status={status}
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
            <AppShellHeader />
            <div className="sdb-c-body">
              <AppShellIntake />
              <AppShellCards />
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
      <div className="sdb-c-crumb" data-testid="catalog-crumb">
        SPECIMEN_DB / CATALOG
      </div>
      <h1>Catalog</h1>
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
        <span className="sdb-c-zone-title">
          {intakeStatus === 'dropping' ? 'Filing…' : 'Drop specimen media'}
        </span>
        <span className="sdb-c-zone-sub">JPEG / HEIC. GPS only if the file already has it.</span>
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
      <div className="sdb-c-card-top">
        <span className="sdb-c-chip" data-status="raw">
          raw
        </span>
        <span className="sdb-c-locality" data-testid="locality">
          unknown
        </span>
      </div>
      <p className="sdb-c-claim" data-testid="claim" />
      <span className="sdb-c-id" />
    </article>
  );
}

function AppShellCards() {
  const { catalog } = useShell();
  const { value } = useStx(catalog.store);
  const rows = visibleSpecimens(value);

  return (
    <section className="sdb-c-grid" data-testid="rail-list">
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
  const status = (statusOf(specimen) ?? 'raw') satisfies SpecimenStatus;
  const media = mediaLabel(specimen);

  return (
    <button
      type="button"
      className="sdb-c-card"
      data-testid="specimen-card"
      data-selected={selectedId === specimen.id ? 'true' : 'false'}
      onClick={() => void catalog.select(specimen.id)}
    >
      <div className="sdb-c-card-top">
        <StatusChip
          status={status}
          testId="status-pill"
          onPromote={onStatusPromote(catalog, specimen.id)}
        />
        <span className="sdb-c-locality" data-testid="locality">
          {localityLabel(specimen)}
        </span>
      </div>
      <p className="sdb-c-claim" data-testid="claim">
        {claimLine(specimen)}
      </p>
      <span className="sdb-c-id" data-testid="specimen-id">
        {specimen.id}
      </span>
      {media !== '' ? <span className="sdb-c-media">{media}</span> : null}
    </button>
  );
}

export const AppShell = Object.assign(AppShellRoot, {
  Header: AppShellHeader,
  Intake: AppShellIntake,
  Cards: AppShellCards,
  Card: AppShellCard,
});
