import {
  Grid,
  HeaderCell,
  SocketCell,
  ValueCell,
  chrome,
} from '@gbg/lab-ui';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useFocus, useStxSet } from '@tmnl/stx';
import { getBuy, tryIssuePo } from '../server/fns';
import type { BuyPayload } from '../store/book';
import { gateCopy } from '../store/gate';
import { Board, BoardKicker, gridFill } from '../ui/board';
import { ClassCell } from '../ui/cells';
import { at, buyAttempt } from '../ui/stores';

export const Route = createFileRoute('/buy')({
  loader: () => getBuy(),
  component: BuyPage,
});

type BuyRow = {
  balloon_id: string;
  class: string;
  sku: string;
  vendor: string;
  quote: string;
  gate: string;
};

function TryPoCell(params: {
  data?: BuyRow;
  context?: { attempt: (id: string) => void };
}) {
  const id = params.data?.balloon_id;
  return (
    <button
      type="button"
      className="try"
      onClick={() => {
        if (id) {
          params.context?.attempt(id);
        }
      }}
      style={{
        color: chrome.color.secondary,
        background: chrome.color.void,
        border: `1px solid ${chrome.color.border}`,
        fontFamily: chrome.font.mono,
        fontSize: chrome.type.size.micro,
        letterSpacing: chrome.type.tracking.wider,
        textTransform: 'uppercase',
        cursor: 'pointer',
        padding: `${chrome.space.pillBlockPadding} ${chrome.space.pillInlinePadding}`,
      }}
    >
      Try PO
    </button>
  );
}

const buyColumns = [
  {
    field: 'balloon_id',
    headerName: 'ID',
    headerComponent: HeaderCell,
    cellRenderer: ValueCell,
    width: 72,
  },
  {
    field: 'class',
    headerName: 'Class',
    headerComponent: HeaderCell,
    cellRenderer: ClassCell,
    width: 140,
  },
  {
    field: 'sku',
    headerName: 'SKU',
    headerComponent: HeaderCell,
    cellRenderer: SocketCell,
    width: 140,
  },
  {
    field: 'vendor',
    headerName: 'Vendor',
    headerComponent: HeaderCell,
    cellRenderer: SocketCell,
    width: 140,
  },
  {
    field: 'quote',
    headerName: 'Quote',
    headerComponent: HeaderCell,
    cellRenderer: SocketCell,
    width: 140,
  },
  {
    field: 'gate',
    headerName: 'Gate',
    headerComponent: HeaderCell,
    cellRenderer: ValueCell,
    flex: 1,
    minWidth: 160,
  },
  {
    field: 'try',
    headerName: ' ',
    headerComponent: HeaderCell,
    cellRenderer: TryPoCell,
    width: 96,
    sortable: false,
  },
];

function BuyPage() {
  const { parts, suppliers, quotes, orders, gates }: BuyPayload =
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

  const rows: BuyRow[] = parts.map((part) => {
    const gate = gates.find((row) => row.balloon_id === part.balloon_id)?.gate;
    return {
      balloon_id: part.balloon_id,
      class: part.class ?? '',
      sku: '',
      vendor: '',
      quote: '',
      gate: gate && !gate.ok ? gate.reason : '',
    };
  });

  return (
    <Board>
      <BoardKicker>
        {`SKU, vendor, quote, and purchase order. Candidate manufacturer SKUs are not a selected SKU. Particle, LCSC, and TI are discovery vendors, not a buy. Discovery quotes are UNVERIFIED printed pages, not a PO. The class gate refuses UNVERIFIED, DRAFT, NULL class, missing SKU, missing vendor, and missing quote. REF and LOCK are not a buy. No purchase order is seeded. Vendors: ${String(suppliers.length)}. Quotes: ${String(quotes.length)}. Purchase orders: ${String(orders.length)}.`}
      </BoardKicker>
      {partId !== null && copy !== null ? (
        <BoardKicker>{`${partId}: ${copy}`}</BoardKicker>
      ) : null}
      <div style={{ flex: 1, minHeight: 0, height: 0 }}>
        <Grid
          columnDefs={buyColumns}
          rowData={rows}
          context={{ attempt }}
          getRowId={(params: { data?: { balloon_id?: string } }) =>
            String(params.data?.balloon_id ?? '')
          }
          suppressCellFocus
          style={gridFill}
        />
      </div>
    </Board>
  );
}
