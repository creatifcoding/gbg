import { createFileRoute } from '@tanstack/react-router';
import { getVendors } from '../server/fns';
import type { VendorsPayload } from '../store/book';
import { EmptyWell, Shell } from '../ui/shell';

export const Route = createFileRoute('/vendors')({
  loader: () => getVendors(),
  component: VendorsPage,
});

function VendorsPage() {
  const { suppliers }: VendorsPayload = Route.useLoaderData();

  return (
    <Shell current="/vendors">
      <p className="lede">
        Supplier parties only. A name in a BOM sentence is not a row. An empty
        list is correct.
      </p>
      {suppliers.length === 0 ? (
        <div className="empty-board">
          <EmptyWell label="supplier_party" />
          <p>No vendor rows.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  );
}
