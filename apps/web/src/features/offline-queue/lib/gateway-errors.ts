/** The action needs the server and there is no connection. */
export class OfflineRequiredError extends Error {
  constructor() {
    super("This action needs a connection.");
  }
}

/** The action is attributed through an acting token, which a member who entered the PIN offline lacks. */
export class OnlineSwitchInRequiredError extends Error {
  constructor() {
    super("This action needs a PIN switch-in made online.");
  }
}
