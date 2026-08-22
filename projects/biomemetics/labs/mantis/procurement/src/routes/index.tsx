import { createFileRoute, Link } from '@tanstack/react-router';
import { Shell } from '../ui/shell';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return (
    <Shell current="/">
      <p className="lede">
        Five tools, one PGlite book. Balloon lines B01–B52 are design identities.
        Empty SKU, vendor, quote, price, and lead-time wells stay empty. This page
        does not record an order.
      </p>
      <p>
        Start at the <Link to="/register">register</Link>.
      </p>
    </Shell>
  );
}
