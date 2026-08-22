import { createFileRoute } from '@tanstack/react-router';
import { getNeed } from '../server/fns';
import type { NeedPayload } from '../store/book';
import { Slot, Well } from '../ui/marks';

export const Route = createFileRoute('/need')({
  loader: () => getNeed(),
  component: NeedPage,
});

function NeedPage() {
  const { lines }: NeedPayload = Route.useLoaderData();

  return (
    <div className="board">
      <p className="kicker">
        First-tower kit versus on-hand. Demand qty is the register text. The word
        set is not an integer. On-hand stays empty until a lot exists.
      </p>
      <table className="register">
        <thead>
          <tr>
            <th>ID</th>
            <th>Item</th>
            <th>Qty</th>
            <th>On hand</th>
            <th>Class</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.balloon_id}>
              <td className="col-id">{line.balloon_id}</td>
              <td className="col-item">{line.name}</td>
              <td className="col-qty">{line.qty_text}</td>
              <td>
                <Well label="lot qty" value={line.on_hand} />
              </td>
              <td className="col-class">
                <Slot value={line.class} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
