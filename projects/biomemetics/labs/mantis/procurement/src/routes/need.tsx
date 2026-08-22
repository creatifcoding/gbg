import { createFileRoute } from '@tanstack/react-router';
import { getNeed } from '../server/fns';
import type { NeedPayload } from '../store/book';
import { ClassStamp, EmptyWell, Shell } from '../ui/shell';

export const Route = createFileRoute('/need')({
  loader: () => getNeed(),
  component: NeedPage,
});

function NeedPage() {
  const { lines }: NeedPayload = Route.useLoaderData();

  return (
    <Shell current="/need">
      <p className="lede">
        First-tower kit versus on-hand. Demand qty is the register text. The word
        set is not an integer. On-hand stays empty until a lot exists.
      </p>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Item</th>
            <th>Demand (text)</th>
            <th>On hand</th>
            <th>Class</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.balloon_id}>
              <td className="balloon">{line.balloon_id}</td>
              <td>{line.name}</td>
              <td className="qty">{line.qty_text}</td>
              <td>
                <EmptyWell label="lot qty" value={line.on_hand} />
              </td>
              <td>
                <ClassStamp value={line.class} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  );
}
