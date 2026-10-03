# Web app pages and routes

Rationale behind the page, route and guard comments in `apps/web`. Requirement ids refer to [`specs/auth-multitenant-rbac.md`](../specs/auth-multitenant-rbac.md).

## Branding

The product name, tagline, logo and PWA theme color live in `apps/web/src/app/brand.ts`; the auth
brand panel, document title, meta description and PWA manifest (`vite.config.ts`) all read from it.
The color palette is driven by one knob, `--brand-hue`, in `packages/ui/src/styles/globals.css`.
If you change the hue, update `themeColor` in `brand.ts` to match the light-mode `--sidebar` token.

`/` has no page: it redirects to `/dashboard` for a signed-in user (the `_org` guard then sends a
user without an organization to `/onboarding`) and to `/sign-in` otherwise (`loadHomeRedirect` / `resolveHomeRedirect`). A rejected session lookup is logged and forwarded to `/dashboard`, so the `_auth` guard owns the decision.

Auth screens render in `AuthLayout`: the form column (`AuthCard`) beside an ink brand panel fed by `brand.ts`. Inputs and buttons on these screens opt into the large size with `size="lg"`; terminal states use `AuthStatusNotice`, whose link actions pass `className="w-full"` on the wrapping `Link`.

## Permission-gated pages

`CanGate` (`@/features/access-control`) wraps a page that guards its whole content on one `useCan` permission. It renders, in order:

1. A loader while the check is pending.
2. A retryable `LoadError` when the check itself failed (for example a network error).
3. `NoPermission` when the check resolved to `false`.
4. `children` once `can` is `true`.

This is UX only: every underlying read and write is re-checked server-side regardless of what renders.

The settings layout (`routes/_auth/_org/settings/route.tsx`) renders the title and `SectionNav`. Four of the five pages gate on the permission their routes-table row names:

| Page        | Permission            |
| ----------- | --------------------- |
| General     | `organization:update` |
| Invitations | `invitation:create`   |
| Roles       | `ac:read`             |
| Activity    | `audit:read`          |

Members is different by design: its guard column reads "member", and R3.1 says any member can list members. better-auth's `member` statement has no `read` or `list` action to check, and membership is already the gate, enforced one layer up by `_auth/_org/route.tsx` (no active organization, no membership, never reaches this layout). The members page therefore renders unconditionally and gates only its two mutations (`member:update`, `member:delete`) individually.

R3.4 (last owner) is enforced server-side and its errors are shown verbatim: paginated rows cannot tell whether a member is the last owner.

## General settings danger zone

`/settings/general` gates per section instead of per page. The rename and slug form stays behind `CanGate organization:update`; the danger zone (`OrgDangerZoneSection` container, `OrgDangerZone` presentational) renders for every member. Leave is offered to everyone; the last owner sees "transfer ownership or delete the organization first" instead (R10.1, from the member directory; the server still decides). Transfer is offered to owners: a member picker excluding the caller and a confirmation naming the target (`organization.transferOwnership`, R8.4; errors mapped by `transferOwnershipErrorMessage`). Delete is offered with `organization:delete` and requires typing the exact organization name (`ConfirmDialog` `confirmationPhrase`, R11.2). The settings tabs do not hide General, so plain members reach it.

After leaving or deleting, `useOrgLanding` lists the remaining organizations, activates the first one and opens `/dashboard`, or goes to `/onboarding` when none is left (`decideOrgLanding`, R10.2, R11.4); a failed list never counts as "none". Transfer invalidates the members, member-directory, `active-member-role` and `can` queries.

## Org guard and onboarding

`_auth/_org/route.tsx` gates every org-scoped route (dashboard, `settings/*`) on an active organization. A user with memberships but none active (first sign-in after an invitation elsewhere, or the active organization was deleted or left) is defaulted onto their first membership. Onboarding is reserved for users with zero organizations.

A failed `organization.list()` or `setActive()` renders `errorComponent` with a retry, instead of silently redirecting to onboarding or rendering with no active organization: those failures would be indistinguishable from "the user really has zero organizations". The branching is the pure, unit-tested `decideOrgLayoutGuard`.

The onboarding route (R1.4) fails open: a failed `organization.list()` keeps the create-organization form instead of blocking. Unlike the org guard there is no risk of silently picking the wrong destination; at worst a user who has an organization sees the form once and can still navigate to `/dashboard`.

Where a flow ends depends on what it knows about memberships:

- Accepting an invitation during sign-up goes straight to `/dashboard`: the user is already a member of the inviting organization, so the "create your first org" form would be wrong.
- Verifying an email goes to `/onboarding` without checking memberships; the onboarding guard sends an existing member on to the dashboard and shows the form only to a user with zero organizations (R1.4).

## Account area and password recovery

`routes/_auth/account/route.tsx` is the personal area (account-settings R1). It sits under `_auth` but not `_org`, so it never requires or redirects on an active organization, and opts into the app shell with `staticData: { appShell: true }`. `/account` redirects to `/account/profile`.

| Route                  | Page                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/account/profile`     | Name (email read-only).                                                                                    |
| `/account/security`    | Email change, change or set password, sessions, security log. Table state lives in the search.             |
| `/account/preferences` | Theme.                                                                                                     |
| `/account/danger`      | Delete account: confirm dialog, then an emailed link; blocked with the organization list for a last owner. |

Public routes `/forgot-password` and `/reset-password` live in `_public-auth`. The reset link lands on `/reset-password?token=...`; only an `INVALID_TOKEN` error switches to the invalid-link state, other failures stay inline and retryable. After the delete link is opened the server redirects to `/sign-in`.

Navigation: `navGroups` in `app/navigation.ts` is the single source for the sidebar and the section tabs (`getSectionItems`). The `account` group ("Personal") is always visible. The org-scoped groups (Dashboard, Organization) are hidden when the user has no organization (`resolveHasOrganization`): an active organization, any membership, a loading list or a failed list lookup keeps them, so links never flash away or vanish on a transient error. Visibility is UX only; every page keeps its own gate.

## Admin area

`routes/_auth/admin/route.tsx` shows the area only to platform superadmins, including against an organization owner (owning organizations grants no platform permission, R6.5 layer isolation). This is UX only: every procedure under `platformRouter` re-checks the caller's platform permission. It renders `NoPermission` rather than redirecting, consistent with `CanGate` and the org settings pages.

The user detail page has Details and Activity tabs (`tab` in the route search; Activity is the user's security log, see [audit-log.md](./audit-log.md#views)). It keys each card by user id. TanStack Router keeps the page mounted when only the `$id` param changes, so without the key each card's local state (the org-limit input, the in-progress ban reason and expiry) would survive navigating between two users and could be saved against the wrong one.

### Impersonation

Impersonate and stop-impersonating go through better-auth's own client (`authClient.admin.stopImpersonating`), not oRPC: session and identity actions belong to better-auth. Both invalidate every cached query, because everything derived from "who am I" (active organization, roles, permissions) changes at once; the banner then returns to `/admin/users`.

### Permission load errors

`permission-load-error.tsx` is the shared early return of the ban, org-limit and impersonate cards. It renders only when the `usePlatformCan` query has no cached `data` (the first permission load failed). A failed background refetch of an already resolved query must not replace a working, authorized card mid-edit.

## Restaurant pages

`routes/_auth/_org/restaurant/route.tsx` is the layout (`SectionNav` tabs from the `restaurant` group in `navGroups`). UI copy is Spanish; error messages that come from the server are shown verbatim and are still English.

| Route                   | Page                                                             | Gate (UX only; the server re-checks)          |
| ----------------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| `/restaurant/locations` | Locations list and form (`features/locations`)                   | `setup:manage`; creating needs the Owner      |
| `/restaurant/setup`     | Setup wizard, step in `?step=` (`features/setup`)                | `setup:manage`                                |
| `/restaurant/staff`     | Staff list, invite with Role and Locations, assign, reset PIN    | `staff:manage`; Owner row limited (see below) |
| `/restaurant/devices`   | Paired devices: pair, rename, revoke (`features/devices`)        | `setup:manage`                                |
| `/restaurant/pin`       | The caller's own PIN                                             | none beyond membership                        |
| `/activate`             | Public kitchen screen activation, under `_public-auth`, `?code=` | none (no session)                             |

- **Active Location.** `useActiveLocation` resolves the Location a page works in: the one the user last picked (kept per organization in `localStorage`), else the first active one. Pages wrap their content in `LocationScope`, which shows the loader, retryable error or empty state and renders the picker. The Location list is already scoped server-side (the Owner sees all, everyone else their assignments).
- **Query keys.** Restaurant queries use `orgQueryKey(organizationId, ...)` because switching organization does not clear the cache; setup writes invalidate the `["org", id, "setup"]` prefix.
- **Setup wizard.** Steps are Áreas, Mesas, Estaciones, Menú and Revisar; completion is derived from the loaded counts (`stepCompletion`), never stored. The preview renders the T13 `FloorPlanTile` for every Table. Menu categories and items are restaurant-wide; Station routing and sold-out are per Location. The menu CSV import validates with `commit: false` first and commits only on a second, explicit action; row errors keep the file's line numbers (header is line 1).
- **Staff.** The directory comes from better-auth members (`useOrgMemberDirectory`, capped at 500) joined with `staff.listAssignments`, which lists only Staff that have assignments in the caller's scope. Inviting is two calls: `inviteMember` (Role) then `staff.setInvitationLocations`; when the second fails the invitation exists, so the page offers a retry for the Locations instead of inviting again. The Owner row never offers Locations, and only the Owner can reset the Owner's PIN (`rowActions`).
- **PIN entry.** The T13 `PinPad` takes the digits; `advancePinEntry` asks for the current PIN when changing, then the new PIN twice. No procedure says whether a member already has a PIN, so `/restaurant/pin` asks the person.
- **Device activation.** See [restaurant.md](./restaurant.md#paired-devices) for where the device token is stored.

## Audit log pages

The organization page uses `audit.list`, scoped server-side to `ctx.org.id`; no organization override is accepted, so the page can never be pointed at another tenant's log. Members back the actor filter (a picker instead of a raw id) and resolve actor ids to names; they are paginated past better-auth's 100-row page size and capped, with an `isIncomplete` flag surfaced in the page.

The platform page uses `audit.listPlatform` and shares the table, display helpers and server allowlists with the organization page so the two cannot drift. Its actor and organization filters are free-text ids: a platform-wide member directory would mean loading every user across every tenant, which does not bound the way one organization's member list does.

## Invitation acceptance

Sign-up through an invitation (R2.4) posts to the custom `POST /invitation/sign-up` endpoint. There is no preview-by-token endpoint, so the invited email and organization name are known only server-side and are not shown before submission.

R5.5: Google sign-up carries the invitation id through the OAuth state, and the server accepts it only when Google's verified email equals the invited email. On success the user lands back on the page signed in and still accepts explicitly (the recipient check is unchanged). A failed round trip returns with the token so the password sign-up stays usable.

For a signed-in recipient, both buttons disable while either mutation is in flight so a double click cannot race two mutually exclusive actions against one invitation.

## Load errors

`LoadError` mirrors the presentation of `OrgLayoutError` in `_auth/_org/route.tsx`, so every load failure in the app looks the same. A `useCan` load failure must surface a retryable error, never the permanent `NoPermission` screen.
