/** Keep the last two words of a heading or sentence on the same line. */
export function noOrphan(text: string): string {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts.join("");
  if (parts.length === 2) return parts.join("\u00a0");
  return `${parts.slice(0, -2).join(" ")} ${parts.slice(-2).join("\u00a0")}`;
}

/**
 * Split a title into two even phrases so a full line never dumps one leftover
 * word onto the next. Short titles stay one line with a non-breaking last pair.
 */
export function splitTitleLines(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  if (words.length <= 3) return [noOrphan(words.join(" "))];

  let best = Math.ceil(words.length / 2);
  let bestScore = Infinity;
  for (let i = 1; i < words.length; i++) {
    const left = words.slice(0, i).join(" ");
    const right = words.slice(i).join(" ");
    const leftoverPenalty = i === words.length - 1 ? 80 : 0;
    const shortLinePenalty = Math.min(left.length, right.length) < 8 ? 30 : 0;
    const score = Math.abs(left.length - right.length) + leftoverPenalty + shortLinePenalty;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}
