/**
 * Up to two initials for an avatar fallback: first letters of the first and last
 * word, or the first two letters of a single word. Code-point safe; `""` for a blank name.
 */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const [first] = words;
  if (!first) {
    return "";
  }
  const last = words[words.length - 1] ?? first;
  const letters =
    words.length === 1
      ? Array.from(first).slice(0, 2)
      : [Array.from(first)[0], Array.from(last)[0]];
  return letters.join("").toUpperCase();
}
