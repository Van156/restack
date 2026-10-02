import { listOrganizationMembers } from "@base-template/auth/org-members";

import { orgProcedure } from "../index";
import { createListInput } from "../lib/list-input";
import { orgMembersListConfig } from "../lib/members-list-config";

const membersListInput = createListInput(orgMembersListConfig);

/**
 * Organization members read endpoint. Like better-auth's `listMembers`, any member of the active
 * organization may list its members. The organization always comes from the session
 * (`orgProcedure`'s `context.org`, which also requires the caller's membership); the input
 * carries no organization id, so a client cannot widen the list to another tenant.
 */
export const membersRouter = {
  list: orgProcedure
    .input(membersListInput)
    .handler(({ context, input }) =>
      listOrganizationMembers(context.db, { organizationId: context.org.id, input }),
    ),
};
