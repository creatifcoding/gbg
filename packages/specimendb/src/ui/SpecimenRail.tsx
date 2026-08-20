/**
 * SpecimenRail — compound list + detail. List() on mount, Get() on select.
 *
 * @module @tmnl/specimendb/ui
 */

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useFocus, useStx } from '@tmnl/stx';
import { mediaOf, statusOf } from '../schemas/specimen.js';
import type { Specimen } from '../schemas/specimen.js';
import type { SpecimenStatus } from '../schemas/components.js';
import { at, localityLabel, visibleSpecimens, type CatalogState, type CatalogSurface, type StatusFilter } from './catalog-stx.js';
import './catalog.css';

const SpecimenRailContext = createContext<CatalogSurface | null>(null);

const useRail = (): CatalogSurface => {
  const ctx = useContext(SpecimenRailContext);
  if (ctx === null) {
    throw new Error('SpecimenRail compound components must be used within SpecimenRail');
  }
  return ctx;
};

const FILTERS: ReadonlyArray<{ readonly id: StatusFilter; readonly label: string }> = [
  { id: 'all', label: 'ALL RECORDS' },
  { id: 'raw', label: 'RAW' },
  { id: 'filed', label: 'FILED' },
  { id: 'working', label: 'WORKING' },
  { id: 'dead', label: 'DEAD' },
];

export type SpecimenRailProps = {
  readonly catalog: CatalogSurface;
  readonly children?: ReactNode;
};

function SpecimenRailRoot({ catalog, children }: SpecimenRailProps) {
  return (
    <SpecimenRailContext.Provider value={catalog}>
      <section className="sdb-rail" data-testid="specimen-rail">
        {children ?? (
          <>
            <SpecimenRailHeader />
            <SpecimenRailQuery />
            <SpecimenRailFilters />
            <SpecimenRailList />
          </>
        )}
      </section>
    </SpecimenRailContext.Provider>
  );
}

function SpecimenRailHeader() {
  const catalog = useRail();
  const online = useFocus(catalog.store, at<CatalogState['online']>(catalog.store.lens.online));
  return (
    <div className="sdb-kicker">
      <span className="sdb-kicker-title">// SPECIMENDB</span>
      <span className={online ? 'sdb-online' : 'sdb-offline'} data-testid="rail-online">
        {online ? 'ONLINE' : 'OFFLINE'}
      </span>
    </div>
  );
}

function SpecimenRailQuery() {
  const catalog = useRail();
  const { value, set } = useStx(catalog.store);
  return (
    <input
      className="sdb-query"
      data-testid="rail-query"
      value={value.query}
      placeholder="Q QUERY ACCESSION ID..."
      onChange={(event) => set({ ...value, query: event.target.value })}
      spellCheck={false}
    />
  );
}

function SpecimenRailFilters() {
  const catalog = useRail();
  const statusFilter = useFocus(
    catalog.store,
    at<CatalogState['statusFilter']>(catalog.store.lens.statusFilter),
  );
  const { value, set } = useStx(catalog.store);
  return (
    <div className="sdb-filters" data-testid="rail-filters">
      {FILTERS.map((filter) => (
        <button
          key={filter.id}
          type="button"
          data-active={statusFilter === filter.id ? 'true' : 'false'}
          onClick={() => set({ ...value, statusFilter: filter.id })}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

function SpecimenRailList() {
  const catalog = useRail();
  const { value } = useStx(catalog.store);

  useEffect(() => {
    void catalog.list();
  }, [catalog]);

  const rows = visibleSpecimens(value);
  if (value.listStatus === 'loading' && rows.length === 0) {
    return (
      <div className="sdb-list sdb-empty" data-testid="rail-list">
        LIST()
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="sdb-list sdb-empty" data-testid="rail-list">
        {value.listError ?? 'NO RECORDS'}
      </div>
    );
  }

  return (
    <div className="sdb-list" data-testid="rail-list">
      {rows.map((specimen) => (
        <SpecimenRailCard key={specimen.id} specimen={specimen} />
      ))}
    </div>
  );
}

function SpecimenRailCard({ specimen }: { readonly specimen: Specimen }) {
  const catalog = useRail();
  const selectedId = useFocus(
    catalog.store,
    at<CatalogState['selectedId']>(catalog.store.lens.selectedId),
  );
  const previews = useFocus(
    catalog.store,
    at<CatalogState['previews']>(catalog.store.lens.previews),
  );
  const status = (statusOf(specimen) ?? 'raw') satisfies SpecimenStatus;
  const media = mediaOf(specimen);
  const preview = previews[specimen.id];
  const claim = specimen.components.find((c) => c._tag === 'Claim');
  const tags = specimen.components.filter((c) => c._tag === 'Tag');

  return (
    <button
      type="button"
      className="sdb-card"
      data-testid="specimen-card"
      data-selected={selectedId === specimen.id ? 'true' : 'false'}
      onClick={() => void catalog.select(specimen.id)}
    >
      <div className="sdb-card-media">
        {preview !== undefined ? <img src={preview} alt="" /> : null}
        <span className="sdb-pill" data-status={status} data-testid="status-pill">
          {status}
        </span>
      </div>
      <div className="sdb-card-body">
        <div className="sdb-card-meta">
          <span className="sdb-id" data-testid="specimen-id">
            {specimen.id}
          </span>
          <span className="sdb-locality" data-testid="locality">
            {localityLabel(specimen)}
          </span>
        </div>
        {claim?._tag === 'Claim' && claim.text.length > 0 ? <p className="sdb-claim">{claim.text}</p> : null}
        {media !== undefined ? <span className="sdb-locality">{media.filename}</span> : null}
        {tags.length > 0 ? (
          <div className="sdb-tags">
            {tags.map((tag) =>
              tag._tag === 'Tag' ? (
                <span className="sdb-tag" key={`${specimen.id}:${tag.value}`}>
                  {tag.value}
                </span>
              ) : null,
            )}
          </div>
        ) : null}
      </div>
    </button>
  );
}

function SpecimenRailDetail() {
  const catalog = useRail();
  const selected = useFocus(
    catalog.store,
    at<CatalogState['selected']>(catalog.store.lens.selected),
  );
  if (selected === null) {
    return (
      <section className="sdb-detail" data-testid="specimen-detail">
        <div className="sdb-kicker">
          <span className="sdb-kicker-title">// RECORD</span>
        </div>
        <p className="sdb-empty">NO SELECTION</p>
      </section>
    );
  }
  const status = statusOf(selected) ?? 'raw';
  const media = mediaOf(selected);
  const claim = selected.components.find((component) => component._tag === 'Claim');
  return (
    <section className="sdb-detail" data-testid="specimen-detail">
      <div className="sdb-detail-meta">
        <span className="sdb-pill" data-status={status} data-testid="detail-status">
          {status}
        </span>
        <span className="sdb-locality">CREATED {selected.createdAt}</span>
      </div>
      <h1 className="sdb-detail-id" data-testid="detail-id">
        {selected.id}
      </h1>
      <p className="sdb-locality" data-testid="detail-locality">
        {localityLabel(selected)}
      </p>
      {claim?._tag === 'Claim' && claim.text.length > 0 ? <p className="sdb-claim">{claim.text}</p> : null}
      {media !== undefined ? <p className="sdb-locality">{media.filename}</p> : null}
    </section>
  );
}

export const SpecimenRail = Object.assign(SpecimenRailRoot, {
  Header: SpecimenRailHeader,
  Query: SpecimenRailQuery,
  Filters: SpecimenRailFilters,
  List: SpecimenRailList,
  Card: SpecimenRailCard,
  Detail: SpecimenRailDetail,
});
