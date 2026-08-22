import { createFileRoute } from '@tanstack/react-router';
import { useFocus, useStxSet } from '@tmnl/stx';
import { getRegister } from '../server/fns';
import type { RegisterPayload } from '../store/book';
import { Slot, Well } from '../ui/marks';
import { at, selectedRow } from '../ui/stores';

export const Route = createFileRoute('/register')({
  loader: () => getRegister(),
  component: RegisterPage,
});

function RegisterPage() {
  const { parts, skus, alternates, whereUsed }: RegisterPayload =
    Route.useLoaderData();
  const selectedId = useFocus(selectedRow, at(selectedRow.lens.id));
  const { setAt, lens } = useStxSet(selectedRow);

  return (
    <div className="board">
      <p className="kicker">
        Balloon register B01–B52. Qty stays text. Class is a slot, not a buy.
        Manufacturer SKU wells are empty until a real MPN exists.
      </p>
      <table className="register" data-region="register-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Item</th>
            <th>Qty</th>
            <th>Class</th>
            <th>SKU</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((part) => {
            const sku = skus.find((row) => row.balloon_id === part.balloon_id);
            return (
              <tr
                key={part.balloon_id}
                data-selected={selectedId === part.balloon_id ? 'true' : 'false'}
                onClick={() => {
                  setAt(lens.id, part.balloon_id);
                }}
              >
                <td className="col-id">{part.balloon_id}</td>
                <td className="col-item">{part.name}</td>
                <td className="col-qty">{part.qty_text}</td>
                <td className="col-class">
                  <Slot value={part.class} />
                </td>
                <td className="col-sku">
                  <Well label="SKU" value={sku?.mpn} />
                </td>
                <td className="col-notes">{part.notes}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="kicker">Rejected alternate</p>
      <table className="register">
        <thead>
          <tr>
            <th>ID</th>
            <th>Item</th>
            <th>Status</th>
            <th>SKU</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {alternates.map((alt) => (
            <tr key={alt.id}>
              <td className="col-id">{alt.part_id}</td>
              <td className="col-item">{alt.name}</td>
              <td className="col-class">
                <Slot value={alt.status} />
              </td>
              <td className="col-sku">
                <Well label="PN" value={alt.mpn} />
              </td>
              <td className="col-notes">{alt.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="kicker">Where used. Design relationships only.</p>
      <ul className="where">
        {whereUsed.map((row) => (
          <li key={`${row.parent_id}-${row.child_id}-${row.relation}`}>
            {row.parent_id} {row.relation} {row.child_id}
          </li>
        ))}
      </ul>
    </div>
  );
}
