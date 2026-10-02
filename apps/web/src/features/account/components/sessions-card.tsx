import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@base-template/ui/components/card";

import type { SessionRow } from "../lib/session-rows";

/**
 * Active sessions list (R4.1). Presentational: the current session is marked and has no revoke
 * button (R4.2); the container owns the confirmation dialogs and the revoke calls.
 */
export default function SessionsCard({
  sessions,
  onRevoke,
  onRevokeOthers,
}: {
  sessions: readonly SessionRow[];
  onRevoke: (session: SessionRow) => void;
  onRevokeOthers: () => void;
}) {
  const hasOthers = sessions.some((session) => !session.isCurrent);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessions</CardTitle>
        <CardDescription>Devices where you are signed in.</CardDescription>
        <CardAction>
          <Button variant="outline" disabled={!hasOthers} onClick={onRevokeOthers}>
            Sign out all other sessions
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y">
          {sessions.map((session) => (
            <li key={session.id} className="flex items-center justify-between gap-4 py-3">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{session.device}</span>
                  {session.isCurrent ? <Badge variant="info">This session</Badge> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {session.ipAddress ?? "IP unknown"} · Last active{" "}
                  <time dateTime={session.lastActive.toISOString()}>
                    {session.lastActive.toLocaleString()}
                  </time>
                </p>
              </div>
              {session.isCurrent ? null : (
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Sign out ${session.device} (${session.ipAddress ?? "IP unknown"})`}
                  onClick={() => onRevoke(session)}
                >
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
