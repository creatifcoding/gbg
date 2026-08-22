import { createFileRoute } from '@tanstack/react-router';
import { useFocus } from '@tmnl/stx';
import { getReceive } from '../server/fns';
import type { ReceivePayload } from '../store/book';
import { Well } from '../ui/marks';
import { at, receiveDraft } from '../ui/stores';

export const Route = createFileRoute('/receive')({
  loader: () => getReceive(),
  component: ReceivePage,
});

function ReceivePage() {
  const { receipts, lots }: ReceivePayload = Route.useLoaderData();
  const draftPart = useFocus(receiveDraft, at(receiveDraft.lens.partId));
  const draftQty = useFocus(receiveDraft, at(receiveDraft.lens.qty));

  return (
    <div className="board">
      <p className="kicker">
        Receipt and lot. Empty until something actually arrives. Nothing has been
        received.
      </p>
      <div className="draft">
        <span className="kicker">Receive draft</span>
        <Well label="part" value={draftPart} />
        <Well label="qty" value={draftQty} />
      </div>
      {receipts.length === 0 && lots.length === 0 ? (
        <div className="empty-board">
          <Well label="receipt" />
          <Well label="lot" />
          <p>No receipts. No lots.</p>
        </div>
      ) : (
        <table className="register">
          <thead>
            <tr>
              <th>Receipt</th>
              <th>PO</th>
              <th>Lot</th>
              <th>ID</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => (
              <tr key={lot.lot_id}>
                <td>{lot.receipt_id}</td>
                <td>
                  <Well label="PO" />
                </td>
                <td>{lot.lot_id}</td>
                <td className="col-id">{lot.part_id}</td>
                <td className="col-qty">{lot.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
