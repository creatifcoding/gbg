import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createCatalog } from '../src/ui/catalog-stx.js';
import { AnalogCard } from '../src/ui/AnalogCard.js';
import { AppShell } from '../src/ui/AppShell.js';
import { DossierView } from '../src/ui/DossierView.js';
import { IntakeDrop } from '../src/ui/IntakeDrop.js';
import { SpecimenRail } from '../src/ui/SpecimenRail.js';
import { WorkingPanel } from '../src/ui/WorkingPanel.js';
import { makeMemoryClient } from './memory-client.js';

const catalog = createCatalog(makeMemoryClient());

type Page = '/intake' | '/rail' | '/assay' | '/dactyl' | '/catalog' | '/accession';

const pageOf = (pathname: string): Page => {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/rail' || path.endsWith('/rail')) return '/rail';
  if (path === '/assay' || path.endsWith('/assay')) return '/assay';
  if (path === '/dactyl' || path.endsWith('/dactyl')) return '/dactyl';
  if (path === '/catalog' || path.endsWith('/catalog')) return '/catalog';
  if (path === '/accession' || path.endsWith('/accession')) return '/accession';
  return '/intake';
};

const TITLE: Record<Page, string> = {
  '/intake': 'SpecimenDB Terminal',
  '/rail': 'SpecimenDB Workbench',
  '/assay': 'SpecimenDB Assay',
  '/dactyl': 'SpecimenDB Dactyl',
  '/catalog': 'SpecimenDB Catalog',
  '/accession': 'SpecimenDB Accession',
};

function App() {
  const [page, setPage] = useState(() => pageOf(window.location.pathname));

  useEffect(() => {
    const onPop = () => setPage(pageOf(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    document.title = TITLE[page];
  }, [page]);

  if (page === '/rail') return <SpecimenRail catalog={catalog} />;
  if (page === '/assay') return <WorkingPanel catalog={catalog} />;
  if (page === '/dactyl') return <AnalogCard catalog={catalog} />;
  if (page === '/catalog') return <AppShell catalog={catalog} />;
  if (page === '/accession') return <DossierView catalog={catalog} />;
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
