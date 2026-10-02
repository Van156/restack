/** Public API of the organizations feature (spec §4.4). Everything else is internal. */
export { default as CreateOrganizationPage } from "./components/create-organization-page";
export { default as GeneralSettingsPage } from "./components/general-settings-page";
export { default as MembersPage } from "./components/members-page";
export { default as OrgSwitcher } from "./components/org-switcher";
export { useOrgMemberDirectory, type OrgDirectoryMember } from "./hooks/use-org-member-directory";
export { membersSearchDefaults, membersSearchSchema } from "./lib/members-search";
export { decideOrgLayoutGuard } from "./lib/org-layout-guard";
