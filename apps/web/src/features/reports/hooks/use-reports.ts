import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";
import { orgQueryKey } from "@/shared/lib/org-query-key";

import type { ReportView } from "../lib/reports-search";

export type ReportScope = { date: string; locationId: string | undefined };

/** Reports are read once per filter change and refreshed on demand, not polled. */
export function useReport(view: ReportView, scope: ReportScope) {
  const { data: organization } = authClient.useActiveOrganization();
  const input = { date: scope.date, locationId: scope.locationId };
  return useQuery({
    queryKey: orgQueryKey(organization?.id, "reports", view, scope),
    queryFn: async () => {
      switch (view) {
        case "ventas":
          return { view, data: await client.restaurant.reports.daily(input) } as const;
        case "productos":
          return { view, data: await client.restaurant.reports.byItem(input) } as const;
        case "equipo":
          return { view, data: await client.restaurant.reports.byStaff(input) } as const;
        case "cocina":
          return { view, data: await client.restaurant.reports.kitchen(input) } as const;
      }
    },
    enabled: Boolean(organization?.id),
    retry: false,
  });
}
