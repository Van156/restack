import { describeUserAgent } from "@/shared/lib/user-agent";

/** The `authClient.listSessions()` fields the list reads (never the token's value in the UI). */
export type ListedSession = {
  id: string;
  token: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  updatedAt: Date;
};

export type SessionRow = {
  id: string;
  token: string;
  device: string;
  ipAddress: string | null;
  /** The session row's `updatedAt`: refreshed when the session is used (R4.1 "last active"). */
  lastActive: Date;
  isCurrent: boolean;
};

/** R4.1: rows for the sessions list, the current session first, then most recently active. */
export function toSessionRows(
  sessions: readonly ListedSession[],
  currentSessionId: string | undefined,
): SessionRow[] {
  return sessions
    .map((session) => ({
      id: session.id,
      token: session.token,
      device: describeUserAgent(session.userAgent),
      ipAddress: session.ipAddress || null,
      lastActive: new Date(session.updatedAt),
      isCurrent: session.id === currentSessionId,
    }))
    .toSorted(
      (a, b) =>
        Number(b.isCurrent) - Number(a.isCurrent) ||
        b.lastActive.getTime() - a.lastActive.getTime(),
    );
}
