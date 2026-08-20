import { useFocus, useStx } from '@tmnl/stx';
import { at, type CatalogState, type CatalogSurface, type StatusFilter } from './catalog-stx.js';

const FILTERS: ReadonlyArray<{ readonly id: StatusFilter; readonly label: string }> = [
  { id: 'all', label: 'ALL RECORDS' },
  { id: 'raw', label: 'RAW' },
  { id: 'filed', label: 'FILED' },
  { id: 'working', label: 'WORKING' },
  { id: 'dead', label: 'DEAD' },
];

export function AccessionQuery({ catalog }: { readonly catalog: CatalogSurface }) {
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

export function StatusFilters({ catalog }: { readonly catalog: CatalogSurface }) {
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
          data-filter={filter.id}
          onClick={() => set({ ...value, statusFilter: filter.id })}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
