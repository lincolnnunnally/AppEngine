// Lets a plain `node` script import the app's TypeScript modules directly.
//
// Node strips the types on its own; what it won't do is resolve the app's
// extensionless relative imports (`./db`) or its `@/` alias, because those are
// bundler conventions, not ESM ones. This adds a resolve hook that retries them.
//
// Why bother: the smoke tests then exercise the REAL modules the app ships,
// rather than a copy of the logic that can quietly drift away from them.
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      const relative = specifier.startsWith("./") || specifier.startsWith("../");
      const alias = specifier.startsWith("@/");

      if (!relative && !alias) {
        throw error;
      }

      const rebased = alias ? new URL(`../src/${specifier.slice(2)}`, import.meta.url).href : specifier;

      for (const candidate of [`${rebased}.ts`, `${rebased}.tsx`, `${rebased}/index.ts`]) {
        try {
          return nextResolve(candidate, context);
        } catch {
          // try the next shape
        }
      }

      throw error;
    }
  }
});
