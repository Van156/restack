import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { StaffRow } from "../lib/staff-rows";
import InviteStaffForm from "./invite-staff-form";
import PinEntryFlow from "./pin-entry-flow";
import StaffTable from "./staff-table";

const rows: StaffRow[] = [
  {
    memberId: "m1",
    name: "Ana",
    email: "ana@x.co",
    role: "owner",
    isOwner: true,
    locationIds: [],
    locationNames: [],
  },
  {
    memberId: "m2",
    name: "Zoe",
    email: "zoe@x.co",
    role: "waiter",
    isOwner: false,
    locationIds: ["l1"],
    locationNames: ["Centro"],
  },
];

describe("StaffTable", () => {
  const render = (callerIsOwner: boolean) =>
    renderToStaticMarkup(
      <StaffTable
        rows={rows}
        callerIsOwner={callerIsOwner}
        onEditLocations={() => {}}
        onResetPin={() => {}}
      />,
    );

  test("shows Role in Spanish and the Locations, with every Location for the Owner", () => {
    const html = render(true);
    expect(html).toContain("Propietario");
    expect(html).toContain("Todos los locales");
    expect(html).toContain("Mesero");
    expect(html).toContain("Centro");
  });

  test("the Owner's row never offers Locales; a PIN reset only to the Owner", () => {
    const asAdmin = render(false);
    expect(asAdmin).not.toContain("Editar locales de Ana");
    expect(asAdmin).not.toContain("Restablecer el PIN de Ana");
    expect(asAdmin).toContain("Editar locales de Zoe");
    expect(asAdmin).toContain("Restablecer el PIN de Zoe");
    expect(render(true)).toContain("Restablecer el PIN de Ana");
  });
});

describe("InviteStaffForm", () => {
  const props = {
    values: { email: "", role: "", locationIds: [] },
    errors: {},
    roles: [{ name: "waiter" }, { name: "cashier" }],
    locations: [{ id: "l1", name: "Centro" }],
    isPending: false,
    onChange: () => {},
    onSubmit: () => {},
  };

  test("offers the assignable Roles by their Spanish names and the Locations", () => {
    const html = renderToStaticMarkup(<InviteStaffForm {...props} />);
    expect(html).toContain("Mesero");
    expect(html).toContain("Cajero");
    expect(html).toContain("Centro");
  });

  test("disables the invitation when the caller can assign no Role", () => {
    const html = renderToStaticMarkup(<InviteStaffForm {...props} roles={[]} />);
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>Enviar invitación<\/button>/);
  });

  test("shows validation messages", () => {
    const html = renderToStaticMarkup(
      <InviteStaffForm
        {...props}
        errors={{ email: "Escribe un correo válido.", locationIds: "Elige al menos un local." }}
      />,
    );
    expect(html).toContain("Escribe un correo válido.");
    expect(html).toContain("Elige al menos un local.");
  });
});

describe("PinEntryFlow", () => {
  test("titles the current stage and surfaces a server error on the pad", () => {
    const html = renderToStaticMarkup(
      <PinEntryFlow state={{ stage: "current" }} errorMessage="PIN bloqueado." onPin={() => {}} />,
    );
    expect(html).toContain("Escribe tu PIN actual");
    expect(html).toContain("PIN bloqueado.");
  });
});
