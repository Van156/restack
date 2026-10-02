import { Avatar, AvatarFallback } from "@base-template/ui/components/avatar";
import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import { format } from "date-fns";
import { toast } from "sonner";

import {
  activityActors,
  activityEvents,
  activityKindLabel,
  initials,
  type ActivityEvent,
} from "./-example-mock-data";

function groupByDay(events: readonly ActivityEvent[]) {
  const groups = new Map<string, ActivityEvent[]>();
  for (const event of events) {
    const day = format(new Date(event.at), "EEEE, MMM d");
    groups.set(day, [...(groups.get(day) ?? []), event]);
  }
  return [...groups];
}

/** Variant C: chronological feed grouped by day, with a people strip as the primary entry point. */
export function VariantC() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold tracking-tight">What the team did this week</h1>
        <div className="flex flex-wrap gap-2">
          {activityActors.map((actor) => (
            <Button
              key={actor}
              variant="outline"
              size="sm"
              onClick={() => toast(`Filtering by ${actor} (stub)`)}
            >
              <Avatar size="sm">
                <AvatarFallback>{initials(actor)}</AvatarFallback>
              </Avatar>
              {actor}
            </Button>
          ))}
        </div>
      </header>
      {groupByDay(activityEvents).map(([day, events]) => (
        <section key={day} aria-label={day} className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-muted-foreground">{day}</h2>
          <ol className="ml-3 flex flex-col gap-6 border-l pl-6">
            {events.map((event) => (
              <li key={event.id} className="relative flex flex-col gap-1">
                <span className="absolute top-1.5 -left-[1.9rem] size-2.5 rounded-full bg-primary ring-4 ring-background" />
                <p className="text-sm">
                  <span className="font-medium">{event.actor}</span> {event.action}{" "}
                  <span className="font-medium">{event.target}</span>
                </p>
                <p className="text-sm text-muted-foreground">{event.detail}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <time dateTime={event.at}>{format(new Date(event.at), "HH:mm")}</time>
                  <Badge variant="secondary">{activityKindLabel[event.kind]}</Badge>
                  <span>{event.project}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </main>
  );
}
