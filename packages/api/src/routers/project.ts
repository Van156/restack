import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { orgProcedure, requirePermission } from "../index";

/**
 * TEMPLATE EXAMPLE ONLY (spec §4.2): in-memory demo of `orgProcedure` + `requirePermission`; replace
 * with a real `packages/db` feature. Reads and writes are scoped by `context.org.id` (R5.1).
 */
type ProjectRecord = {
  id: string;
  name: string;
  organizationId: string;
};

/** Arbitrary demo bound that caps memory use. */
const MAX_PROJECT_NAME_LENGTH = 100;

/** Arbitrary demo bound that caps memory use. */
const MAX_PROJECTS_PER_ORGANIZATION = 100;

const projectsByOrganization = new Map<string, ProjectRecord[]>();
let nextProjectId = 1;

/** Test-only: clears the in-memory store between tests. */
export function resetProjectsForTests(): void {
  projectsByOrganization.clear();
  nextProjectId = 1;
}

export const projectRouter = {
  list: orgProcedure.use(requirePermission({ project: ["read"] })).handler(({ context }) => {
    return projectsByOrganization.get(context.org.id) ?? [];
  }),

  create: orgProcedure
    .use(requirePermission({ project: ["create"] }))
    .input(z.object({ name: z.string().min(1).max(MAX_PROJECT_NAME_LENGTH) }))
    .handler(({ context, input }) => {
      const existing = projectsByOrganization.get(context.org.id) ?? [];
      if (existing.length >= MAX_PROJECTS_PER_ORGANIZATION) {
        throw new ORPCError("BAD_REQUEST", {
          message: `This organization already has the maximum of ${MAX_PROJECTS_PER_ORGANIZATION} example projects (demo limit).`,
        });
      }
      const record: ProjectRecord = {
        id: String(nextProjectId++),
        name: input.name,
        organizationId: context.org.id,
      };
      existing.push(record);
      projectsByOrganization.set(context.org.id, existing);
      return record;
    }),
};
