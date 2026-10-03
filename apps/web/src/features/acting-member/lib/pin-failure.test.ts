import { describe, expect, test } from "bun:test";

import { pinFailure } from "./pin-failure";

const failure = (code: string, message: string) => Object.assign(new Error(message), { code });

describe("pinFailure", () => {
  test("a wrong PIN shows the pad's own error", () => {
    expect(pinFailure(failure("FORBIDDEN", "Incorrect PIN."))).toEqual({ status: "error" });
  });

  test("too many wrong PINs lock the pad", () => {
    expect(
      pinFailure(failure("TOO_MANY_REQUESTS", "Too many wrong PINs. Try again later.")),
    ).toEqual({ status: "locked" });
  });

  test("a person outside the Location or without authority gets a specific message", () => {
    expect(pinFailure(failure("FORBIDDEN", "This Staff member does not work here."))).toEqual({
      status: "error",
      message: "Esta persona no trabaja en este local.",
    });
    expect(pinFailure(failure("FORBIDDEN", "This Staff member cannot approve here."))).toEqual({
      status: "error",
      message: "Esta persona no puede autorizar aquí.",
    });
  });

  test("a failure with no server code reads as lost connection", () => {
    expect(pinFailure(new TypeError("Failed to fetch"))).toEqual({
      status: "error",
      message: "Sin conexión: el PIN se verifica en línea.",
    });
  });

  test("anything else asks to try again", () => {
    expect(pinFailure(failure("INTERNAL_SERVER_ERROR", "x"))).toEqual({
      status: "error",
      message: "No pudimos verificar el PIN. Inténtalo de nuevo.",
    });
  });
});
