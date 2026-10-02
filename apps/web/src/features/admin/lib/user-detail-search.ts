import { createUserAuditTabSearchSchema } from "@/features/audit-log";

export const USER_DETAIL_TABS = ["details", "activity"] as const;
export type UserDetailTab = (typeof USER_DETAIL_TABS)[number];

/** `validateSearch` of `/admin/users/$id`: the selected tab plus the Activity tab's table state. */
export const userDetailSearchSchema = createUserAuditTabSearchSchema(USER_DETAIL_TABS, "details");

export type UserDetailSearch = ReturnType<typeof userDetailSearchSchema.parse>;

export const userDetailSearchDefaults: UserDetailSearch = userDetailSearchSchema.parse({});
