import { describe, expect, test } from "bun:test";

import type { Acting, SwitchInResult } from "./acting-member";
import type { OfflineSwitchInResult } from "./offline-switch-in";
import { runSwitchIn } from "./switch-in";

const remoteResult: SwitchInResult = {
  memberId: "m1",
  name: "Ana",
  role: "waiter",
  locationId: "loc_1",
  actingToken: "tok",
  actingTokenExpiresAt: new Date("2026-10-03T20:15:00Z"),
};

const offlineActing: Acting = {
  memberId: "m1",
  name: "Ana",
  role: "waiter",
  locationId: "loc_1",
  credential: {
    kind: "offline",
    signer: {
      memberId: "m1",
      epoch: 1,
      sign: async () => ({ memberId: "m1", epoch: 1, mac: "m" }),
    },
  },
  expiresAt: new Date("2026-10-03T20:15:00Z"),
};

function setup(options: {
  online: boolean;
  remote?: () => Promise<SwitchInResult>;
  offline?: OfflineSwitchInResult;
}) {
  const events: string[] = [];
  const deps = {
    online: options.online,
    remote: async () => {
      events.push("remote");
      return (options.remote ?? (async () => remoteResult))();
    },
    offline: async () => {
      events.push("offline");
      return options.offline ?? { status: "ok" as const, acting: offlineActing };
    },
    now: () => new Date("2026-10-03T20:00:00Z"),
    isNetworkFailure: (error: unknown) => error instanceof TypeError,
    onNetworkFailure: () => events.push("network_failure"),
  };
  return { deps, events };
}

describe("runSwitchIn", () => {
  test("online, the server checks the PIN and the member gets an acting token", async () => {
    const { deps, events } = setup({ online: true });
    const result = await runSwitchIn(deps, "m1", "4821");

    expect(events).toEqual(["remote"]);
    expect(result.status === "ok" && result.acting.credential).toEqual({
      kind: "token",
      token: "tok",
    });
  });

  test("offline, the device checks the PIN against its stored material", async () => {
    const { deps, events } = setup({ online: false });
    const result = await runSwitchIn(deps, "m1", "4821");

    expect(events).toEqual(["offline"]);
    expect(result.status === "ok" && result.acting.credential.kind).toBe("offline");
  });

  test("a connection lost mid-request falls back to the stored material and reports it", async () => {
    const { deps, events } = setup({
      online: true,
      remote: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    const result = await runSwitchIn(deps, "m1", "4821");

    expect(events).toEqual(["remote", "network_failure", "offline"]);
    expect(result.status).toBe("ok");
  });

  test("a refusal from the server is shown as it is and never retried offline", async () => {
    const { deps, events } = setup({
      online: true,
      remote: async () => {
        throw Object.assign(new Error("Wrong PIN."), { code: "FORBIDDEN" });
      },
    });
    const result = await runSwitchIn(deps, "m1", "0000");

    expect(events).toEqual(["remote"]);
    expect(result).toEqual({ status: "failed", failure: { status: "error" } });
  });

  test("offline failures become what the PIN pad shows", async () => {
    const wrong = await runSwitchIn(
      setup({ online: false, offline: { status: "wrong_pin", attemptsLeft: 3 } }).deps,
      "m1",
      "0000",
    );
    expect(wrong).toEqual({
      status: "failed",
      failure: { status: "error", message: "PIN incorrecto. Te quedan 3 intentos." },
    });

    const last = await runSwitchIn(
      setup({ online: false, offline: { status: "wrong_pin", attemptsLeft: 1 } }).deps,
      "m1",
      "0000",
    );
    expect(last.status === "failed" && last.failure.message).toBe(
      "PIN incorrecto. Te queda 1 intento.",
    );

    const locked = await runSwitchIn(
      setup({
        online: false,
        offline: { status: "locked", until: new Date("2026-10-03T20:15:00Z") },
      }).deps,
      "m1",
      "0000",
    );
    expect(locked).toEqual({
      status: "failed",
      failure: { status: "locked", message: "Demasiados intentos. Vuelve a intentarlo en 15 min." },
    });

    const none = await runSwitchIn(
      setup({ online: false, offline: { status: "no_material" } }).deps,
      "m1",
      "0000",
    );
    expect(none).toEqual({
      status: "failed",
      failure: {
        status: "error",
        message: "Este dispositivo no tiene el PIN de esta persona. Entra una vez con conexión.",
      },
    });
  });
});
