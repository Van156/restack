/** A Table session by server id, or by the key of the `open_session` record that opened it offline. */
export type SessionRef = { sessionId: string } | { sessionKey: string };
