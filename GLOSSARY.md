# Restaurant Management

A web app that small independent restaurants in Colombia use to run front-of-house service and get paid.

## Language

**Restaurant**:
The business that subscribes to the app; one tenant, represented by an Organization.
_Avoid_: Business, account, company

**Location**:
A physical branch of a Restaurant where service happens.
_Avoid_: Sede, branch, store, site

### Service floor

**Area**:
A named part of a Location where Tables sit, such as the dining room or the terrace.
_Avoid_: Space, zone, room, section

**Table**:
A place in an Area where a party is seated and served; has a name and a number of seats.
_Avoid_: Spot, seat

### Preparation

**Station**:
A preparation point in a Location that receives tickets for the Menu items routed to it, such as the hot kitchen, the cold kitchen or the bar.
_Avoid_: Kitchen (when it means one of several), printer, area

**Menu item**:
Something a Restaurant sells, with a price, optional modifiers, and the Station that prepares it.
_Avoid_: Product, dish, plate

### Staff and access

**Staff member**:
A person who works for a Restaurant, with one Role and the Locations they work at.
_Avoid_: Employee, member, user, worker

**Role**:
The named set of things a Staff member may do: Owner, Administrator, Cashier, Waiter, or a custom role the Restaurant defines.
_Avoid_: Profile, position, permission group

**Paired device**:
A screen bound to a Location (and optionally to Stations), activated once with a code, used without a personal session, such as the kitchen display.
_Avoid_: Kiosk, terminal, shared account

**Override**:
An Administrator's PIN authorization for a sensitive action performed by someone else, recorded in the audit log.
_Avoid_: Approval, supervisor key, manager code

### Service and money

**Ticket**:
The part of a Table's order sent to one Station to be prepared.
_Avoid_: Comanda, kitchen order, docket

**Bill**:
What a Table owes: its consumption, the 8% consumption tax and the voluntary tip, settled by one or more payments.
_Avoid_: Check, account, invoice (an invoice is the DIAN document)

**Cash shift**:
A period during which one Location's takings are collected, from opening to the cash close that compares expected and counted amounts.
_Avoid_: Caja, register session, till

### Guests

**Table session**:
The period from opening a Table to settling its Bill; guests join it by scanning the Table's session QR code.
_Avoid_: Visit, occupancy, check-in

**Waiter call**:
A guest's request, sent from their own phone within a Table session, for a Waiter to come to the Table.
_Avoid_: Ping, alert, service request

**Tip beneficiary**:
A person in the service chain who receives a share of a Cash shift's tips, with or without a Staff member account; never the Owner or an Administrator.
_Avoid_: Tip recipient, tip pool member

### Product health

**Active Location**:
A Location that closed at least one Cash shift on five or more days of a given week.
_Avoid_: Active restaurant, active customer, active account

**Activated Location**:
A Location that, within seven days of signing up, finished guided setup, settled at least 20 Bills and closed a Cash shift.
_Avoid_: Onboarded, live

### Subscription

**Plan**:
What a Restaurant pays for each Location every month: Esencial (without DIAN invoicing) or Completo (with DIAN invoicing).
_Avoid_: Tier, package, license
