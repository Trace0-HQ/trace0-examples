// Imported first so every instrumentation is registered before the document
// load event finishes and before React makes its first render.
import './otel';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router';
import App from './App';
import HomePage from './HomePage';
import AboutPage from './AboutPage';

// A data router, not just <BrowserRouter>, because RouteTracker's
// useMatches() call only works within a data router.
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<App />}>
      <Route id="/" index element={<HomePage />} />
      <Route id="/about" path="/about" element={<AboutPage />} />
    </Route>,
  ),
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
