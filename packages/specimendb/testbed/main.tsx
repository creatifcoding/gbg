import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createCatalog } from '../src/ui/catalog-stx.js';
import { IntakeDrop } from '../src/ui/IntakeDrop.js';
import { SpecimenRail } from '../src/ui/SpecimenRail.js';
import { makeMemoryClient } from './memory-client.js';

const catalog = createCatalog(makeMemoryClient());

const pageOf = (pathname: string): '/intake' | '/rail' => {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/rail' || path.endsWith('/rail')) return '/rail';
  return '/intake';
};

function App() {
  const [page, setPage] = useState(() => pageOf(window.location.pathname));

  useEffect(() => {
    const onPop = () => setPage(pageOf(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    document.title = page === '/rail' ? 'SpecimenDB Workbench' : 'SpecimenDB Terminal';
  }, [page]);

  if (page === '/rail') {
    return <SpecimenRail catalog={catalog} />;
  }

  return <IntakeDrop catalog={catalog} />;
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
