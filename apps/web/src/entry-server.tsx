import { renderToString } from 'react-dom/server';

import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import createEmotionServer from '@emotion/server/create-instance';
import { Box, CssBaseline, ThemeProvider } from '@mui/material';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';

import { CTASection } from './components/landing/CTASection';
import { FAQSection } from './components/landing/faq';
import { FeaturesScrollSection } from './components/landing/features-scroll';
import { Footer } from './components/landing/Footer';
import { HeroSection } from './components/landing/hero';
import { LandingNav } from './components/landing/LandingNav';
import { PricingSection } from './components/landing/PricingSection';
import { DrawerContext } from './context/DrawerContext';
import { ThemeContext } from './context/ThemeContext';
import { createAppTheme } from './theme';

const noopDrawer = { pushDrawer: () => {}, popDrawer: () => {} };
const noopTheme = { mode: 'light' as const, preference: 'light' as const, setPreference: () => {} };

function LandingSSR() {
  return (
    <Box sx={{ position: 'relative', zIndex: 1 }}>
      <LandingNav />
      <HeroSection />
      <FeaturesScrollSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </Box>
  );
}

// Minimal route tree for SSR: only the paths that Link components reference
const rootRoute = createRootRoute({ component: () => <Outlet /> });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingSSR,
});
const stubRoutes = [
  createRoute({ getParentRoute: () => rootRoute, path: '/auth/login' }),
  createRoute({ getParentRoute: () => rootRoute, path: '/auth/signup' }),
  createRoute({ getParentRoute: () => rootRoute, path: '/dashboard' }),
  createRoute({ getParentRoute: () => rootRoute, path: '/dashboard/api/docs' }),
  createRoute({ getParentRoute: () => rootRoute, path: '/dashboard/api/mcp' }),
  createRoute({ getParentRoute: () => rootRoute, path: '/docs' }),
  createRoute({ getParentRoute: () => rootRoute, path: '/privacy' }),
  createRoute({ getParentRoute: () => rootRoute, path: '/terms' }),
];
const routeTree = rootRoute.addChildren([indexRoute, ...stubRoutes]);

export async function render() {
  const cache = createCache({ key: 'css' });
  const { extractCriticalToChunks, constructStyleTagsFromChunks } = createEmotionServer(cache);
  const theme = createAppTheme('light');

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });

  await router.load();

  const html = renderToString(
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ThemeContext.Provider value={noopTheme}>
          <DrawerContext.Provider value={noopDrawer}>
            <RouterProvider router={router} />
          </DrawerContext.Provider>
        </ThemeContext.Provider>
      </ThemeProvider>
    </CacheProvider>
  );

  const chunks = extractCriticalToChunks(html);
  const css = constructStyleTagsFromChunks(chunks);
  return { html, css };
}
