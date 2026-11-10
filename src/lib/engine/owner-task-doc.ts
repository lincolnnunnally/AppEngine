// Reading material on a to-do card — the pure part. Turns the plain text or simple markdown an agent copied
// into a task (OwnerTaskDoc.text) into blocks the page can draw. No fetch, no env, no `@/` imports, so
// `node --test` exercises the real module.
//
// Deliberately small: headings, paragraphs, lists, tables, code, bold, `code` and links. Anything it does not
// know is shown as the words that were written, never dropped and never run as HTML.
import { safeLink, unreadableLink } from "./owner-tasks-core.ts";

export type DocInline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string };

export type DocBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "para"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "code"; text: string };

const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*$/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function parseDocBlocks(source: string): DocBlock[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: DocBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "para", text: para.join(" ") });
    para = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (/^\s*```/.test(line)) {
      flush();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push({ kind: "code", text: code.join("\n") });
      continue;
    }

    if (!line.trim()) {
      flush();
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flush();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", level: Math.min(heading[1].length, 3) as 1 | 2 | 3, text: heading[2] });
      continue;
    }

    if (line.includes("|") && index + 1 < lines.length && TABLE_RULE.test(lines[index + 1])) {
      flush();
      const header = cells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(cells(lines[index]));
        index += 1;
      }
      index -= 1;
      blocks.push({ kind: "table", header, rows });
      continue;
    }

    const first = BULLET.exec(line) || NUMBERED.exec(line);
    if (first) {
      flush();
      const ordered = !BULLET.test(line);
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index];
        const item = BULLET.exec(current) || NUMBERED.exec(current);
        if (item) {
          items.push(item[1].trim());
        } else if (current.trim() && /^\s+/.test(current) && items.length) {
          // A wrapped line belongs to the item above it.
          items[items.length - 1] += ` ${current.trim()}`;
        } else {
          break;
        }
        index += 1;
      }
      index -= 1;
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    para.push(line.replace(/^\s*>\s?/, "").trim());
  }
  flush();
  return blocks;
}

const INLINE = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

/**
 * Bold, `code` and links inside one line. A link he cannot open (a private GitHub page) or that is not plain
 * http(s) keeps its words and loses the link, so no button on the page leads to a 404.
 */
export function parseDocInline(source: string): DocInline[] {
  const out: DocInline[] = [];
  let last = 0;
  for (const match of source.matchAll(INLINE)) {
    const at = match.index ?? 0;
    if (at > last) out.push({ kind: "text", text: source.slice(last, at) });
    if (match[1] !== undefined) out.push({ kind: "bold", text: match[1] });
    else if (match[2] !== undefined) out.push({ kind: "code", text: match[2] });
    else {
      const href = safeLink(match[4]);
      if (href && /^https?:/.test(href) && !unreadableLink(href)) out.push({ kind: "link", text: match[3], href });
      else out.push({ kind: "text", text: match[3] });
    }
    last = at + match[0].length;
  }
  if (last < source.length) out.push({ kind: "text", text: source.slice(last) });
  return out;
}

/** Rough reading time, so he knows what he is opening: "about 3 minutes". */
export function docReadingTime(source: string): string {
  const words = source.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return minutes === 1 ? "about 1 minute" : `about ${minutes} minutes`;
}
