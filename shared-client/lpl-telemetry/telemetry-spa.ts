// Page-view tracking for the SPA apps (Vite: toner, laser; CRA: kindred,
// aligned-souls, church-connect). These have no framework router hook we can
// rely on across versions, so we patch the History API instead — the one thing
// every client-side router in this ecosystem ultimately calls.
//
// Call once at app entry, e.g. in src/main.tsx or src/index.tsx:
//
//   import { startTelemetry } from './lib/telemetry-spa';
//   startTelemetry('toner');

import { initTelemetry, trackPageView } from './telemetry';

let started = false;

export function startTelemetry(app: string, options: { debug?: boolean } = {}): void {
  if (typeof window === 'undefined' || started) return;
  started = true;

  initTelemetry({ app, debug: options.debug });

  let lastPath = window.location.pathname + window.location.search;
  const report = () => {
    const current = window.location.pathname + window.location.search;
    if (current === lastPath) return;
    lastPath = current;
    trackPageView();
  };

  // pushState/replaceState do not emit an event, so wrap them. Both wrappers
  // defer via queueMicrotask so location is already updated when we read it.
  const { pushState, replaceState } = window.history;

  window.history.pushState = function (...args: Parameters<typeof pushState>) {
    const result = pushState.apply(this, args);
    queueMicrotask(report);
    return result;
  };

  window.history.replaceState = function (...args: Parameters<typeof replaceState>) {
    const result = replaceState.apply(this, args);
    queueMicrotask(report);
    return result;
  };

  window.addEventListener('popstate', report);

  // The landing page view, which happens before any navigation.
  trackPageView();
}

export { track, identify, funnel, flushTelemetry } from './telemetry';
