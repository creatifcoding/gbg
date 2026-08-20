import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createCatalog } from '../src/ui/catalog-stx.js';
import { IntakeDrop } from '../src/ui/IntakeDrop.js';
import { SpecimenRail } from '../src/ui/SpecimenRail.js';
import { makeMemoryClient } from './memory-client.js';

const catalog = createCatalog(makeMemoryClient());

function App() {
  return (
    <div className="sdb-shell">
      <SpecimenRail catalog={catalog}>
        <SpecimenRail.Header />
        <SpecimenRail.Query />
        <SpecimenRail.Filters />
        <SpecimenRail.List />
      </SpecimenRail>
      <div className="sdb-stage">
        <IntakeDrop catalog={catalog}>
          <IntakeDrop.Header />
          <IntakeDrop.Zone />
          <IntakeDrop.Hint />
        </IntakeDrop>
        <SpecimenRail catalog={catalog}>
          <SpecimenRail.Detail />
        </SpecimenRail>
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (root === null) {
  throw new Error('#root missing');
}
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
