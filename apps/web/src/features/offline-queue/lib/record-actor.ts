import type { EnqueueInput } from "./queue";
import type { RecordSigner } from "./types";

/** How the member acting on the device is attributed: an online token, an offline signer, or nobody. */
export type RecordActor = { token?: string; signer?: RecordSigner };

/** A record ready to queue; every queueable action has its own idempotency key. */
export type QueuedAction = EnqueueInput & { idempotencyKey: string };

/** Stamps the record with who made it: the acting token, or a mac from the offline PIN. */
export async function withActor(
  input: QueuedAction,
  actor: RecordActor,
  now: Date,
): Promise<QueuedAction> {
  if (actor.signer) {
    const offlineActor = await actor.signer.sign({
      idempotencyKey: input.idempotencyKey,
      kind: input.kind,
      deviceRecordedAt: now,
    });
    return { ...input, deviceRecordedAt: now, offlineActor };
  }
  return actor.token ? { ...input, actingToken: actor.token } : input;
}
