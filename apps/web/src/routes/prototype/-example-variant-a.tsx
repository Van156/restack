import { Badge } from "@base-template/ui/components/badge";
import { Input } from "@base-template/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@base-template/ui/components/table";
import { format } from "date-fns";
import { useState } from "react";

import { activityEvents, activityKindLabel } from "./-example-mock-data";

/** Variant A: dense, scannable table with a single search box as the primary affordance. */
export function VariantA() {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const rows = activityEvents.filter((event) =>
    `${event.actor} ${event.action} ${event.target} ${event.project}`
      .toLowerCase()
      .includes(needle),
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Team activity</h1>
        <Input
          aria-label="Filter activity"
          placeholder="Filter by person, project or event"
          className="max-w-xs"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>What</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="text-muted-foreground tabular-nums">
                  {format(new Date(event.at), "MMM d, HH:mm")}
                </TableCell>
                <TableCell className="font-medium">{event.actor}</TableCell>
                <TableCell>
                  <span className="text-muted-foreground">{event.action}</span> {event.target}
                </TableCell>
                <TableCell>{event.project}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{activityKindLabel[event.kind]}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No activity matches your filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
