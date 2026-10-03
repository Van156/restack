# PRD: Restaurant management MVP

Status: draft for hand-off to spec and ticket breakdown. Decisions of record come from the planning tickets under `.scratch/restaurant-management/` (not committed); research is cited from the `research/*` branches. Vocabulary follows [`GLOSSARY.md`](../../GLOSSARY.md).

## 1. Summary

| Item          | Decision                                                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Problem       | Small Colombian Restaurants must issue DIAN electronic documents on every sale, face a margin squeeze, and are served by POS products that meter documents, price per register and mostly need internet.                 |
| Customer      | Small independent Restaurants (corrientazos, sit-down, cafés) with 1-3 Locations. Chains of 5+ Locations are out of scope.                                                                                               |
| MVP promise   | One offline-tolerant web app (PWA) that takes orders on the floor, sends Tickets to the kitchen, charges with the legal tip, issues the DIAN document, and closes the Cash shift, with unlimited DIAN documents bundled. |
| Plans         | Per Location per month: Esencial COP 49.900 (no DIAN) and Completo COP 89.900 (DIAN included, fair use 5.000 documents), both plus IVA. 30-day trial without card.                                                       |
| North star    | Weekly Active Locations (a Location that closed a Cash shift on 5 or more days of the week).                                                                                                                             |
| Business goal | 50 paying Locations 6 months after launch, self-serve, no sales team.                                                                                                                                                    |
| Devices       | Waiters on phones, Cashier on PC or tablet, kitchen display as a Paired device.                                                                                                                                          |
| Tenancy       | Restaurant = Organization in the existing multi-tenant RBAC; Location = branch inside it.                                                                                                                                |

Reading path: sections 5 (features) and 6 (roles) define behaviour; 7 (offline) and 8 (plans) constrain it; 11 and 12 list what is not yet known.

## 2. Problem and evidence

Evidence strength: strong = primary or statistical source; medium = trade body or vendor-published; weak = single anecdote or inferred.

| Pain                                                                                                                                               | Evidence                                                                    | Implication for the MVP                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| DIAN electronic invoicing is mandatory regardless of size; DIAN closed 35 Bogotá establishments in 2024                                            | Strong (primary and press)                                                  | DIAN invoicing is feature 1.                                                         |
| Margin squeeze: costs 87% of revenue in 2025, 109% projected for 2026; food cost 35% to 43% (Acodrés Bogotá)                                       | Medium (trade body, lobbying source)                                        | Cost per Menu item and margin in the daily report.                                   |
| Target is a small formal minority: DANE 2019 counts 486,574 food-service micro-businesses, 79% without RUT, 84% unregistered, 86% without internet | Strong for DANE 2019, dated; trade-body counts (107k-550k) are inconsistent | Addressable market is smaller than raw counts; no reliable POS-adoption share found. |
| Delivery aggregator commissions (Rappi 25-30%) and manual re-keying                                                                                | Weak (vendor-evidenced)                                                     | Deferred to Later.                                                                   |
| Reliability, offline and peak-hour support                                                                                                         | Weak (one Capterra review; only Vendty advertises offline)                  | Offline is a design bet, flagged as thinly evidenced.                                |
| Adoption and abandonment drivers                                                                                                                   | Weak (inferred; app-store data mostly unreachable)                          | Metrics in section 9 are starting points.                                            |

Market and competitor findings (COP per month, list prices, some extracted automatically and needing a live recheck):

| Product             | Price range                                                  | DIAN POS document              | Offline           |
| ------------------- | ------------------------------------------------------------ | ------------------------------ | ----------------- |
| Fudo                | 62,900-144,900                                               | Yes; invoice add-on from 9,000 | Not stated        |
| Siigo POS GastroBar | 74,995-241,290 (annual)                                      | Covered by product             | Not stated        |
| Loggro Restobar     | 120,990-219,990 (+43,990 per extra register); 30-invoice cap | Yes                            | Claimed           |
| Alegra POS          | 19,425-149,925 (annual)                                      | Yes                            | Claimed           |
| Treinta             | 39,900-79,900                                                | Generic retail POS             | Requires internet |
| Bold POS            | from 91,500 (possibly outdated)                              | Generic retail POS             | Not stated        |

Gaps the MVP targets: nobody prices per Location; the DIAN POS document is table stakes but metered; entry tiers are thin (missing recipes, e-invoicing or restaurant workflow); only Loggro and Alegra claim offline. Toteat publishes no Colombian price and Poster lacks verified DIAN support.

References: `competitors` (`.scratch/restaurant-management/issues/03-competitors-and-pricing.md`) and `pain points` (`.scratch/restaurant-management/issues/04-small-restaurant-pain-points.md`) tickets; research `docs/research/competitors.md` and `docs/research/pain-points.md` (section 13).

## 3. Target customer and scope

In scope: self-serve SaaS for small independent Restaurants with 1-3 Locations, sold per Location, delivered as an offline-tolerant PWA. Desk research only: no owner interviews were possible.

Out of scope for the MVP:

- Native mobile apps (PWA chosen).
- Chains with 5 or more Locations.
- An in-house DIAN e-invoicing engine (a certified provider is used).
- Everything listed in section 10 (Later).

## 4. Glossary

The full glossary is [`GLOSSARY.md`](../../GLOSSARY.md); this PRD uses its terms exactly.

| Term                                | Meaning                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| Restaurant                          | The subscribing business; one tenant (Organization).                              |
| Location                            | A physical branch of a Restaurant.                                                |
| Area, Table                         | Named part of a Location; place where a party is seated.                          |
| Station                             | Preparation point receiving Tickets for the Menu items routed to it.              |
| Menu item                           | Something sold, with price, modifiers and a Station.                              |
| Staff member, Role                  | A person with one Role and a list of Locations; the set of permitted actions.     |
| Paired device                       | A screen bound to a Location (and Stations), activated once with a code.          |
| Override                            | An Administrator PIN authorization for a sensitive action, audit-logged.          |
| Ticket, Bill                        | Part of an order sent to one Station; what a Table owes.                          |
| Cash shift                          | Period from opening to cash close for one Location.                               |
| Table session, Waiter call          | Period from opening a Table to settling its Bill; a guest's request for a Waiter. |
| Tip beneficiary                     | A person in the service chain who receives a share of a Cash shift's tips.        |
| Active Location, Activated Location | Product-health terms defined in section 9.                                        |
| Plan                                | Esencial or Completo, paid per Location per month.                                |

## 5. MVP features in rank order

Cross-cutting rules apply to every feature:

- Menu prices include the 8% impoconsumo; base and tax are derived (price / 1.08).
- The tip is a separate line outside the tax base.
- Each Menu item has a tax class; franchise Locations charge IVA 19% instead of impoconsumo.
- Sensitive actions follow the Override rules in section 6.
- Offline behaviour follows section 7.

### 5.1 DIAN invoicing (rank 1)

User value: legal compliance on every sale without a separate invoicing tool or per-document fees.

Functional requirements:

- FR-1.1 Setup asks "¿Tu negocio debe facturar electrónicamente?" and explains the exemption: natural person, one establishment, no franchise, prior-year income below 3,500 UVT, not responsible for IVA or impoconsumo.
- FR-1.2 Only the Owner can set the DIAN choice; the decision and its author are recorded in the audit log. The app explains and records; it does not verify eligibility.
- FR-1.3 With DIAN on, each sale issues by default the electronic POS equivalent document (documento equivalente electrónico tiquete POS) through the provider adapter.
- FR-1.4 On request, the Cashier issues a full factura electrónica with buyer identification; a customer can always demand it.
- FR-1.5 Buyer identification is captured at the till; "consumidor final" is allowed and the UI states it gives the buyer no deduction.
- FR-1.6 Impoconsumo 8% is a separate setting from the DIAN choice and is itemized on the ticket.
- FR-1.7 With DIAN off, the app issues a simple receipt marked "Este documento no es una factura electrónica".
- FR-1.8 While DIAN is off, settings show a quiet reminder; the Owner can enable DIAN at any time.
- FR-1.9 A DIAN habilitación wizard guides each Restaurant through portal registration, provider selection, POS numbering resolution request and prefix association, and the provider test set (details are open, section 12).
- FR-1.10 Documents are issued through one certified provider behind an adapter; Alegra first, Dataico as fallback.
- FR-1.11 Each Restaurant uses its own provider company (associated company with its own token) and its own numbering range.
- FR-1.12 Documents are idempotent: a retry never issues a second document for the same Bill.

Key rules:

| Rule                                                                                          | Source                                    |
| --------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Paper POS tickets are invalid since 2024-07-01; the electronic POS document has no value cap. | Res. 165/2023                             |
| Impoconsumo 8% applies to the whole consumption, tip excluded, included in the price list.    | DIAN invoicing research; Oficio 8004/2019 |
| Not issuing risks a 3-day closure (ET 652-1, 657).                                            | DIAN invoicing research                   |
| Siigo does not issue the POS document; Factus is not on DIAN's 2026-08-31 provider list.      | DIAN provider API fit                     |

Prototype reference: DIAN choice and CSV import are added to the setup wizard (`/prototype/restaurant-setup`); offline checklist and contingency ticket in `/prototype/offline-invoicing`.

### 5.2 Charging (rank 2)

User value: a fast, legal checkout that matches how Colombians pay.

Functional requirements:

- FR-2.1 Tenders: cash, card on an external terminal, and QR/transfer, each recorded with manual confirmation.
- FR-2.2 Card tenders record the voucher reference; QR/transfer tenders require a reference the Cashier has seen on their own phone.
- FR-2.3 A Bill can be split and settled by several payments with different tenders.
- FR-2.4 When the bill is requested, a tip step shows a configurable suggested percentage, default at most 10%.
- FR-2.5 The customer can refuse or change the tip, including after the document is issued; removing the tip needs no Override.
- FR-2.6 The tip is shown as a separate line, outside the impoconsumo base.
- FR-2.7 A basic buyer directory supports search by NIT or name; a buyer is stored only with consent.
- FR-2.8 A Waiter can charge only if the Restaurant enables "waiters can charge"; the takings go to the Location's Cash shift.
- FR-2.9 Every charge is attributed to the Staff member who performed it.
- FR-2.10 Reopening a paid Bill requires an Override.

Key rules (Ley 1935/2018, SIC Circular Única):

- Tip is voluntary, suggested maximum 10%, asked when the bill is requested.
- "ADVERTENCIA PROPINA" signage is mandatory at the entrance and on menus (a Restaurant obligation; the app can remind in setup).
- Tips are distributed only to service staff, equally absent an agreement, within one month; management may not withhold.
- Automatic confirmation (Bold, Wompi) is Later; no direct Bre-B API exists for a SaaS.

Prototype reference: `/prototype/cashier-checkout` (fixed ticket plus payment panel) and the bill request with tip step in `/prototype/waiter-orders`.

### 5.3 Waiter on the floor plan (rank 3)

User value: fast order-taking on a phone that matches the room.

Functional requirements:

- FR-3.1 The waiter sees a floor plan with Areas as tabs and Tables as tiles showing status.
- FR-3.2 Opening a Table opens a Table session and a sheet with the order strip, categories and Menu items.
- FR-3.3 A Menu item can be added with modifiers and price deltas.
- FR-3.4 "Enviar a cocina" creates one Ticket per Station for the Menu items routed to it.
- FR-3.5 Order lines are append-only; voiding a line already sent to the kitchen creates a void record and needs an Override.
- FR-3.6 The waiter can request the bill, which starts the tip step.
- FR-3.7 When a Station marks items ready, the Table shows an in-app "ready" marker; there is no push notification.
- FR-3.8 A Menu item marked sold out cannot be added until restored; only Owner, Administrator and Cashier can mark it.
- FR-3.9 Discounts need an Override.

Prototype reference: `/prototype/waiter-orders`, variant "Plano".

### 5.4 Kitchen display per Station (rank 4)

User value: kitchens see what to prepare and how long it has waited, without printers.

Functional requirements:

- FR-4.1 The kitchen display is a Paired device bound to a Location and one or more Stations; no personal session.
- FR-4.2 Tickets appear as cards in status columns (kanban by status) with age since sent.
- FR-4.3 A Ticket can be moved through its statuses, including a waiting-for-pickup state with elapsed time.
- FR-4.4 The display shows basic timing metrics: preparation time and pickup wait.
- FR-4.5 A Ticket reaches the display in under 2 s from "Enviar a cocina" when online (guardrail, section 9).
- FR-4.6 A Station's output is a kitchen display in the MVP; thermal printing is Later.

Prototype reference: `/prototype/kitchen-display`, variant A in the Plano style.

### 5.5 Offline operation and DIAN contingency queue (rank 5)

User value: service and invoicing continue through an internet outage with no lost sales.

Functional requirements are in section 7 (FR-5.1 to FR-5.9). Prototype reference: `/prototype/offline-invoicing`, variant C (cashier checklist plus contingency ticket).

### 5.6 Cash shift and cash close (rank 6)

User value: an end-of-day close that reconciles money and distributes tips.

Functional requirements:

- FR-6.1 Owner, Administrator and Cashier can open and close a Cash shift for a Location; Waiters cannot.
- FR-6.2 Closing compares expected and counted amounts; closing with a difference needs an Override.
- FR-6.3 Takings flagged "registrado sin conexión" are listed for review at close.
- FR-6.4 The Restaurant configures Tip beneficiaries per Cash shift; the default includes waiters and kitchen staff, people without accounts can be added by name, and the Owner and Administrators are always excluded.
- FR-6.5 Tips split equally by default, or by agreed percentages.
- FR-6.6 The close produces a per-shift tip distribution report.
- FR-6.7 Closed Cash shifts are the basis of the Active Location metric.

Prototype reference: `/prototype/cash-close`, variant A (one-page ledger).

### 5.7 Staff (rank 7)

User value: the right people can do the right things at the right Location.

Functional requirements are in section 6 (FR-7.1 to FR-7.8). Prototype reference: none (specified by the roles ticket).

### 5.8 Guided setup with CSV import (rank 8)

User value: a Location is ready to take orders within the first session.

Functional requirements:

- FR-8.1 Setup is a 5-step wizard with live preview: Áreas, Mesas, Estaciones, Menú, Revisar.
- FR-8.2 A Location switcher selects the Location being set up; Areas, Tables and Stations belong to a Location.
- FR-8.3 The menu belongs to the Restaurant, with Station routing per Location; Owner and any Administrator can edit it.
- FR-8.4 Tables can be added in bulk.
- FR-8.5 A Station's output is a kitchen display (MVP) or a printer (disabled until Later).
- FR-8.6 A Menu item has a price including impoconsumo, a tax class, modifier groups with price deltas, a sold-out toggle and a Station.
- FR-8.7 The menu can be imported from an Excel or CSV template.
- FR-8.8 An Area with open Bills and a Station with routed Menu items cannot be deleted.
- FR-8.9 The review step warns about Menu items without a Station, empty Areas and idle Stations.
- FR-8.10 The wizard includes the DIAN choice (FR-1.1).

Prototype reference: `/prototype/restaurant-setup`, "Configuración guiada".

### 5.9 Daily sales report with margin (rank 9)

User value: the owner sees what sold, how it was paid and what it earned.

Functional requirements:

- FR-9.1 The daily report totals sales by tender, by Menu item and by Staff member.
- FR-9.2 Reports filter by Location; the Owner also has an all-Locations view.
- FR-9.3 Each Menu item can hold a cost; the report shows cost per item and margin.
- FR-9.4 There is no inventory depletion (full inventory is Later).
- FR-9.5 Reports and kitchen metrics are visible to Owner and Administrator only, limited to the Administrator's Locations.

Prototype reference: none.

### 5.10 Waiter call by Table session QR (rank 10)

User value: guests call a Waiter without waving, with a reason.

Functional requirements:

- FR-10.1 The Waiter shows the Table session QR ("Mostrar QR de la mesa") with a short code and can regenerate it.
- FR-10.2 Scanning opens a public page with no login, valid only during the Table session; it can only send a Waiter call.
- FR-10.3 The guest picks a reason: "Necesito algo", "Más cubiertos o servilletas" or "Quiero pagar"; the reason is shown to the Waiter.
- FR-10.4 The Waiter sees the call on the floor plan (blue dot, bell, elapsed time) and in a calls list.
- FR-10.5 The Waiter answers "Voy" ("Voy en camino"), then "Atendido".
- FR-10.6 Anti-spam: one open call per guest, the button is disabled until acknowledged, and a short cooldown follows resolution.
- FR-10.7 When the Bill is settled the page ends with "Esta mesa ya cerró. Gracias por venir."
- FR-10.8 If no device of the Location is online, the page hides the button and shows "El restaurante está sin conexión. Llama a tu mesero con la mano."

Prototype reference: `/prototype/waiter-call`, variant "Con motivo".

## 6. Roles and permissions

Built-in Roles are Owner, Administrator, Cashier and Waiter; Restaurants may add custom Roles (existing dynamic roles).

| Action                                     | Owner | Administrator | Cashier | Waiter                                                                           |
| ------------------------------------------ | ----- | ------------- | ------- | -------------------------------------------------------------------------------- |
| Subscription, plan, delete Restaurant      | Yes   | -             | -       | -                                                                                |
| DIAN connection and numbering              | Yes   | Yes           | -       | -                                                                                |
| Configure Areas, Tables, Stations, menu    | Yes   | Yes           | -       | -                                                                                |
| Invite staff and assign Roles (not Owner)  | Yes   | Yes           | -       | -                                                                                |
| Sales reports and kitchen metrics          | Yes   | Yes           | -       | -                                                                                |
| Give Override PIN                          | Yes   | Yes           | -       | -                                                                                |
| Open and close Cash shift                  | Yes   | Yes           | Yes     | -                                                                                |
| Charge and issue POS document or factura   | Yes   | Yes           | Yes     | Only if "waiters can charge" is enabled; takings go to the Location's Cash shift |
| Take orders, send to kitchen, request bill | Yes   | Yes           | Yes     | Yes                                                                              |
| Mark a Menu item sold out                  | Yes   | Yes           | Yes     | -                                                                                |

Functional requirements:

- FR-7.1 Each Staff member has one Role and a list of assigned Locations.
- FR-7.2 Administrators, Cashiers and Waiters are limited to their assigned Locations; only the Owner sees every Location.
- FR-7.3 There are no Staff member accounts for cooks; the kitchen is a Paired device.
- FR-7.4 An Override is an Administrator's PIN authorization for: voiding an item already sent to the kitchen, discounts, reopening a paid Bill, and closing a Cash shift with a difference. Each Override is recorded in the audit log.
- FR-7.5 Removing the tip needs no Override.
- FR-7.6 On a shared device that keeps the Location session, a Staff member switches in with a personal 4-6 digit PIN, and every charge is attributed.
- FR-7.7 Waiters on their own phone log in once with their own account.
- FR-7.8 A Paired device is activated once with a code and used without a personal session.

Gap with the existing RBAC: [`auth-multitenant-rbac.md`](../specs/auth-multitenant-rbac.md) is organization-wide and role-based only. The MVP needs (a) a Location assignment for Staff members and (b) restaurant permissions added to the permission catalog (the table above, plus Override, Cash shift, DIAN and menu permissions). The Location scope check must be enforced server-side, not only in the web app. Paired device lifecycle and PIN management are open (section 12).

## 7. Offline behaviour

Design target: total loss of connectivity (no internet, no mobile data). Each device caches what it needs to work alone: menu, Tables, Staff members and PINs. There is no local device-to-device sync in the MVP (it would need a local server or bridge, like thermal printing).

| Device          | While offline                                                                            |
| --------------- | ---------------------------------------------------------------------------------------- |
| Waiter phone    | Takes orders; they queue locally.                                                        |
| Kitchen display | Shows "Sin conexión, pide las comandas en voz alta"; queued Tickets arrive on reconnect. |
| Cashier         | Charges, issues the contingency receipt, queues the DIAN document.                       |
| Guest QR page   | Hides the call button and shows the offline message (FR-10.8).                           |

Functional requirements:

- FR-5.1 Order lines are append-only on reconnect, so there are no conflicts; voids are new records.
- FR-5.2 Voids needing an Override obtain it on reconnect.
- FR-5.3 Table metadata resolves last-write-wins.
- FR-5.4 All tenders can be recorded offline, manually, and are flagged "registrado sin conexión" for review at Cash shift close.
- FR-5.5 Each order line keeps the price from the device's menu at recording time; prices are never recalculated on sync.
- FR-5.6 Offline sales issue a printable or on-screen contingency ticket with the POS document requirements except those inherent to the electronic document (CUDE, QR, signature), keeping the original sale time.
- FR-5.7 Once connectivity returns, the XML is generated and transmitted within 48 h of recovery; the app keeps an outbox, a 48 h timer and an incident log as evidence.
- FR-5.8 Alerts appear at 24 h and 40 h offline; at 48 h further contingency sales are blocked while orders and kitchen continue.
- FR-5.9 Offline-queued data is never lost: a failed sync keeps the queue and is retried.

Legal basis and limits (from the contingency research):

- Plain internet loss qualifies as an issuer contingency under Res. 165 art. 37 per DIAN Concepto 9544 (2024-11-29), if the issuer is already habilitado, the situation is temporary (no "permanent" contingency, Concepto 006962 of 2024-09-25) and the issuer keeps incident evidence.
- The legal 48 h clock runs from the moment the impediment is overcome. No numeric cap on outage duration or volume was found. The 48 h offline block (FR-5.8) is a product limit chosen in the offline-scope ticket, not a legal one.
- An old DIAN web page still states 30 days (previous regime); it is treated as superseded.
- Unconfirmed: separate contingency numbering range, late submission with original sale time through Alegra, electronic incident notice (section 12).

## 8. Plans and pricing

| Plan     | Price per Location per month | Includes                                                                                  |
| -------- | ---------------------------- | ----------------------------------------------------------------------------------------- |
| Esencial | COP 49.900 + IVA             | Everything in the MVP except DIAN invoicing; for exempt businesses.                       |
| Completo | COP 89.900 + IVA             | Everything, with unlimited DIAN documents under fair use of 5.000 per Location per month. |

Commercial terms: 30-day trial with everything included and no card (DIAN habilitación can take days); annual billing gives 2 months free (about 17%); self-serve.

Positioning: no competitor prices per Location; Completo sits below Loggro (COP 120.990) and Fudo Avanzado (COP 118.900) with no extra charge per register or for invoicing.

Explicit assumption: the provider (Alegra) costs at most COP 15 per document. The real price was not obtained, and pricing reopens if it is higher.

Margin sensitivity for Completo at 3.000 documents per month (about 100 Bills a day), before other costs:

| Provider cost per document | Provider cost per month | Left from COP 89.900 |
| -------------------------- | ----------------------- | -------------------- |
| COP 5                      | 15.000                  | 74.900 (83%)         |
| COP 15                     | 45.000                  | 44.900 (50%)         |
| COP 30                     | 90.000                  | -100 (0%)            |
| COP 60                     | 180.000                 | -90.100 (negative)   |

At the 5.000-document fair-use ceiling, the break-even provider cost is about COP 18 per document (89.900 / 5.000), derived from the same figures.

## 9. Success metrics and guardrails

Targets are starting points without own data; revisit with the first customers.

| Metric        | Definition                                                                                                             | Target                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| North star    | Weekly Active Locations: closed a Cash shift on 5 or more days of the week.                                            | Tracked weekly                 |
| Activation    | Activated Location: within 7 days of signup, finished guided setup, settled at least 20 Bills and closed a Cash shift. | 50% of signed-up Locations     |
| Retention     | Locations still paying at month 3; monthly churn after month 3.                                                        | At least 75%; churn at most 5% |
| Business goal | Paying Locations 6 months after launch.                                                                                | 50                             |

Guardrails:

| Guardrail                                                  | Threshold                 |
| ---------------------------------------------------------- | ------------------------- |
| DIAN documents transmitted late                            | 0 after the 48 h deadline |
| Offline queues synced without manual intervention          | At least 99.5%            |
| "Enviar a cocina" to Ticket on the kitchen display, online | Under 2 s                 |
| Median pickup wait in Active Locations                     | Under 3 min               |

## 10. Later (beyond the MVP)

Thermal printers (kitchen tickets and receipts); full inventory (first paid add-on); push notifications; QR/WhatsApp ordering; delivery aggregators; automatic payment confirmation (Bold first, Wompi second); menu import from competitor systems; reservations; loyalty.

## 11. Assumptions and risks

| #   | Assumption or risk                                                                                                                           | Impact                                                          | Mitigation                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | Alegra price per document is at most COP 15; the real price is unknown.                                                                      | Completo margin falls to 0% at COP 30 per document (section 8). | Obtain pricing before building the adapter; Dataico is the fallback.                         |
| 2   | Alegra's contingency flow and late submission with original sale time are unconfirmed; its public API documents no contingency DEE POS type. | Offline invoicing design may change.                            | Verify by hand against Alegra's reference pages; the POS keeps its own outbox.               |
| 3   | The provider's DEE-POS endpoint is available for associated companies in production.                                                         | Core promise at risk.                                           | Confirm with Alegra; sandbox first.                                                          |
| 4   | Legal interpretations (tip on DIAN documents, income treatment, impoconsumo handling, exemption) are not validated.                          | Compliance defects.                                             | Validate with an accountant before launch; the app explains and records but does not verify. |
| 5   | DANE market data is dated (2019) and trade-body counts disagree; no POS-adoption share.                                                      | Market size is uncertain.                                       | Treat the 50-Location goal as the validation, not a forecast.                                |
| 6   | Offline demand is thinly evidenced.                                                                                                          | Investment may not drive adoption.                              | Keep scope per section 7; measure the sync guardrail.                                        |
| 7   | Alerts, the 48 h offline block and tip beneficiary defaults are product decisions, not statutory text.                                       | A rule may be stricter or looser than assumed.                  | Revisit after accountant review.                                                             |
| 8   | Competitor prices were partly extracted automatically; promotions may skew list prices.                                                      | Positioning may shift.                                          | Recheck live before launch.                                                                  |
| 9   | No access to owners; decisions rest on desk research and prototype reactions.                                                                | Fit may differ.                                                 | Early-customer feedback loop; targets are starting points.                                   |
| 10  | DIAN habilitación per Restaurant is partly manual and can take days.                                                                         | Slow activation.                                                | 30-day trial, wizard (FR-1.9), Esencial plan for exempt businesses.                          |

## 12. Open questions

| Area                     | Question                                                                                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DIAN habilitación wizard | Portal registration, POS numbering resolution and provider test set details; the exempt-business flow (eligibility explanation, simple receipt, reminder).                                                 |
| Personal data            | Ley 1581 (habeas data) obligations for the buyer directory and staff data.                                                                                                                                 |
| Tip on DIAN documents    | How the voluntary tip appears on the e-invoice or POS document and whether it counts as Restaurant income (accountant).                                                                                    |
| Paired devices and PINs  | Paired device lifecycle (activate, revoke, rename); personal PIN management (set, reset, lockout).                                                                                                         |
| Alegra commercial terms  | API and partner pricing (per document or flat, per associated company, volume tiers).                                                                                                                      |
| Alegra technical terms   | DEE-POS endpoint availability for associated companies; "07 contingency" documentType; late submission with original sale time; separate contingency numbering range per Restaurant; DIAN incident notice. |
| Subscription billing     | How Restaurants pay the Plan (card, PSE, invoice), dunning, and what happens to data when a Location stops paying.                                                                                         |

## 13. References

Planning tickets (not committed; paths under `.scratch/restaurant-management/`):

- `map.md`; `issues/01` DIAN invoicing and taxes; `02` payments and tips; `03` competitors and pricing; `04` pain points; `05` staff roles and permissions; `06` MVP ranking; `07` offline scope; `08` pricing and plans; `09` waiter order flow; `10` success metrics; `12` DIAN provider API fit; `13` Alegra partner pricing; `14` restaurant setup; `15` waiter call QR; `16` DIAN contingency.

Research (retrieve with `git show <branch>:<path>`):

| Branch                       | File                                 |
| ---------------------------- | ------------------------------------ |
| `research/dian-invoicing`    | `docs/research/dian-invoicing.md`    |
| `research/payments-tips`     | `docs/research/payments-tips.md`     |
| `research/competitors`       | `docs/research/competitors.md`       |
| `research/pain-points`       | `docs/research/pain-points.md`       |
| `research/dian-provider-api` | `docs/research/dian-provider-api.md` |
| `research/dian-contingency`  | `docs/research/dian-contingency.md`  |

Prototypes: branch `prototype/restaurant-pos`, routes under `apps/web/src/routes/prototype/` (`waiter-orders`, `kitchen-display`, `cashier-checkout`, `offline-invoicing`, `cash-close`, `restaurant-setup`, `waiter-call`) and the tracking document `odd/tasks/restaurant-pos-prototype.md` on that branch. Prototype code is throwaway and is not copied.

Repository context: [`GLOSSARY.md`](../../GLOSSARY.md); [`docs/specs/auth-multitenant-rbac.md`](../specs/auth-multitenant-rbac.md).
