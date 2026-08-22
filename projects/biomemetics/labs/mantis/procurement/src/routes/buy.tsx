import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useFocus, useStxSet } from '@tmnl/stx';
import { getBuy, tryIssuePo } from '../server/fns';
import type { BuyPayload } from '../store/book';
import { gateCopy } from '../store/gate';
import { Slot, Well } from '../ui/marks';
import { at, buyAttempt } from '../ui/stores';

export const Route = createFileRoute('/buy')({
  loader: () => getBuy(),
  component: BuyPage,
});

function BuyPage() {
  const { parts, skus, suppliers, quotes, orders, gates }: BuyPayload =
    Route.useLoaderData();
  const router = useRouter();
  const partId = useFocus(buyAttempt, at(buyAttempt.lens.partId));
  const copy = useFocus(buyAttempt, at(buyAttempt.lens.copy));
  const { set } = useStxSet(buyAttempt);

  const attempt = async (id: string) => {
    const gate = await tryIssuePo({ data: { partId: id } });
    set({
      partId: id,
      copy: gate.ok ? 'gate closed.' : `${gate.reason}. ${gateCopy[gate.reason]}`,
    });
    await router.invalidate();
  };

  return (
    <div className="board">
      <p className="kicker">
        SKU, vendor, quote, and purchase order. The class gate refuses
        UNVERIFIED, DRAFT, NULL class, missing SKU, missing vendor, and missing
        quote. REF and LOCK are not a buy. No purchase order is seeded. Vendors:{' '}
        {suppliers.length}. Quotes: {quotes.length}. Purchase orders:{' '}
        {orders.length}.
      </p>
      {partId !== null && copy !== null ? (
        <p className="kicker" role="status">
          {partId}: {copy}
        </p>
      ) : null}
      <table className="register">
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
            const gate = gates.find((row) => row.balloon_id === part.balloon_id)
              ?.gate;
            return (
              <tr key={part.balloon_id}>
                <td className="col-id">{part.balloon_id}</td>
                <td className="col-class">
                  <Slot value={part.class} />
                </td>
                <td className="col-sku">
                  <Well label="SKU" value={sku?.mpn} />
                </td>
                <td>
                  <Well label="vendor" />
                </td>
                <td>
                  <Well label="quote" />
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
    </div>
  );
}
