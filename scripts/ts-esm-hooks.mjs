// Resolve hook shared by scripts/ts-esm-register.mjs. Node strips TypeScript
// types on its own; it will not resolve extensionless relative imports or the
// `@/` alias, because those are bundler conventions.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const relative = specifier.startsWith("./") || specifier.startsWith("../");
    const alias = specifier.startsWith("@/");

    if (!relative && !alias) {
      throw error;
    }

    const rebased = alias ? new URL(`../src/${specifier.slice(2)}`, import.meta.url).href : specifier;

    for (const candidate of [`${rebased}.ts`, `${rebased}.tsx`, `${rebased}/index.ts`]) {
      try {
        return await nextResolve(candidate, context);
      } catch {
        // try the next shape
      }
    }

    throw error;
  }
}
