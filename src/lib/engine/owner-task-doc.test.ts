import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { docReadingTime, parseDocBlocks, parseDocInline } from "./owner-task-doc.ts";

describe("reading material on a to-do card", () => {
  it("reads headings, paragraphs and lists", () => {
    const blocks = parseDocBlocks("# Online giving\n\nGifts reach us\nby export.\n\n- Keep Tithe.ly\n- Or use Stripe\n\n1. Now\n2. Next");
    assert.deepEqual(blocks, [
      { kind: "heading", level: 1, text: "Online giving" },
      { kind: "para", text: "Gifts reach us by export." },
      { kind: "list", ordered: false, items: ["Keep Tithe.ly", "Or use Stripe"] },
      { kind: "list", ordered: true, items: ["Now", "Next"] }
    ]);
  });

  it("keeps a wrapped list line with its item", () => {
    const blocks = parseDocBlocks("- **Takes no gifts itself.** The Give button sends the giver\n  to the church's own page.\n- Second");
    assert.deepEqual(blocks, [
      { kind: "list", ordered: false, items: ["**Takes no gifts itself.** The Give button sends the giver to the church's own page.", "Second"] }
    ]);
  });

  it("reads a table, and a code block as written", () => {
    const blocks = parseDocBlocks("| What | Price |\n|---|---|\n| Moz Local | $20-40/mo |\n| Yext | $199/yr |\n\n```sql\ncheck (a <> 'b')\n```");
    assert.deepEqual(blocks, [
      { kind: "table", header: ["What", "Price"], rows: [["Moz Local", "$20-40/mo"], ["Yext", "$199/yr"]] },
      { kind: "code", text: "check (a <> 'b')" }
    ]);
  });

  it("flattens deep headings and drops rules", () => {
    assert.deepEqual(parseDocBlocks("#### Deep\n\n---\n\nAfter"), [
      { kind: "heading", level: 3, text: "Deep" },
      { kind: "para", text: "After" }
    ]);
  });

  it("never turns the document's own HTML into markup", () => {
    assert.deepEqual(parseDocBlocks("<script>alert(1)</script>"), [{ kind: "para", text: "<script>alert(1)</script>" }]);
    assert.deepEqual(parseDocInline("<b>hi</b>"), [{ kind: "text", text: "<b>hi</b>" }]);
  });

  it("reads bold, code and links he can open", () => {
    assert.deepEqual(parseDocInline("Ask **Tithe.ly** via `POST /transaction` ([docs](https://tithe.ly/api))."), [
      { kind: "text", text: "Ask " },
      { kind: "bold", text: "Tithe.ly" },
      { kind: "text", text: " via " },
      { kind: "code", text: "POST /transaction" },
      { kind: "text", text: " (" },
      { kind: "link", text: "docs", href: "https://tithe.ly/api" },
      { kind: "text", text: ")." }
    ]);
  });

  it("leaves underscores in names alone", () => {
    assert.deepEqual(parseDocInline("snip_clip_earnings and creator_id"), [{ kind: "text", text: "snip_clip_earnings and creator_id" }]);
  });

  it("keeps the words but not the link when he could not open it", () => {
    assert.deepEqual(parseDocInline("[the pull request](https://github.com/lincolnnunnally/operate/pull/102)"), [{ kind: "text", text: "the pull request" }]);
    assert.deepEqual(parseDocInline("[x](javascript:alert(1))")[0], { kind: "text", text: "x" });
    assert.deepEqual(parseDocInline("[page](/integrations)"), [{ kind: "text", text: "page" }]);
  });

  it("says how long the read is", () => {
    assert.equal(docReadingTime("a few words"), "about 1 minute");
    assert.equal(docReadingTime("word ".repeat(600)), "about 3 minutes");
  });
});
