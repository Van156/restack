import { orgQueryKey } from "@/shared/lib/org-query-key";

export function cashierQueryKey(organizationId: string | undefined, ...parts: readonly unknown[]) {
  return orgQueryKey(organizationId, "cashier", ...parts);
}
