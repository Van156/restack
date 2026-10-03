const BUILT_IN_LABELS: Record<string, string> = {
  owner: "Propietario",
  admin: "Administrador",
  cashier: "Cajero",
  waiter: "Mesero",
  member: "Miembro",
};

/** Spanish name of a role string; custom roles keep their own name. */
export function restaurantRoleLabel(role: string): string {
  return role
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((name) => BUILT_IN_LABELS[name] ?? name)
    .join(", ");
}
