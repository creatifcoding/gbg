import { TerrariumCard } from './TerrariumCard.tsx';
import { galleryViews } from './plants.ts';

export function Gallery() {
  return (
    <main className="gallery">
      <header className="gallery-head">
        <p className="terra-kicker">A4a · service-sim · no live gateway</p>
        <h1>Simulated terrarium honesty gallery</h1>
        <p>
          Five plants from fixtures. Known, stale, simulated, faulted, and unavailable are painted
          as stamps. This is not a linked terrarium. stream=none on every card.
        </p>
      </header>
      <TerrariumCard view={galleryViews.known} />
      <TerrariumCard view={galleryViews.stale} />
      <TerrariumCard view={galleryViews.simulated} />
      <TerrariumCard view={galleryViews.faulted} />
      <TerrariumCard view={galleryViews.unavailable} />
    </main>
  );
}

export { galleryViews };
