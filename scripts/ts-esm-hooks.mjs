// Resolve hook shared by scripts/ts-esm-register.mjs. Node strips TypeScript
// types on its own; it will not resolve extensionless relative imports or the
// `@/` alias, because those are bundler conventions.
//
// Two shapes of the same hook: module.registerHooks (Node >= 22.15) runs hooks
// in-thread and requires them to be SYNCHRONOUS — an async hook returns a
// Promise, Node reads `.url` off it, finds undefined, and every import fails
// with ERR_INVALID_RETURN_PROPERTY_VALUE. module.register (older Node) runs them
// off-thread and allows async. Same candidates, same order, in both.

function candidatesFor(specifier) {
  const relative = specifier.startsWith("./") || specifier.startsWith("../");
  const alias = specifier.startsWith("@/");
  if (!relative && !alias) return null;
  const rebased = alias ? new URL(`../src/${specifier.slice(2)}`, import.meta.url).href : specifier;
  return [`${rebased}.ts`, `${rebased}.tsx`, `${rebased}/index.ts`];
}

export function resolveSync(specifier, context, nextResolve) {
  try {
    return nextResolve(specifier, context);
  } catch (error) {
    const candidates = candidatesFor(specifier);
    if (!candidates) throw error;
    for (const candidate of candidates) {
      try {
        return nextResolve(candidate, context);
      } catch {
        // try the next shape
      }
    }
    throw error;
  }
}

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const candidates = candidatesFor(specifier);
    if (!candidates) throw error;
    for (const candidate of candidates) {
      try {
        return await nextResolve(candidate, context);
      } catch {
        // try the next shape
      }
    }
    throw error;
  }
}
