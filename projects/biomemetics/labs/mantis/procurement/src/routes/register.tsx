import { createFileRoute } from '@tanstack/react-router';
import { getRegister } from '../server/fns';
import type { RegisterPayload } from '../store/book';
import { ClassStamp, EmptyWell, Shell } from '../ui/shell';

export const Route = createFileRoute('/register')({
  loader: () => getRegister(),
  component: RegisterPage,
});

function RegisterPage() {
  const { parts, skus, alternates, whereUsed }: RegisterPayload =
    Route.useLoaderData();

  return (
    <Shell current="/register">
      <p className="lede">
        Balloon register B01–B52. Qty stays text. Class is a stamp, not a buy.
        Manufacturer SKU wells are empty until a real MPN exists.
      </p>
      <table>
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
              <tr key={part.balloon_id}>
                <td className="balloon">{part.balloon_id}</td>
                <td>{part.name}</td>
                <td className="qty">{part.qty_text}</td>
                <td>
                  <ClassStamp value={part.class} />
                </td>
                <td>
                  <EmptyWell label="MPN" value={sku?.mpn} />
                </td>
                <td>{part.notes}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h2>Rejected alternate</h2>
      <table>
        <thead>
          <tr>
            <th>Part</th>
            <th>Name</th>
            <th>Status</th>
            <th>PN</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {alternates.map((alt) => (
            <tr key={alt.id}>
              <td className="balloon">{alt.part_id}</td>
              <td>{alt.name}</td>
              <td>{alt.status}</td>
              <td>
                <EmptyWell label="PN" value={alt.mpn} />
              </td>
              <td>{alt.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Where used</h2>
      <p>Design relationships only. B35 mounts B42. B36 sits on the camera binder.</p>
      <ul>
        {whereUsed.map((row) => (
          <li key={`${row.parent_id}-${row.child_id}-${row.relation}`}>
            {row.parent_id} {row.relation} {row.child_id}
          </li>
        ))}
      </ul>
    </Shell>
  );
}
