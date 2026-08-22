import type { CSSProperties, ReactNode } from 'react';
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from '@tanstack/react-router';
import { VANTA_ANIMATION, VANTA_COLORS, VANTA_TYPOGRAPHY } from '@gbg/lab-ui';
import { getFooter } from '../server/fns';
import { Shell } from '../ui/shell';
import appCss from '../styles.css?url';

const rootStyle: CSSProperties = {
  height: '100%',
  background: VANTA_COLORS.surface.void,
  color: VANTA_COLORS.text.primary,
  fontFamily: VANTA_TYPOGRAPHY.family.sans,
  ['--font-label' as string]: '"Share Tech Mono"',
  ['--font-heading' as string]: '"Space Grotesk"',
  ['--font-body' as string]: 'Geo',
  ['--font-stats' as string]: 'Geo',
  ['--vanta-fast' as string]: VANTA_ANIMATION.duration.fast,
  ['--vanta-out' as string]: VANTA_ANIMATION.easing.out,
};

export const Route = createRootRoute({
  loader: () => getFooter(),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Mantis procurement constellation (register, no orders)' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Geo&family=Share+Tech+Mono&family=Space+Grotesk:wght@400;500;600&display=swap',
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const { poCount } = Route.useLoaderData();
  return (
    <RootDocument>
      <Shell poCount={poCount}>
        <Outlet />
      </Shell>
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" style={rootStyle}>
      <head>
        <HeadContent />
      </head>
      <body style={{ height: '100%', margin: 0, background: VANTA_COLORS.surface.void }}>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
