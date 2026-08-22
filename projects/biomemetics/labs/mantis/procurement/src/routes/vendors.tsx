import { createFileRoute } from '@tanstack/react-router';
import { getVendors } from '../server/fns';
import type { VendorsPayload } from '../store/book';
import { Well } from '../ui/marks';

export const Route = createFileRoute('/vendors')({
  loader: () => getVendors(),
  component: VendorsPage,
});

function VendorsPage() {
  const { suppliers }: VendorsPayload = Route.useLoaderData();

  return (
    <div className="board">
      <p className="kicker">
        Supplier parties only. A name in a BOM sentence is not a row. An empty
        list is correct.
      </p>
      {suppliers.length === 0 ? (
        <div className="empty-board">
          <Well label="supplier_party" />
          <p>No vendor rows.</p>
        </div>
      ) : (
        <table className="register">
          <thead>
            <tr>
              <th>ID</th>
              <th>Item</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((row) => (
              <tr key={row.id}>
                <td className="col-id">{row.id}</td>
                <td className="col-item">{row.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
