/** Open state of a collapsible nav parent: it follows the active route but the user can toggle it. */
export type NavParentState = { open: boolean; wasActive: boolean };

export function initialNavParentState(active: boolean): NavParentState {
  return { open: active, wasActive: active };
}

/**
 * Next state for a render where the parent's `active` flag is `active`: opens when a
 * child becomes active (also after mount), keeps the user's choice otherwise.
 * Returns the same object when nothing changed.
 */
export function nextNavParentState(state: NavParentState, active: boolean): NavParentState {
  if (active === state.wasActive) {
    return state;
  }
  return { open: active ? true : state.open, wasActive: active };
}

export function toggleNavParent(state: NavParentState, open: boolean): NavParentState {
  return { ...state, open };
}
