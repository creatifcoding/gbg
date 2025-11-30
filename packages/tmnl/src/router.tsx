import {
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
} from '@tanstack/react-router';
import App from './App';
import { TmnlLayout } from './components/tmnl-layout';
import { AnimationTestbed } from './components/testbed/AnimationTestbed';

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

// Create testbed route for animation development
const testbedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/testbed',
  component: AnimationTestbed,
});

// Create the router
const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, tmnlRoute, testbedRoute]),
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export default router;