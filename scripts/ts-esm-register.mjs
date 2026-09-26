// Lets a plain `node` script import the app's TypeScript modules directly.
//
// Node strips the types on its own; what it won't do is resolve the app's
// extensionless relative imports (`./db`) or its `@/` alias, because those are
// bundler conventions, not ESM ones. This adds a resolve hook that retries them.
//
// Why bother: the smoke tests then exercise the REAL modules the app ships,
// rather than a copy of the logic that can quietly drift away from them.
//
// registerHooks landed in Node 22.15. Node 22.14 (and earlier 22) only has
// module.register, so we use whichever this process exports.
import * as nodeModule from "node:module";
import { resolve } from "./ts-esm-hooks.mjs";

if (typeof nodeModule.registerHooks === "function") {
  nodeModule.registerHooks({ resolve });
} else {
  nodeModule.register(new URL("./ts-esm-hooks.mjs", import.meta.url));
}
