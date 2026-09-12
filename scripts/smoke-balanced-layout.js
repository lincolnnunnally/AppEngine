import fs from "node:fs";
import path from "node:path";
import { noOrphan, splitTitleLines } from "../src/lib/ui/no-orphan.ts";

const repoRoot = process.cwd();

runStep("noOrphan keeps the last two words together", () => {
  assertEqual(noOrphan("Snap together a working app"), "Snap together a working\u00a0app", "five words");
  assertEqual(noOrphan("working app"), "working\u00a0app", "two words");
  assertEqual(noOrphan("App"), "App", "one word");
});

runStep("splitTitleLines never leaves a leftover last word", () => {
  const lines = splitTitleLines("Snap together a working app");
  assertEqual(lines.length, 2, "long title becomes two lines");
  if (lines[1].split(/\s+/).length < 2) {
    throw new Error(`second line is a leftover: ${JSON.stringify(lines)}`);
  }
  const short = splitTitleLines("Open app");
  assertEqual(short.length, 1, "short title stays one line");
});

runStep("factory landing copy is designed as two even lines", () => {
  const text = read("src/components/intake/factory-welcome.tsx");
  const blocks = [...text.matchAll(/<h[12] className="balanced-title">([\s\S]*?)<\/h[12]>/g)];
  if (blocks.length < 3) {
    throw new Error(`expected several balanced titles, found ${blocks.length}`);
  }
  for (const block of blocks) {
    const lines = [...block[1].matchAll(/<span>([^<]+)<\/span>/g)].map((item) => item[1]);
    if (lines.length !== 2) {
      throw new Error(`title must be two phrases: ${block[1]}`);
    }
    for (const line of lines) {
      if (line.trim().split(/\s+/).length < 2) {
        throw new Error(`lonely title line: "${line}"`);
      }
      if (line.length > 24) {
        throw new Error(`title line too long for a phone: "${line}"`);
      }
    }
    const ratio = Math.max(lines[0].length, lines[1].length) / Math.max(1, Math.min(lines[0].length, lines[1].length));
    if (ratio > 2.2) {
      throw new Error(`title lines are uneven (${lines.join(" / ")})`);
    }
  }
});

runStep("consumer titles are two designed spans, not one wrapping sentence", () => {
  assertFileIncludes("src/components/intake/factory-welcome.tsx", [
    "balanced-title",
    "<span>Describe it.</span>",
    "noOrphan"
  ]);
  assertFileIncludes("src/components/intake/conversational-intake.tsx", [
    "<span>What should this app</span>",
    "<span>help someone do?</span>"
  ]);
  assertFileIncludes("src/components/intake/compose-and-build.tsx", [
    "<span>Here&apos;s the pack</span>",
    "<span>we&apos;ll snap together</span>"
  ]);
});

runStep("card rows do not use auto-fill 1fr on factory or theme grids", () => {
  const css = read("src/app/styles.css");
  const factoryBlock = css.slice(css.indexOf(".compose-arch-grid"), css.indexOf(".compose-arch {"));
  if (factoryBlock.includes("auto-fill") || factoryBlock.includes("1fr")) {
    throw new Error("compose-arch-grid still stretches leftover cards");
  }
  assertIncludes(factoryBlock, "display: flex", "compose-arch-grid is flex");
  const themeBlock = css.slice(css.indexOf(".theme-grid"), css.indexOf(".theme-card {"));
  if (themeBlock.includes("auto-fill")) {
    throw new Error("theme-grid still uses auto-fill");
  }
  assertIncludes(css, "text-wrap: pretty", "body uses pretty wrap");
  assertIncludes(css, "text-wrap: balance", "headings use balance");
});

runStep("generated apps inherit the same wrap and card rules", () => {
  const css = read("src/lib/engine/themes.ts");
  assertIncludes(css, "text-wrap: pretty", "generated body pretty wrap");
  assertIncludes(css, "text-wrap: balance", "generated headings balance");
  assertIncludes(css, "max-width: 22rem", "generated cards have a max width");
  if (css.includes("auto-fill")) {
    throw new Error("generated CSS still uses auto-fill 1fr");
  }
  assertFileIncludes("src/lib/engine/app-generator.ts", ["balancedHeadingHtml", "balanced-title"]);
});

console.log("balanced-layout smoke ok");

function read(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

function assertFileIncludes(filePath, expected) {
  const text = read(filePath);
  for (const phrase of expected) {
    assertIncludes(text, phrase, filePath);
  }
}

function assertIncludes(value, phrase, label) {
  if (!String(value).includes(phrase)) {
    throw new Error(`${label}: expected to contain "${phrase}"`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function runStep(label, fn) {
  try {
    fn();
    console.log(`ok - ${label}`);
  } catch (error) {
    console.error(`not ok - ${label}`);
    throw error;
  }
}
