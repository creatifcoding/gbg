import { Mono, Socket, Table } from '@gbg/lab-ui';
import { createFileRoute } from '@tanstack/react-router';
import { getVendors } from '../server/fns';
import type { VendorsPayload } from '../store/book';
import { Board, BoardKicker, Inspector } from '../ui/board';

export const Route = createFileRoute('/vendors')({
  loader: () => getVendors(),
  component: VendorsPage,
});

const vendorColumns = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Item' },
];

function VendorsPage() {
  const { suppliers }: VendorsPayload = Route.useLoaderData();

  return (
    <Board>
      <BoardKicker>
        Supplier parties. Particle, LCSC, and TI are discovery rows from CAD/EE
        search hits, not a buy. No purchase order.
      </BoardKicker>
      {suppliers.length === 0 ? (
        <Inspector>
          <Socket aria-label="supplier_party" />
          <Mono>No vendor rows.</Mono>
        </Inspector>
      ) : (
        <Table
          columns={vendorColumns}
          data={suppliers.map((row) => ({ id: row.id, name: row.name }))}
        />
      )}
    </Board>
  );
}
