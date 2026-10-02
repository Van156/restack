/** In-memory mock data for the "team activity overview" example. No API, no auth. */

export type ActivityKind = "deploy" | "review" | "comment" | "incident";

export interface ActivityEvent {
  id: string;
  actor: string;
  action: string;
  target: string;
  project: string;
  kind: ActivityKind;
  detail: string;
  /** ISO timestamp; fixed so the prototype renders identically on every load. */
  at: string;
}

export const activityKindLabel: Record<ActivityKind, string> = {
  deploy: "Deploy",
  review: "Review",
  comment: "Comment",
  incident: "Incident",
};

export const activityEvents: readonly ActivityEvent[] = [
  {
    id: "evt-01",
    actor: "Maya Chen",
    action: "deployed",
    target: "api v2.14.0",
    project: "Platform",
    kind: "deploy",
    detail: "Rolled out to production in 4 minutes. Error rate stayed under 0.1%.",
    at: "2026-09-30T16:42:00Z",
  },
  {
    id: "evt-02",
    actor: "Jonas Weber",
    action: "requested review on",
    target: "Billing: proration fix",
    project: "Billing",
    kind: "review",
    detail: "Touches invoice rounding. Needs a second pair of eyes before the month-end run.",
    at: "2026-09-30T15:10:00Z",
  },
  {
    id: "evt-03",
    actor: "Priya Nair",
    action: "opened incident",
    target: "Slow dashboard queries",
    project: "Platform",
    kind: "incident",
    detail: "p95 latency tripled after the 14:00 migration. Investigating missing index.",
    at: "2026-09-30T14:25:00Z",
  },
  {
    id: "evt-04",
    actor: "Leo Martins",
    action: "commented on",
    target: "Onboarding checklist spec",
    project: "Growth",
    kind: "comment",
    detail: "Suggests moving the invite step before profile setup to lift activation.",
    at: "2026-09-30T11:05:00Z",
  },
  {
    id: "evt-05",
    actor: "Maya Chen",
    action: "approved",
    target: "Search: typo tolerance",
    project: "Growth",
    kind: "review",
    detail: "Approved with two nits on analytics event naming.",
    at: "2026-09-29T17:50:00Z",
  },
  {
    id: "evt-06",
    actor: "Priya Nair",
    action: "resolved incident",
    target: "Webhook retries stuck",
    project: "Billing",
    kind: "incident",
    detail: "Dead-letter queue drained; retry backoff raised to 5 minutes.",
    at: "2026-09-29T13:30:00Z",
  },
  {
    id: "evt-07",
    actor: "Jonas Weber",
    action: "deployed",
    target: "web v5.3.1",
    project: "Platform",
    kind: "deploy",
    detail: "Hotfix for the settings page crash on Safari 17.",
    at: "2026-09-29T09:15:00Z",
  },
  {
    id: "evt-08",
    actor: "Leo Martins",
    action: "commented on",
    target: "Q4 roadmap draft",
    project: "Growth",
    kind: "comment",
    detail: "Asks whether SSO fits before the enterprise pilot in November.",
    at: "2026-09-28T16:20:00Z",
  },
];

/** Distinct actors, in first-appearance order. */
export const activityActors: readonly string[] = [
  ...new Set(activityEvents.map((event) => event.actor)),
];

/** Two-letter initials for avatar fallbacks. */
export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
