import { createFileRoute } from '@tanstack/react-router';
import { getReceive } from '../server/fns';
import type { ReceivePayload } from '../store/book';
import { EmptyWell, Shell } from '../ui/shell';

export const Route = createFileRoute('/receive')({
  loader: () => getReceive(),
  component: ReceivePage,
});

function ReceivePage() {
  const { receipts, lots }: ReceivePayload = Route.useLoaderData();

  return (
    <Shell current="/receive">
      <p className="lede">
        Receipt and lot. Empty until something actually arrives. Nothing has been
        received.
      </p>
      {receipts.length === 0 && lots.length === 0 ? (
        <div className="empty-board">
          <EmptyWell label="receipt" />
          <EmptyWell label="lot" />
          <p>No receipts. No lots.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Receipt</th>
              <th>PO</th>
              <th>Lot</th>
              <th>Part</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => (
              <tr key={lot.lot_id}>
                <td>{lot.receipt_id}</td>
                <td></td>
                <td>{lot.lot_id}</td>
                <td className="balloon">{lot.part_id}</td>
                <td>{lot.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  );
}
