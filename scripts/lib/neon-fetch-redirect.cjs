// Preload (node --require / NODE_OPTIONS) for tests: sends @neondatabase/serverless
// HTTP queries for hosts under .neonlocal.test to the local stand-in started by
// local-neon-http.mjs (port in LOCAL_NEON_PORT). Everything else is untouched.
const port = process.env.LOCAL_NEON_PORT;
if (port && typeof globalThis.fetch === "function") {
  const original = globalThis.fetch;
  globalThis.fetch = function redirectedFetch(input, init) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url;
    if (url && /^https:\/\/[^/]*\.neonlocal\.test\/sql$/.test(url)) {
      return original(`http://127.0.0.1:${port}/sql`, init);
    }
    return original(input, init);
  };
}
