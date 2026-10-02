/** Initial memory-history entry for `withRouter`, from `parameters.routerPath` (defaults to `/`). */
export function resolveRouterPath(parameters: Record<string, unknown>): string {
  const path = parameters.routerPath;
  return typeof path === "string" && path.length > 0 ? path : "/";
}
