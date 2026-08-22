import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { getBuy, tryIssuePo } from '../server/fns';
import type { BuyPayload } from '../store/book';
import { gateCopy, type GateResult } from '../store/gate';
import { ClassStamp, EmptyWell, Shell } from '../ui/shell';

export const Route = createFileRoute('/buy')({
  loader: () => getBuy(),
  component: BuyPage,
});

function BuyPage() {
  const { parts, skus, suppliers, quotes, orders, gates }: BuyPayload =
    Route.useLoaderData();
  const router = useRouter();
  const [proof, setProof] = useState<{ partId: string; gate: GateResult } | null>(
    null,
  );

  const attempt = async (partId: string) => {
    const gate = await tryIssuePo({ data: { partId } });
    setProof({ partId, gate });
    await router.invalidate();
  };

  return (
    <Shell current="/buy">
      <p className="lede">
        SKU, vendor, quote, and purchase order. The class gate refuses UNVERIFIED,
        DRAFT, NULL class, missing SKU, missing vendor, and missing quote. REF and
        LOCK are not a buy. No purchase order is seeded.
      </p>
      <p>
        Vendors: {suppliers.length}. Quotes: {quotes.length}. Purchase orders:{' '}
        {orders.length}.
      </p>
      {proof ? (
        <p className="refuse" role="status">
          {proof.partId}:{' '}
          {proof.gate.ok
            ? 'issued'
            : `${proof.gate.reason}. ${gateCopy[proof.gate.reason]}`}
        </p>
      ) : null}
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Class</th>
            <th>SKU</th>
            <th>Vendor</th>
            <th>Quote</th>
            <th>Gate</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {parts.map((part) => {
            const sku = skus.find((row) => row.balloon_id === part.balloon_id);
            const gate = gates.find((row) => row.balloon_id === part.balloon_id)?.gate;
            return (
              <tr key={part.balloon_id}>
                <td className="balloon">{part.balloon_id}</td>
                <td>
                  <ClassStamp value={part.class} />
                </td>
                <td>
                  <EmptyWell label="SKU" value={sku?.mpn} />
                </td>
                <td>
                  <EmptyWell label="vendor" />
                </td>
                <td>
                  <EmptyWell label="quote" />
                </td>
                <td className="refuse">
                  {gate && !gate.ok ? gate.reason : null}
                </td>
                <td>
                  <button
                    type="button"
                    className="try"
                    onClick={() => {
                      void attempt(part.balloon_id);
                    }}
                  >
                    Try PO
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Shell>
  );
}
