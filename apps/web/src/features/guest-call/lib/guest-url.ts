/** The public page a Table QR encodes: `/m/<token>` under the app origin. */
export function guestCallUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/m/${encodeURIComponent(token)}`;
}
