import {
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
} from '@tanstack/react-router';
import App from './App';
import { TmnlLayout } from './components/tmnl-layout';

// Create a root route
const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
    </>
  ),
});

// Create an index route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: App,
});

// Create a route for the TmnlLayout
const tmnlRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tmnl',
  component: TmnlLayout,
});

// Create the router
const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, tmnlRoute]),
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export default router;