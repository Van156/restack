const TITLE_SENTINEL = "<title></title>";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Fills the empty `<title></title>` of `index.html` with the (HTML-escaped) brand name. Throws when
 * the sentinel is missing so a changed `index.html` fails the build instead of shipping no title.
 * Free of browser-only imports: `vite.config.ts` imports it.
 */
export function injectBrandTitle(html: string, name: string) {
  if (!html.includes(TITLE_SENTINEL)) {
    throw new Error(
      `brand-html: index.html must contain an empty ${TITLE_SENTINEL} to receive the brand name.`,
    );
  }
  return html.replace(TITLE_SENTINEL, () => `<title>${escapeHtml(name)}</title>`);
}
