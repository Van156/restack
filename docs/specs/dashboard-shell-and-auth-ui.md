# Spec: Dashboard Shell & Auth Pages — Adopt the `template-dashboard` Design

> **Superseded in part (2026-10-02):** the design-refresh feature (`odd/tasks/design-refresh.md`) replaced the split-card auth layout with an ink brand panel layout, removed the "Or continue with" divider, and turned the `/` home page into a redirect (`/dashboard` or `/sign-in`). Those parts of this spec are kept as history; see `docs/architecture/web-app.md` for the current behaviour.

- **Status:** Implemented (manual smoke pending)
- **Date:** 2026-09-30
- **Stack:** React 19, TanStack Router + Query + Form, better-auth, Tailwind v4, shadcn (Base UI; style chosen in T0, replaces `base-lyra`), Geist Sans/Mono, `packages/ui`, Storybook 10
- **Depends on:** `frontend-foundation.md` (primitives, import boundaries, feature structure) and `storybook.md` (story convention and coverage test). Amends `storybook.md` (its out-of-scope item on `apps/web` stories, see R4.5). Preserves all behaviour from `auth-multitenant-rbac.md` except the deliberate changes listed in R4.1.

## 1. Objective

Make `apps/web` adopt the **full visual design (look and composition)** of three surfaces of the reference Next.js project `/Users/vandev/builds/nextjs/template-dashboard` (the "reference"):

1. The dashboard **sidebar / app shell** (team switcher header, collapsible nav with sub-items, footer user menu, inset content with a breadcrumb header).
2. The **sign-in** page (split card: form on the left, branded panel on the right).
3. The **sign-up** page (same split card, more fields).

"Full look" means the reference's rounded corners (reference radius), `text-sm` controls and menu buttons, and Geist Sans/Mono, applied app-wide and to the `packages/ui` primitives (T0). Radix is **not** adopted; the app stays on Base UI.

**Existing base-template auth and access behaviour is preserved** except the deliberate changes in R4.1 (Google sign-in, `/sign-in` and `/sign-up` route split, confirm password, inline alert errors): better-auth email/password flows with `requireEmailVerification`, the "check your inbox" screen and resend cooldown, `/verify-email`, invitation flows (`/accept-invitation/$id`, invitation sign-up), organization onboarding and the org switcher's `setActive` semantics, and RBAC-driven navigation visibility (`NavGroup.visible` predicates, `CanGate`, admin layout guard). The reference's backend and auth logic (server `auth.api.getSession` redirects, the `useEffect` that auto-selects an org, react-hook-form, DiceBear avatars, stubbed social buttons) is **not** adopted. The one deliberate backend addition is real Google social sign-in (R5).

## 2. Scope

### In scope

- **Visual foundation (T0):** rounded reference radius, `text-sm` controls, Geist fonts across the app and `packages/ui` primitives and their stories.
- Restyle and restructure `AppSidebar` / `AppShell` / `AppHeader` to the reference composition (§4.1), fed by the existing `navGroups` config, which gains optional `children` for collapsible sub-items.
- A team/org switcher in the sidebar header, a user menu in the sidebar footer, a breadcrumb in the header derived from `navGroups` (§4.1).
- Sidebar `collapsible="icon"` with `SidebarRail`, and the mobile behaviour of the reference.
- Split the login screen into `/sign-in` and `/sign-up` routes with the reference split-card layout (§4.2, §4.3), plus a `/login` redirect and the auth-pages backdrop layout (pathless `_public-auth` layout route).
- `check-inbox`, verify-email and accept-invitation (including invitation sign-up) screens also use the full `AuthCard` with the brand panel; behaviour unchanged.
- New presentational components, each with a co-located story (§6, R4.5).
- Extending Storybook (in `packages/ui`) to load stories from `apps/web/src` (R4.5).
- Brand panel uses `apps/web/public/logo.png` and the name `base-template`; no reference asset is copied (§4.4).
- **Social sign-in with Google** (decisions 1, 17, 18): better-auth `socialProviders.google` configuration, env variables, a public enabled-providers endpoint, and the Google button on sign-in, sign-up and invitation sign-up (§6.3, R5).

### Out of scope

- Any change to oRPC procedures, route guards, or permissions. The only better-auth/server change is the social-provider configuration of R5.
- Any OAuth provider other than Google (GitHub included, despite appearing in the reference); the generic OAuth plugin.
- Restyling page content (dashboard, settings, admin, onboarding) beyond what the new shell and the visual foundation impose.
- The reference's demo content: "Models", "Documentation", "Projects" nav data, `NavProjects` (see §4.1.4), billing entry, the terms/privacy footnote.
- Adopting Radix (base-template stays on Base UI) and DiceBear avatars.

## 3. Glossary

| Term                  | Meaning                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Reference**         | `/Users/vandev/builds/nextjs/template-dashboard` (Next.js 15, shadcn `new-york`, Radix, lucide). Read-only.                                      |
| **Shell**             | Authenticated frame: `SidebarProvider` + `Sidebar` + `SidebarInset` (header + content).                                                          |
| **Auth card**         | The split card used by sign-in and sign-up: form column + brand panel.                                                                           |
| **Brand panel**       | The right half of the auth card: radial gradient (`from-sidebar-accent to-sidebar`), logo, product name; hidden below `md`.                      |
| **Icon-collapsed**    | Sidebar state with `collapsible="icon"` when toggled closed: only icons remain, tooltips show labels.                                            |
| **Nav config**        | `apps/web/src/app/navigation.ts` `navGroups`: typed `NavGroup<NavContext>[]` with `visible` predicates (UX only); `NavItem` may have `children`. |
| **Visual foundation** | The rounded shape, `text-sm` controls and Geist fonts adopted from the reference (T0).                                                           |

## 4. Reference design

All facts below were read from the reference source. Next.js specifics are translated in §5.

### 4.1 Sidebar / app shell

**Files:** `src/components/layout/{main-layout,app-side-bar,team-switcher,nav-main,nav-projects,dashboard-user-button}.tsx`, `src/app/(dashboard)/layout.tsx` (renders `MainLayout`), stock shadcn `src/components/ui/sidebar.tsx`.

#### 4.1.1 Layout sketch (desktop, expanded)

```
+--------------------+--------------------------------------------------+
| [AV] Org name  ⇅   |  [⊞] | Building Your Application > Data Fetching |  h-16 header
|--------------------|--------------------------------------------------|
| Platform           |                                                  |
|  ▣ Admin        v  |   <main class="flex flex-1 flex-col gap-4        |
|     Manage Orgs    |          p-4 pt-0">                              |
|     Manage Users   |     {children}                                   |
|  ▣ Models       >  |                                                  |
|  ▣ Settings     >  |                                                  |
| Projects           |                                                  |
|  ▢ Design Eng   …  |                                                  |
|--------------------|                                                  |
| (AV) Name       v  |                                                  |
|      email         |                                                  |
+--------------------+--------------------------------------------------+
  Sidebar (16rem)      SidebarInset
```

Icon-collapsed: sidebar shrinks to icon width; group labels fade, sub-items and the Projects group are hidden, `SidebarRail` (thin hover handle on the edge) toggles it; header row height goes `h-16` -> `h-12`.

#### 4.1.2 Component tree

```
SidebarProvider                                  (defaults: cookie-persisted open state, Cmd/Ctrl+B)
├─ AppSidebar  -> <Sidebar collapsible="icon">   (variant default = "sidebar", side default = "left")
│  ├─ SidebarHeader
│  │  └─ TeamSwitcher
│  ├─ SidebarContent
│  │  ├─ NavMain      (SidebarGroup, label "Platform")
│  │  └─ NavProjects  (SidebarGroup, label "Projects", className "group-data-[collapsible=icon]:hidden")
│  ├─ SidebarFooter
│  │  └─ DashboardUserButton
│  └─ SidebarRail
└─ SidebarInset
   ├─ <header class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear
   │                 group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
   │  └─ div.flex.items-center.gap-2.px-4
   │     ├─ SidebarTrigger  className="-ml-1"
   │     ├─ Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4"
   │     └─ Breadcrumb > BreadcrumbList
   │        ├─ BreadcrumbItem className="hidden md:block" > BreadcrumbLink
   │        ├─ BreadcrumbSeparator className="hidden md:block"
   │        └─ BreadcrumbItem > BreadcrumbPage
   └─ <main class="flex flex-1 flex-col gap-4 p-4 pt-0">
```

The header has **no border and no background** (transparent, part of the inset); the breadcrumb is static placeholder text in the reference.

#### 4.1.3 Team switcher (sidebar header)

- `SidebarMenu > SidebarMenuItem > DropdownMenu`; trigger `SidebarMenuButton size="lg"` with `data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground`.
- Trigger content: a `size-8` rounded avatar tile (initials avatar of the org name), a `grid flex-1 text-left text-sm leading-tight` block with the org name (`truncate font-medium`), and `ChevronsUpDown` (`ml-auto`).
- Menu: `DropdownMenuContent` `w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg`, `align="start"`, `side` = `bottom` on mobile / `right` on desktop, `sideOffset={4}`.
  - Label "Organizations" (`text-muted-foreground text-xs`).
  - One item per organization (`gap-2 p-2`): `size-6` bordered rounded avatar, name, `DropdownMenuShortcut` showing `⌘{index+1}` (visual hint only; no key handler exists in the reference).
  - Separator, then an "add organization" item (`gap-2 p-2`): bordered `size-6` box with a `Plus` icon and a `text-muted-foreground font-medium` label. It has no handler in the reference.
- States: pending -> `Skeleton h-10 w-full`; exactly one organization -> the switcher renders `null`.

#### 4.1.4 Nav

- `NavMain`: `SidebarGroup` with `SidebarGroupLabel` "Platform". Each item is a `Collapsible` (`asChild`, `defaultOpen={item.isActive}`, `group/collapsible`) wrapping a `SidebarMenuItem`: `CollapsibleTrigger` > `SidebarMenuButton tooltip={title}` with icon, `<span>`, and `ChevronRight` (`ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90`). `CollapsibleContent` holds `SidebarMenuSub > SidebarMenuSubItem > SidebarMenuSubButton` links. The reference has **no active-route highlighting**; only `isActive` = default-open.
- Reference nav data: Admin (open by default; Manage Organizations, Manage Users, Settings), Models, Documentation, Settings. Mostly `#` placeholders. Not adopted as content.
- `NavProjects`: a second group with `SidebarMenuAction showOnHover` "more" dropdown per row (View / Share / Delete project) and a trailing "More" button. This is demo content with no base-template counterpart and is **not adopted**.

#### 4.1.5 Footer user menu (`DashboardUserButton`)

- Trigger (desktop `DropdownMenuTrigger`, mobile `DrawerTrigger`, chosen by `useIsMobile()`): a **custom button, not `SidebarMenuButton`**: `rounded-lg border border-border/10 p-3 w-full flex items-center justify-between bg-white/5 hover:bg-white/10 overflow-hidden gap-x-2`. Content: avatar (`size-9`, image or generated initials), two-line block (`text-sm truncate` name, `text-xs truncate` email) in `flex flex-col gap-0.5 text-left overflow-hidden flex-1 min-w-0`, `ChevronDownIcon size-4 shrink-0`.
- Desktop menu: `DropdownMenuContent align="end" side="right" className="w-72"`: label block (name `font-medium truncate`, email `font-normal text-sm text-muted-foreground truncate`), separator, items **Billing** (no handler) and **Log out** (`signOut` then navigate to the sign-in page). Items use `cursor-pointer flex items-center justify-between` with a lucide icon.
- Mobile: a bottom `Drawer` with title = name, description = email, footer buttons Billing / Log out (`variant="outline"`). (In the reference both buttons call logout; a bug, not design.)
- Renders `null` while the session is pending or missing. It does not adapt to the icon-collapsed state (`bg-white/5` fixed-tint button would overflow); base-template shows only the avatar when collapsed, opening the same menu (Q3).

#### 4.1.6 Tokens / styling notes

- Sidebar tokens `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border`, `--sidebar-ring` are the stock shadcn neutral set; base-template already defines the same values in `packages/ui/src/styles/globals.css`.
- `--radius: 0.625rem`, `new-york` style (rounded corners, `text-sm` menus). Reference fonts: Geist Sans / Geist Mono via `next/font`. Theme: `next-themes`, `attribute="class"`, `defaultTheme="dark"`.
- Icons: `lucide-react`. Root: `<html lang="en" suppressHydrationWarning>`.

### 4.2 Sign-in page

**Files:** `src/app/(auth)/layout.tsx`, `src/app/(auth)/sign-in/page.tsx` (server component: session redirect to `/`, reads `?invitationId`), `src/modules/auth/views/sign-in-view.tsx`.

#### 4.2.1 Layout sketch

```
bg-muted  min-h-svh  flex items-center justify-center  p-6 md:p-10
 └─ w-full max-w-sm md:max-w-3xl
    ├─ Card.overflow-hidden.p-0 > CardContent.grid.p-0.md:grid-cols-2
    │  ├─ <form class="p-6 md:p-8">                      ┃  brand panel (hidden < md)
    │  │    h1 "Welcome back"  (text-2xl font-bold)      ┃  bg-radial from-sidebar-accent
    │  │    p  "Login to your account" (muted, balance)  ┃          to-sidebar
    │  │    Email    [john@example.com]                  ┃  flex-col gap-y-4 items-center
    │  │    Password [********]                          ┃  justify-center
    │  │    (error Alert, destructive/10, icon)          ┃  [logo 92x92]
    │  │    [ Sign in ]  (w-full)                        ┃  "Meet.AI" text-2xl
    │  │    ───── Or continue with ─────                 ┃  font-semibold text-white
    │  │    [ Google icon ] [ GitHub icon ]  (grid-cols-2 gap-4, outline)
    │  │    Don't have an account? Sign up
    │  └─
    └─ footer: "By clicking continue, you agree to our Terms of Service and Privacy Policy."
       (text-muted-foreground text-center text-xs text-balance, links underlined, hover:text-primary)
```

#### 4.2.2 Component tree and key classes

```
AuthLayout: div.bg-muted.flex.min-h-svh.flex-col.items-center.justify-center.p-6.md:p-10
└─ div.w-full.max-w-sm.md:max-w-3xl
   └─ SignInView: div.flex.flex-col.gap-6
      ├─ Card.overflow-hidden.p-0
      │  └─ CardContent.grid.p-0.md:grid-cols-2
      │     ├─ form.p-6.md:p-8 > div.flex.flex-col.gap-6
      │     │   ├─ header: div.flex.flex-col.items-center.text-center (h1.text-2xl.font-bold + p.text-muted-foreground.text-balance)
      │     │   ├─ div.grid.gap-3 > InputField(email)      (label + input + message)
      │     │   ├─ div.grid.gap-3 > InputField(password, type=password)
      │     │   ├─ {error && Alert.bg-destructive/10.border-none > OctagonAlertIcon.h-4.w-4.!text-destructive + AlertTitle}
      │     │   ├─ Button[type=submit].w-full  disabled={pending}    "Sign in"
      │     │   ├─ divider: div.after:border-border.relative.text-center.text-sm.after:absolute.after:top-1/2.after:z-0.after:border-t
      │     │   │            > span.bg-card.text-muted-foreground.relative.z-10.px-2  "Or continue with"
      │     │   ├─ div.grid.grid-cols-2.gap-4 > 2 x Button[variant=outline].w-full (FaGoogle, FaGithub icons only)
      │     │   └─ div.text-center.text-sm  "Don't have an account? <Link /sign-up class="underline underline-offset-4">Sign up</Link>"
      │     └─ brand panel: div.bg-radial.from-sidebar-accent.to-sidebar.relative.hidden.md:flex.flex-col.gap-y-4.items-center.justify-center
      │          > img /logo.svg 92x92 + p.text-2xl.font-semibold.text-white "Meet.AI"
      └─ terms/privacy footnote
```

Behaviour visible in the design (not to be re-implemented): error is shown inline in the `Alert` (not a toast); the submit button is disabled while pending (label does not change); `?invitationId` is threaded so sign-in returns to the invitation and the "Sign up" link. Client validation via react-hook-form + zod (`email`, password required). Signed-in users are redirected away from the page.

### 4.3 Sign-up page

Identical shell, card, brand panel, divider, social row and footnote to §4.2. Differences:

- Heading "Let's get started" / subtext "Create an account to get started".
- Fields in order: **Name** (`John Doe`), **Email**, **Password**, **Confirm Password** (`********`), each in `div.grid.gap-3`. Validation: name required, valid email, password required, `confirmPassword` must match (error on the confirm field, "Passwords do not match").
- Submit label "Sign up". Footer link: "Already have an account? Sign in" -> sign-in page, preserving `invitationId`.
- On success it navigates to `/` (or the invitation page); the reference has no email-verification step.
- Social buttons render text labels ("Google", "Github") with no handler, inconsistent with sign-in (icons only). Treated as reference inconsistency; base-template renders one Google button with a visible label and no GitHub button (Q1).

### 4.4 Reference assets

| Asset                     | Reference path           | Use                | Action in base-template                                                                                |
| ------------------------- | ------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------ |
| Logo (SVG, 31x40 viewBox) | `public/logo.svg`        | Brand panel, 92x92 | **Not copied**: it belongs to the "Meet.AI" brand. base-template uses `apps/web/public/logo.png` (Q2). |
| Product name "Meet.AI"    | hard-coded in both views | Brand panel text   | Replace with the base-template name; not copied.                                                       |

base-template ships `apps/web/public/logo.png` (500x500 PNG) and the name `base-template` (`__root.tsx` title, `AuthenticatedShell` brand).

## 5. Current state vs gap

### 5.1 Verified current state (base-template)

- Router: **TanStack Router** file routes (`apps/web/src/routes`). `/login` renders `LoginPage` from `@/features/auth`. There is no `/sign-in` or `/sign-up` route (added by this spec, Q8); `LoginPage` holds local view state (`sign-in` | `sign-up` | `check-inbox`, default `sign-up`).
- Shell: `_auth/route.tsx` mounts `AuthenticatedShell` (`@/app/authenticated-shell`) for routes with `staticData.appShell`; it wires the presentational `shared/components/layout/app-shell.tsx` with `navGroups`, `brand`, `banner` (impersonation) and `headerActions` (`OrgSwitcher`, `ModeToggle`, `UserMenu`). Public/onboarding routes use `app/public-header.tsx`.
- Sidebar: `shared/components/layout/app-sidebar.tsx` renders flat groups (`SidebarGroup > SidebarMenu > SidebarMenuButton render={<Link/>}` with `isActive` from `isPathActive`), `<Sidebar>` defaults (`collapsible="offcanvas"`), no rail, no footer, brand as plain header text. Closes the mobile sheet on click.
- Header: `app-header.tsx`: sticky `h-12 border-b bg-background`, `SidebarTrigger`, separator, right-aligned actions. No breadcrumb.
- Org switcher / user menu: `features/organizations/components/org-switcher.tsx` and `features/auth/components/user-menu.tsx`: outline `Button` triggers in the header; `UserMenu` shows name, email, "Sign Out".
- Auth forms: `sign-in-form.tsx` / `sign-up-form.tsx`: centered `max-w-md p-6` plain form, TanStack Form, `Label` + `Input`, red text errors, toast for server errors, "link" button toggles view. Sign-up has name/email/password only (no confirmation), triggers `check-inbox`. Invitation sign-up is separate (`accept-invitation-sign-up.tsx`).
- `packages/ui` already contains: `sidebar` (supports `variant`, `collapsible` `offcanvas|icon|none`, `SidebarRail`, `SidebarMenuSub*`, `SidebarMenuAction`, `useSidebar().isMobile`), `breadcrumb`, `collapsible`, `card`, `field`, `input-group`, `input`, `label`, `alert`, `avatar`, `dropdown-menu`, `drawer`, `separator`, `skeleton`, `tooltip`, `sheet`, `button`, `spinner`, `empty`. Nothing new must be generated by the shadcn CLI.
- Style: `base-lyra` (sharp corners `rounded-none`, `text-xs` menu buttons), `--radius: 0.625rem`, `--font-sans: "Inter Variable"`, class-based dark mode with `defaultTheme="dark"`; sidebar tokens identical to the reference. Menu items use Base UI `render={...}` instead of Radix `asChild`. T0 replaces the shape, text size and fonts (decision 16); recent local a11y fixes on primitives (slider thumb labels, combobox button names, decorative item separator) exist and must survive it.
- Storybook lives in `packages/ui` and loads only its own stories; it has no `@/` alias or app CSS for `apps/web`.
- Import boundaries: primitives from `@base-template/ui/components/<name>`; `shared/**` may not import `@/features/**`; features export only via `index.ts`; feature-internal imports are relative.

### 5.2 Gap table

| #   | Area                 | Reference                                                                       | base-template today                                        | Gap                                                                                                                                                                                                                                                                                                                                        |
| --- | -------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G1  | Sidebar collapse     | `collapsible="icon"` + `SidebarRail`, tooltips on buttons                       | `offcanvas`, no rail                                       | Switch to icon mode, add rail and `tooltip` per item                                                                                                                                                                                                                                                                                       |
| G2  | Sidebar header       | Team switcher (`size="lg"` button, avatar tile, chevrons dropdown)              | Plain text brand                                           | New presentational switcher in header; org switcher moves out of the top bar                                                                                                                                                                                                                                                               |
| G3  | Sidebar footer       | User button (avatar, name, email, dropdown/drawer)                              | None (user menu in header)                                 | New footer user menu; header loses `UserMenu`                                                                                                                                                                                                                                                                                              |
| G4  | Nav                  | Collapsible parent items with sub-items and chevron                             | Flat groups, active highlight                              | `NavItem` gains optional `children`; render `Collapsible` + `SidebarMenuSub` with rotating chevron, parent open by default when a child route is active; RBAC `visible` applies to children, parent with no visible children hidden; keep active highlight, add tooltip and icon-collapsed behaviour; `getSectionItems` keeps working (Q4) |
| G5  | Header               | Borderless `h-16` (`h-12` collapsed), trigger + vertical separator + breadcrumb | Sticky `h-12 border-b bg-background`, actions on the right | Borderless `h-16` (`h-12` icon-collapsed), breadcrumb slot, content `p-4 pt-0` (Q5)                                                                                                                                                                                                                                                        |
| G6  | Auth layout          | `bg-muted` full-height, centered `max-w-sm md:max-w-3xl`                        | Root header + `max-w-md` card-less form                    | Pathless `_public-auth` layout route whose component is `AuthLayout`, without the public header (Q10)                                                                                                                                                                                                                                      |
| G7  | Auth card            | Split card, brand panel with radial gradient, terms footnote                    | Plain form                                                 | New `AuthCard` (form column + brand panel)                                                                                                                                                                                                                                                                                                 |
| G8  | Form controls        | Label/input/message, alert for server error, divider, confirm password          | Label/Input, toast errors, red text                        | Use `Field` primitives for fields/messages; inline destructive `Alert` above submit replaces the toast (Q6); confirm password (Q7)                                                                                                                                                                                                         |
| G9  | Social buttons       | Google / GitHub outline buttons (stubbed, no handler)                           | No providers                                               | Enable Google only in better-auth and wire a real button; the GitHub button is dropped (R5, §6.3)                                                                                                                                                                                                                                          |
| G10 | Sign-in/up switching | Separate routes + links                                                         | Single `/login` with in-component view state               | Split into `/sign-in` and `/sign-up`; `/login` redirects to `/sign-in` preserving search params; links styled `underline underline-offset-4` (Q8)                                                                                                                                                                                          |
| G11 | Brand                | Logo + name on the panel, sidebar accent gradient                               | `public/logo.png`, name `base-template`                    | Use base-template brand in the panel (Q2)                                                                                                                                                                                                                                                                                                  |
| G12 | Stories              | n/a                                                                             | 55 primitive stories, none for `shared/` components        | Extend Storybook to load `apps/web/src` stories (Q9)                                                                                                                                                                                                                                                                                       |
| G13 | Visual foundation    | `new-york`: rounded, `text-sm`, Geist                                           | `base-lyra`: sharp, `text-xs`, Inter                       | T0: adopt rounded shape, `text-sm`, Geist app-wide (Q16)                                                                                                                                                                                                                                                                                   |

## 6. Architecture / placement in base-template

Guiding rules: presentational components take props and live where they can be reused without importing features; containers (hooks: `authClient`, router) stay in the feature or in `apps/web/src/app`. `shared/**` must not import `@/features/**`.

### 6.1 Shell

| File                                                                               | Type           | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NavItem` type and `filterNavGroups` / `getSectionItems` (`shared/lib/navigation`) | pure logic     | `NavItem` gains optional `children: NavItem[]`. `filterNavGroups` applies `visible` to children and drops a parent with no visible children. `getSectionItems` keeps returning the same section tabs. Unit-tested (children filtering, parent hidden, `getSectionItems` unchanged).                                                                                                                                                                                                                                         |
| `shared/lib/navigation` `getBreadcrumbs(navGroups, pathname)` (new)                | pure logic     | Returns `{ label; to? }[]` (group > item > sub-item) for the active route. Unit-tested. No `staticData` labels, no loaders.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `shared/components/layout/app-sidebar.tsx`                                         | presentational | `<Sidebar collapsible="icon">`, `SidebarHeader` slot (`header`), `SidebarFooter` slot (`footer`), `SidebarRail`; nav items get `tooltip={item.label}`. Items with `children` render as `Collapsible` (`defaultOpen` when a child route is active) > `SidebarMenuButton` with rotating `ChevronRight` + `SidebarMenuSub`; items without children render as today. Keeps `isPathActive` / mobile close logic. New props: `header?: ReactNode`, `footer?: ReactNode`; `brand` retained as fallback when no `header` is passed. |
| `shared/components/layout/app-shell.tsx`                                           | presentational | Pass `header`/`footer` to `AppSidebar`; header takes `breadcrumb` slot (see below). `headerActions` shrinks to `ModeToggle` only. Content container `p-4 pt-0`.                                                                                                                                                                                                                                                                                                                                                             |
| `shared/components/layout/app-header.tsx`                                          | presentational | Borderless, transparent `h-16` (`h-12` when the sidebar is icon-collapsed, via `group-has-data-[collapsible=icon]/sidebar-wrapper:h-12`); `SidebarTrigger`, vertical separator, then `breadcrumb?: ReactNode`.                                                                                                                                                                                                                                                                                                              |
| `shared/components/layout/app-breadcrumbs.tsx` (new)                               | presentational | Renders `Breadcrumb` primitives from `items: { label; to? }[]`; earlier items `hidden md:block` like the reference; last is `BreadcrumbPage`. Links use `render={<Link/>}`.                                                                                                                                                                                                                                                                                                                                                 |
| `shared/components/layout/sidebar-org-switcher.tsx` (new)                          | presentational | The reference team switcher look: props `organizations: {id;name;logo?}[]`, `activeId`, `onSelect`, `isLoading`, optional `onAdd` (shown when creating organizations is allowed). Always rendered with the org name and menu, including with a single org. No `authClient` import.                                                                                                                                                                                                                                          |
| `shared/components/layout/sidebar-user-menu.tsx` (new)                             | presentational | The reference user button look: props `user: {name;email;image?}`, `onSignOut`, `extraItems?`. Uses `DropdownMenu` on desktop and `Drawer` when `useSidebar().isMobile` (reference uses `useIsMobile()`). Icon-collapsed: avatar only, click opens the same menu.                                                                                                                                                                                                                                                           |
| `features/organizations/components/org-switcher.tsx`                               | container      | Keeps `useListOrganizations`, `useActiveOrganization`, `setActive`, error toast. Renders `SidebarOrgSwitcher` via a `shared` import, passing the existing create-organization entry point as `onAdd` when allowed. **Import direction note:** a feature importing `@/shared/...` is allowed; `shared` must not import the feature.                                                                                                                                                                                          |
| `features/auth/components/user-menu.tsx`                                           | container      | Keeps `useSession`, `signOut` + navigate. Renders `SidebarUserMenu` when used in the shell; the existing outline-button variant stays for `PublicHeader` (see R1.9).                                                                                                                                                                                                                                                                                                                                                        |
| `app/authenticated-shell.tsx`                                                      | wiring         | Passes `header={<OrgSwitcher/>}`, `footer={<UserMenu/>}`, breadcrumb from `getBreadcrumbs(navGroups, pathname)` (R1.6), `headerActions={<ModeToggle/>}`.                                                                                                                                                                                                                                                                                                                                                                    |
| `app/public-header.tsx`                                                            | unchanged      | Public/onboarding routes keep the top header; auth routes skip it via `_public-auth` (Q10, §6.2).                                                                                                                                                                                                                                                                                                                                                                                                                           |

Missing shadcn primitives: none (T0 may regenerate existing ones, see §6.4). Every primitive named above already exists in `packages/ui/src/components` (verified: sidebar, breadcrumb, collapsible, drawer, dropdown-menu, avatar, skeleton, tooltip, separator, card, field, alert, button, input).

Initials avatar: the reference uses DiceBear (`@dicebear/core` + `collection`). base-template has no equivalent; use the existing `Avatar` primitive with `AvatarFallback` initials (pure function `getInitials(name)` in `shared/lib`, unit-tested). DiceBear is not added (Q11).

### 6.2 Auth pages

| File                                                                      | Type           | Change                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/auth/components/auth-card.tsx` (new)                            | presentational | Split card: `Card overflow-hidden p-0` + `CardContent grid p-0 md:grid-cols-2`, `children` = form column (`p-6 md:p-8`), `panel` slot = brand panel; footnote slot.                                                                                                                                                                                                                                                         |
| `features/auth/components/auth-brand-panel.tsx` (new)                     | presentational | `bg-radial from-sidebar-accent to-sidebar hidden md:flex flex-col items-center justify-center gap-y-4`, logo image and name via props.                                                                                                                                                                                                                                                                                      |
| `features/auth/components/auth-layout.tsx` (new)                          | presentational | `bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10` + `w-full max-w-sm md:max-w-3xl`; renders `children`/`Outlet`.                                                                                                                                                                                                                                                                                   |
| `features/auth/components/sign-in-form.tsx`, `sign-up-form.tsx`           | container      | Keep TanStack Form, validators, `authClient` calls and callbacks; replace markup with `Field`/`FieldGroup`-based layout inside `AuthCard`. Server errors render in an inline destructive `Alert` above the submit button (no toast). Sign-up adds Confirm Password (form-only validation). Switching links navigate to `/sign-up` / `/sign-in` (preserving `invitationId` and redirect params) instead of local view state. |
| `features/auth/components/login-page.tsx`                                 | container      | Its view-switching role ends: replaced by `SignInPage` and `SignUpPage` containers exported from `@/features/auth`. `check-inbox` is a state of `SignUpPage` or its own route (decided in T5); it renders inside `AuthCard` with the brand panel.                                                                                                                                                                           |
| verify-email and accept-invitation pages, `accept-invitation-sign-up.tsx` | container      | Render inside `AuthCard` with the brand panel; behaviour unchanged.                                                                                                                                                                                                                                                                                                                                                         |
| `routes/_public-auth/route.tsx` (new)                                     | route          | Pathless layout route (the equivalent of the reference `(auth)` group) whose component is `AuthLayout`; hosts `sign-in`, `sign-up` and the check-inbox/verify-email/invitation auth screens. These routes therefore skip `PublicHeader`; no `staticData` flag.                                                                                                                                                              |
| `routes/login.tsx`                                                        | route          | `beforeLoad` redirects to `/sign-in` preserving search params.                                                                                                                                                                                                                                                                                                                                                              |
| `routes/__root.tsx` and other public routes                               | route          | `PublicHeader` must not render for `_public-auth` routes; how the remaining public/onboarding routes keep it is decided in T5 (see §11).                                                                                                                                                                                                                                                                                    |
| Redirects to `/login`                                                     | wiring         | Route guards, verify-email, invitation pages and sign-out now target `/sign-in`; each covered by tests (R2.8).                                                                                                                                                                                                                                                                                                              |
| `apps/web/public/logo.png`                                                | asset          | Existing brand logo, used by the brand panel.                                                                                                                                                                                                                                                                                                                                                                               |

Placement follows `frontend-foundation.md` §4.4: presentational components stay in `features/auth/components`, imports inside the feature are relative, the routes import only `@/features/auth`.

### 6.3 Social sign-in (Google)

| File                                                                    | Type           | Change                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/auth/src/index.ts` (`createAuth`)                             | server config  | Add `socialProviders.google`, registered **only** when both its client ID and secret are present. Account-linking policy per R5.4.                                                                                                                             |
| env schema (`packages/infra/.env.schema` and the server env loader)     | config         | Optional `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (server-only, never exposed to the web bundle). Only one of the two set fails at startup.                                                                                                                  |
| Enabled-provider endpoint (server)                                      | API            | A public, unauthenticated server endpoint (e.g. `GET /api/public/auth-providers`, final path fixed in T6) returns only provider ids, e.g. `{ "providers": ["google"] }`, derived from the server credentials (single source of truth, no rebuild, no secrets). |
| Enabled-provider query (web)                                            | container      | The auth forms fetch the endpoint with TanStack Query; the Google button is hidden while loading and on fetch failure.                                                                                                                                         |
| `features/auth/components/social-sign-in-buttons.tsx` (new)             | presentational | Divider "Or continue with" + one full-width outline button (Google icon + visible label "Continue with Google"), props `providers`, `onSelect(provider)`, `pendingProvider` (the list shape keeps adding a provider later cheap). Story included.              |
| `sign-in-form.tsx`, `sign-up-form.tsx`, `accept-invitation-sign-up.tsx` | container      | Call `authClient.signIn.social({ provider, callbackURL, errorCallbackURL })`; render the row only for enabled providers. Invitation sign-up uses the invitation page as `callbackURL` and is subject to the email-match rule (R5.5).                           |
| Provider icon                                                           | asset          | Google mark as an inline SVG component (no new icon package unless the existing icon set already ships them).                                                                                                                                                  |

OAuth app setup (Google Cloud console, redirect URI `<server-origin>/api/auth/callback/<provider>`) is documented in the README; client credentials are supplied by the operator and never committed.

### 6.4 Visual foundation (T0)

Decision 16 adopts the full reference look: reference radius (rounded corners), `text-sm` controls and menu buttons, Geist Sans/Mono. Radix is not adopted.

- **Mechanism (decided and recorded in T0):** either switch the shadcn Base UI style from `base-lyra` to the rounded Base UI style closest to `new-york` and regenerate the primitives, or keep `base-lyra` and override tokens/classes. T0 first verifies which Base UI styles the shadcn CLI offers.
- Update theme tokens (`--radius`, `--font-sans`, `--font-mono`) in `packages/ui/src/styles/globals.css`, load Geist fonts, keep dark as default.
- **Risk:** regenerating primitives can overwrite local fixes (slider thumb labels, combobox button names, decorative item separator without `aria-orientation`, grouped items as `listitem`). T0 re-applies and verifies each one.
- Re-check every Storybook story and the a11y panel after the change; update primitive stories where the look changes.

## 7. Requirements

### R1 — Sidebar / app shell

**R1.1 Icon-collapsible sidebar**

- GIVEN the authenticated shell on a desktop viewport
- WHEN the user toggles the trigger, the rail, or presses the shortcut
- THEN the sidebar collapses to icon width (`collapsible="icon"`), labels and sub-content are hidden, each menu button shows a tooltip with its label, and the header row height reduces as in the reference.

**R1.2 Mobile sheet**

- GIVEN a viewport below the `md` breakpoint
- THEN the sidebar is an off-canvas sheet opened by `SidebarTrigger`, and it closes after choosing a nav item (existing behaviour preserved).

**R1.3 Header slot**

- GIVEN any shell route
- THEN the sidebar header shows the organization switcher: `size="lg"` menu button with `size-8` initials tile, org name (truncated), `ChevronsUpDown`; dropdown opens to the right on desktop and below on mobile, listing "Organizations" with one item per org (current marked) and, when the user may create organizations, the existing create-organization entry point.
- AND selecting an organization calls the existing `authClient.organization.setActive` and shows the existing error toast on failure (behaviour of R1.3 in `auth-multitenant-rbac.md` unchanged).
- WHILE loading it shows a `Skeleton` of the button height. WHEN the user has no organizations it renders nothing (such users are sent to onboarding). WHEN exactly one exists it is still shown with the org name and the menu (Q12); the reference hides it, which would drop the org context, so org context never disappears.

**R1.4 Nav content and RBAC**

- THEN groups and items are rendered from `navGroups` filtered by `filterNavGroups`; visibility (`isSuperadmin`) and active-route highlighting (`isPathActive`) behave as today. No demo items from the reference are added.
- AND `NavItem` may have `children`: such an item renders as a `Collapsible` parent (`SidebarMenuButton` with rotating chevron, `SidebarMenuSub` sub-items), open by default when a child route is active. `visible` predicates apply to children; a parent with no visible children is hidden. `getSectionItems` continues to work from the same config (Q4).
- AND group labels use the reference `SidebarGroupLabel` styling and fade in icon-collapsed mode.

**R1.5 Footer user menu**

- GIVEN a signed-in session
- THEN the sidebar footer shows the user's avatar (image or initials fallback), name and email (truncated), and a chevron; the menu shows a label block (name, email), a separator and **Sign out** (destructive). Sign out keeps the current behaviour (`authClient.signOut`, navigate to `/`).
- AND on mobile the menu is a bottom `Drawer`; on desktop a dropdown opening to the right.
- AND in icon-collapsed mode only the avatar is shown; clicking it opens the same menu (Q3).
- WHILE the session is pending it shows a skeleton; with no session it renders nothing in the footer.
- No "Billing" item is added (no such feature exists).

**R1.6 Header breadcrumb**

- THEN the header is borderless and transparent, `h-16` (`h-12` when icon-collapsed), and shows `SidebarTrigger`, a vertical separator (`h-4`) and a breadcrumb for the active route. Earlier crumbs are hidden below `md`; the last crumb is `BreadcrumbPage`.
- The crumbs come from the pure function `getBreadcrumbs(navGroups, pathname)` (group > item > sub-item); no `staticData` labels and no loaders (Q13).

**R1.7 Header actions**

- THEN the header's right side keeps `ModeToggle`; the impersonation banner remains rendered above the header as today.

**R1.8 Content area**

- THEN `SidebarInset` children render in a container with the reference paddings (`p-4 pt-0`) under the borderless header and pages keep their own headers (`PageHeader`).

**R1.9 Public/onboarding header**

- THEN routes without the shell that are not auth screens (e.g. onboarding) keep `PublicHeader` with the current `OrgSwitcher`/`UserMenu` header variants; only the shell variants change. Auth screens (sign-in, sign-up, check-inbox, verify-email, accept-invitation) use `AuthLayout` without `PublicHeader`.

### R2 — Sign-in

**R2.1 Layout** — GIVEN `/sign-in`, THEN the page uses `AuthLayout` (muted full-height background, centered `max-w-sm` / `md:max-w-3xl`), with `AuthCard`: two columns from `md`, single column below, brand panel hidden below `md`.

**R2.2 Header** — the form column starts with a centered `h1` `text-2xl font-bold` ("Welcome back") and a `text-muted-foreground text-balance` subtitle.

**R2.3 Fields** — Email and Password use `Field`, `FieldLabel`, `Input` and `FieldError` (or the existing `FormField` in `shared/components/form`), stacked with `gap-6` between blocks and `gap-3` inside. Validation rules and messages stay those of the current TanStack Form validators (`z.email`, password min 8).

**R2.4 Submit and errors** — full-width primary button, disabled while `!canSubmit || isSubmitting`. Server errors (including Google errors) render in an inline destructive `Alert` (icon + message) above the submit button, replacing the toast (Q6). No change to which endpoint is called or the post-login navigation (`/dashboard`).

**R2.5 Divider and social row** — the "Or continue with" divider and the Google button render below the submit button when Google is enabled (R5). Otherwise both are omitted and the layout has no empty gap.

**R2.6 Switch link** — bottom line "Don't have an account? Sign up" with an underlined text link (`underline underline-offset-4`) to `/sign-up`, preserving `invitationId`/redirect params.

**R2.7 Footnote** — the reference terms/privacy footnote is omitted; no such pages exist (Q14).

**R2.8 Brand panel and redirects** — radial gradient `from-sidebar-accent to-sidebar`, `apps/web/public/logo.png` and the name `base-template` centered (Q2). `/login` redirects to `/sign-in` preserving search params, and every existing redirect to `/login` (route guards, verify-email, invitation pages, sign-out) targets `/sign-in`; each is covered by tests (Q8).

### R3 — Sign-up

**R3.1** Served at `/sign-up`; same layout, card, panel, divider rule and footnote rule as R2.1, R2.5, R2.7, R2.8.
**R3.2** Heading "Let's get started" (or equivalent copy) with the muted subtitle.
**R3.3** Fields in order: Name, Email, Password, Confirm Password. Existing validators are kept; a mismatch shows "Passwords do not match" on the Confirm Password field. The check is form-only; the server call is unchanged (Q7).
**R3.4** Submit "Sign up", disabled while submitting. On success the existing behaviour is unchanged: toast, then the `check-inbox` screen (email verification required).
**R3.5** Bottom link "Already have an account? Sign in" navigates to `/sign-in`, preserving `invitationId`/redirect params. Server errors render as in R2.4.
**R3.6** The `check-inbox` screen (a state of `/sign-up` or its own route, decided in T5), verify-email and the accept-invitation pages, including invitation sign-up, render inside the full `AuthCard` with the brand panel, without behavioural change (Q15).

### R4 — Cross-cutting

**R4.1 Deliberate behaviour changes; everything else preserved** — The only intended behaviour changes are: (a) Google sign-in/sign-up, including on invitation sign-up (R5); (b) the route split into `/sign-in` and `/sign-up` with `/login` redirecting and all redirects updated (R2.8); (c) Confirm Password on sign-up (R3.3); (d) server errors as inline `Alert` instead of toast (R2.4). Everything else is unchanged: other `authClient` calls, callbacks (`callbackURL`, `/verify-email`), the logic of route guards, `navGroups` visibility semantics, `CanGate`, invitation flows. Existing tests in `features/auth`, `shared/lib/navigation`, `app/navigation` keep passing, updated only where the route rename or a change above requires it.

**R4.2 Look, dark and light mode** — The full reference look applies app-wide (T0): reference radius, `text-sm` controls and menu buttons, Geist Sans/Mono (§6.4). All new components use semantic tokens only (`bg-muted`, `bg-card`, `text-muted-foreground`, `sidebar-*`); no hard-coded `bg-white/5`, `text-white` or hex colours (the reference's `bg-white/5 hover:bg-white/10` user button and `text-white` panel text are replaced by tokens). Both themes are checked; default stays dark. Local a11y fixes on primitives survive T0.

**R4.3 Responsive** — Verified at 375px, 768px and 1280px: single-column auth card below `md`; shell sidebar as a sheet below `md`; no horizontal scroll; long org/user names truncate.

**R4.4 Accessibility** — Sidebar rail and trigger have accessible names; icon-only buttons (collapsed sidebar and collapsed footer avatar) have `aria-label`/tooltips; form errors are associated with inputs (`aria-invalid`, `aria-describedby` via `Field`); the brand image has alt text (`alt=""` when decorative next to the visible name); focus order follows visual order; the `Drawer`/dropdown return focus to the trigger.

**R4.5 Stories** — Each new presentational component gets a co-located story (CSF3, `tags: ["autodocs"]`, light/dark via the global theme decorator): `AuthCard`, `AuthBrandPanel`, `AuthLayout`, `SidebarOrgSwitcher`, `SidebarUserMenu`, `AppBreadcrumbs`, and `AppSidebar`/`AppShell` composed in `SidebarProvider` with a collapsed story. Storybook (in `packages/ui`) is extended to also load stories from `apps/web/src` (shared and features), which requires the `@/` alias and the app CSS in the Storybook config. This amends the out-of-scope item of `storybook.md` about `apps/web`; the coverage test is extended accordingly (Q9).

**R4.6 Tests** — Pure logic extracted and unit-tested with `bun test`: `getInitials`, `getBreadcrumbs`, `filterNavGroups` with `children` (visible children kept, parent hidden when none visible), `getSectionItems` unchanged, and redirect targets for `/login`, guards, verify-email, invitation pages and sign-out. UI markup follows the repo's ordinary checks (`pnpm check-types`, `pnpm lint`, `pnpm build`) plus a manual smoke of `/sign-in`, `/sign-up`, `/login` (redirect with params), `/dashboard`, `/settings/*`, `/admin/*`, `/onboarding`, `/accept-invitation/$id`.

**R4.7 Boundaries** — `packages/ui` changes only through T0 (visual foundation) and the Storybook config; `shared/**` imports no feature; features import each other only via `index.ts`.

### R5 — Social sign-in (Google)

**R5.1 Configuration** — GIVEN both credentials for a provider are set, THEN better-auth registers that provider; GIVEN neither is set, THEN it is not registered and its button is not shown; GIVEN only one of the pair is set, THEN the server fails at startup with a message naming the missing variable. Secrets are server-only. The web app learns which providers are enabled from the public enabled-providers endpoint (§6.3), which returns only provider ids; the button is hidden while loading and when the fetch fails (decision 17).

**R5.2 Sign-in / sign-up** — WHEN the user clicks the Google button on sign-in, sign-up or invitation sign-up, THEN the app calls `authClient.signIn.social` for that provider and redirects to it; on success the user lands on `/dashboard` (same destination as email sign-in; onboarding redirection for users without an organization is unchanged). The same button creates the account on first use.

**R5.3 Pending and errors** — WHILE a redirect is in progress all auth buttons are disabled and the clicked one shows a spinner. WHEN the provider returns an error or the user cancels, THEN the originating page shows the error in the inline destructive `Alert` (Q6) and the form stays usable.

**R5.4 Account linking and email trust** — A social sign-in whose email matches an existing email/password account links to it **only** when the provider reports the email as verified; otherwise it is rejected with a clear error. Unverified provider emails never bypass `requireEmailVerification`. The exact better-auth `account.accountLinking` settings (`enabled`, `trustedProviders`) are verified against the installed better-auth version during T6 and recorded in the task notes.

**R5.5 Invitations** — Social sign-in never accepts an invitation implicitly. Accepting still goes through `/accept-invitation/$id`, whose recipient-email check (`auth-multitenant-rbac.md` R2.5) applies to socially-signed-in users unchanged. The invitation sign-up page also offers "Continue with Google" (Q18): it is allowed only when Google's verified email equals the invited email; otherwise the user sees an error, **no account is created** and the invitation is untouched.

**R5.6 Tests** — Integration tests cover: Google registration from env (configured, absent, half-configured); linking a verified-email social account to an existing user; rejecting an unverified-email link; invitation recipient mismatch for a social user; invitation sign-up with Google rejected on email mismatch (no user created, invitation untouched) and accepted on match. Provider HTTP calls are mocked; no real OAuth app is required to run tests.

## 8. Acceptance criteria

1. `/sign-in` and `/sign-up` show the split card; `/login` redirects to `/sign-in` preserving search params; below `md` only the form column shows. check-inbox, verify-email and accept-invitation screens use the same card.
2. The authenticated shell has an icon-collapsible sidebar with rail, collapsible nav parents with sub-items (RBAC applied to children), org switcher in the header (also with a single org), user menu in the footer, a borderless breadcrumb header, and RBAC-filtered nav equivalent to today's.
3. Apart from the deliberate changes in R4.1 (Google, route split, confirm password, inline alert errors), sign-in, sign-up (with email verification and check-inbox), invitation acceptance, org switching and sign-out behave as before; existing tests pass (updated only for the route rename), redirect tests cover every former `/login` target, and the manual smoke is checked. Google on invitation sign-up rejects an email mismatch.
4. Light and dark modes both render without hard-coded colours; the app and primitives show the reference look (rounded, `text-sm`, Geist) and the earlier primitive a11y fixes still hold.
5. Every new presentational component has a story, loaded by Storybook from `apps/web/src`; all existing stories still render; `pnpm build-storybook`, `pnpm check-types`, `pnpm lint`, `pnpm test` succeed.
6. No demo content, terms footnote or Meet.AI branding from the reference is present in the app.

## 9. Tasks

Each task ends with a work-unit commit; tasks are sliced independently (see delivery note).

| ID  | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Checks                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T0  | **Visual foundation** (before shell/auth tasks): verify which Base UI styles shadcn offers; choose and record the mechanism (switch from `base-lyra` to the rounded Base UI style closest to `new-york` and regenerate primitives, or override tokens/classes); update `--radius`, Geist fonts, `text-sm` controls; keep dark default; re-apply and verify local primitive a11y fixes (slider thumbs, combobox buttons, item separator); re-check all stories.                       | `build`, `check-types`, `lint`, `test`, all stories in light/dark, a11y panel, manual look of existing pages                                                                 |
| T1  | **Storybook for `apps/web`**: extend Storybook config in `packages/ui` to load `apps/web/src` stories, add `@/` alias and app CSS, extend the coverage test; note the amendment in `storybook.md`.                                                                                                                                                                                                                                                                                   | `build-storybook`, coverage test, a sample story renders                                                                                                                     |
| T2  | **Shell primitives and nav logic**: `NavItem.children`, `filterNavGroups`/`getSectionItems` support, `getBreadcrumbs`, `getInitials`, `SidebarOrgSwitcher`, `SidebarUserMenu`, `AppBreadcrumbs`, stories.                                                                                                                                                                                                                                                                            | `bun test` (children filtering, `getSectionItems`, `getBreadcrumbs`, `getInitials`), `check-types`, `lint`, stories in light/dark                                            |
| T3  | **Shell wiring**: `AppSidebar` (`collapsible="icon"`, header/footer/rail/tooltips, collapsible parents), `AppShell`/`AppHeader` (borderless `h-16`/`h-12`, `p-4 pt-0`), `AuthenticatedShell` wiring, container changes in `OrgSwitcher`/`UserMenu`.                                                                                                                                                                                                                                  | Existing navigation tests, manual smoke of shell routes (desktop collapsed/expanded, mobile), superadmin vs member nav                                                       |
| T4  | **Auth layout and card**: `AuthLayout`, `AuthCard`, `AuthBrandPanel` + stories with `logo.png`.                                                                                                                                                                                                                                                                                                                                                                                      | Stories, manual smoke at 375/768/1280                                                                                                                                        |
| T5  | **Routes and forms**: `_public-auth` pathless layout route, `/sign-in` and `/sign-up` routes, `/login` redirect preserving params, update all redirects to `/login` (guards, verify-email, invitation pages, sign-out) with tests, restyle forms with `Field` primitives, inline `Alert` errors, Confirm Password, check-inbox (state or own route, decided here), verify-email and accept-invitation screens in `AuthCard`, decide how remaining public routes keep `PublicHeader`. | Existing auth tests (updated for the rename), redirect tests, manual flows: sign-up -> check-inbox -> resend -> verify -> sign-in; invitation sign-up; `/login?...` redirect |
| T6  | **Social sign-in**: env schema, `socialProviders` in `createAuth`, account-linking policy, public enabled-providers endpoint and web query, `SocialSignInButtons` + story, wiring in sign-in, sign-up and invitation sign-up, invitation email-match enforcement, README OAuth setup.                                                                                                                                                                                                | R5.6 integration tests, `check-types`, `lint`, manual Google round trip with real dev credentials                                                                            |
| T7  | **Cross-cutting pass**: dark/light audit, a11y check (`addon-a11y` on stories, keyboard walk-through), README note on the new components.                                                                                                                                                                                                                                                                                                                                            | Storybook a11y panel clean or annotated, `build`, `check-types`, `lint`, `test`                                                                                              |

Delivery: T0 (regenerating primitives and their stories) plus the shell, auth and social work likely push the total above 800 authored changed lines; slicing per task applies, with a chain strategy chosen under `ask-on-risk` once the running count exceeds about 400.

## 10. Decisions

All questions were answered by the user on 2026-09-30.

1. Social sign-in: Google only, GitHub not adopted (§6.3, R5, T6).
2. Brand: `apps/web/public/logo.png` and the name "base-template"; reference `logo.svg` not copied (§4.4, R2.8, T4).
3. Icon-collapsed footer: avatar only, click opens the same menu (§6.1, R1.5).
4. Nav: collapsible parents with sub-items via optional `NavItem.children`, RBAC applied to children, empty parents hidden, `getSectionItems` preserved (G4, §6.1, R1.4, R4.6, T2, T3).
5. Header: borderless `h-16` (`h-12` icon-collapsed), trigger + separator + breadcrumb, content `p-4 pt-0` (G5, §6.1, R1.6, R1.8, T3).
6. Server errors (including Google) shown as an inline destructive `Alert` above submit, replacing the toast (G8, §6.2, R2.4, R5.3, T5).
7. Sign-up adds Confirm Password with "Passwords do not match", form-only validation (G8, R3.3, T5).
8. Routes split into `/sign-in` and `/sign-up`; `/login` redirects preserving search params; all redirects updated and tested; check-inbox state or route decided in T5 (G10, §6.2, R2.8, R3.6, R4.6, T5).
9. Storybook in `packages/ui` also loads `apps/web/src` stories, amending `storybook.md` (G12, R4.5, T1).
10. Auth pages skip `PublicHeader` via the pathless `_public-auth` layout route with `AuthLayout`; no `staticData` flag (G6, §6.2, R1.9, T5).
11. Avatar: initials via `Avatar` + `getInitials`, no DiceBear (§6.1, T2).
12. Single org: switcher always shown with org name and menu (orgs listed with current marked, create entry point when allowed) (§6.1, R1.3, T3).
13. Breadcrumb derived from `navGroups` by the pure, unit-tested `getBreadcrumbs`; no `staticData` labels or loaders (§6.1, R1.6, R4.6, T2).
14. Terms/privacy footnote omitted (§2, R2.7).
15. check-inbox, verify-email and accept-invitation (including invitation sign-up) use the full `AuthCard` with the brand panel, behaviour unchanged (§6.2, R3.6, T5).
16. Full reference look adopted (rounded reference radius, `text-sm`, Geist); Radix not adopted; mechanism chosen in T0, with re-application of local primitive a11y fixes (§6.4, G13, R4.2, T0).
17. The web learns whether Google is enabled from a public server endpoint returning only provider ids; the button is hidden on fetch failure (§6.3, R5.1, T6).
18. Invitation sign-up also offers Google, allowed only when Google's verified email equals the invited email; otherwise error, no account created, invitation untouched (§6.3, R5.5, R5.6, T6).

## 11. Resolved follow-ups

1. **Invitation email-match enforcement across the OAuth round trip.** **Resolved (2026-09-30):** a server-side hook in `packages/auth` is accepted (e.g. better-auth `databaseHooks.user.create.before`). It rejects user creation when the invitation's email differs from Google's verified email, and the invitation id is carried through the OAuth round trip (state or callback parameter). The exact mechanism is verified against the installed better-auth version in T6 and covered by the R5.6 tests.
2. **`PublicHeader` placement.** **Resolved (2026-09-30):** the other public/onboarding routes move under their own pathless layout route that renders `PublicHeader`; `__root.tsx` no longer renders it. The exact route-tree restructuring is done in T5 and covered by the manual smoke list.

## 12. Implementation notes

Implementation decisions and verified facts are recorded per task in `odd/tasks/dashboard-shell-and-auth-ui.md` (T0 to T7 decision records). Highlights:

- **check-inbox** is a state of `/sign-up`, not its own route (T5).
- **Nav grouping**: "Organization" holds a collapsible "Settings" parent and "Platform" (superadmin only) a collapsible "Admin" parent; group ids and tab output are unchanged (T3).
- **Style**: `base-vega` (closest to the reference look), all primitives regenerated (T0).
- **better-auth facts** verified against 1.7.5: flat client error shape, account-linking rules, invitation id carried through the OAuth state, `databaseHooks.user.create.before` for the email match (T6).
- **Error messages**: only better-fetch error objects are read; thrown `Error`s keep each caller's own fallback (T7).
- Pending manual smoke items are listed at the end of the feature document.
