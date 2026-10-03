/** Public API of the acting-member feature: PIN switch-in on a shared device. */
export { default as ActingBar } from "./components/acting-bar";
export { ActingMemberProvider, useActingMember } from "./components/acting-member-provider";
export { default as StaffPinDialog } from "./components/staff-pin-dialog";
export { useStaffOptions } from "./hooks/use-staff-options";
export { pinFailure, type PinFailure } from "./lib/pin-failure";
export type { Acting, StaffOption } from "./lib/acting-member";
