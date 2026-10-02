import { Avatar, AvatarFallback } from "@base-template/ui/components/avatar";
import { Badge } from "@base-template/ui/components/badge";
import { Button } from "@base-template/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@base-template/ui/components/card";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@base-template/ui/components/item";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

import { activityEvents, activityKindLabel, initials } from "./-example-mock-data";

/** Variant B: master/detail split. The list picks an event; the detail pane hosts the actions. */
export function VariantB() {
  const [selectedId, setSelectedId] = useState(activityEvents[0].id);
  const selected = activityEvents.find((event) => event.id === selectedId) ?? activityEvents[0];

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 p-6 md:grid-cols-[22rem_1fr]">
      <ItemGroup className="gap-1" aria-label="Activity list">
        {activityEvents.map((event) => (
          <Item
            key={event.id}
            size="sm"
            variant={event.id === selected.id ? "muted" : "default"}
            render={
              <button
                type="button"
                aria-pressed={event.id === selected.id}
                onClick={() => setSelectedId(event.id)}
                className="text-left"
              />
            }
          >
            <ItemMedia>
              <Avatar size="sm">
                <AvatarFallback>{initials(event.actor)}</AvatarFallback>
              </Avatar>
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{event.target}</ItemTitle>
              <ItemDescription>
                {event.actor} · {format(new Date(event.at), "MMM d")}
              </ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
      <Card className="h-fit">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge>{activityKindLabel[selected.kind]}</Badge>
            <Badge variant="outline">{selected.project}</Badge>
          </div>
          <CardTitle className="text-lg">{selected.target}</CardTitle>
          <CardDescription>
            {selected.actor} {selected.action} this on{" "}
            {format(new Date(selected.at), "MMMM d 'at' HH:mm")}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm">{selected.detail}</p>
          <div className="flex gap-2">
            <Button onClick={() => toast.success(`Following "${selected.target}"`)}>Follow</Button>
            <Button variant="outline" onClick={() => toast(`Pinged ${selected.actor}`)}>
              Ping {selected.actor.split(" ")[0]}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
