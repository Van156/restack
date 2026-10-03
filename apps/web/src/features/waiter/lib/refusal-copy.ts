const UNROUTED = /^No Station at this Location prepares: (.+)\.$/;

/** Spanish copy for a send refused because some items have no Station; undefined for other messages. */
export function unroutedCopy(message: string): string | undefined {
  const items = UNROUTED.exec(message)?.[1];
  return items
    ? `Estos productos no tienen estación en este local: ${items}. Pide a un administrador que los asigne.`
    : undefined;
}

const OFFLINE_ACTOR_COPY: Record<string, string> = {
  offline_actor_stale:
    "No se pudo comprobar quién tomó esto porque el PIN de esa persona cambió. Regístralo de nuevo.",
  offline_actor_invalid:
    "No se pudo comprobar el PIN con el que se tomó esto. Regístralo de nuevo entrando con tu PIN.",
  offline_actor_expired:
    "Pasaron más de 48 horas desde que se tomó esto y ya no se acepta a nombre de esa persona. Regístralo de nuevo.",
};

/** Spanish copy for a queued record the server refused, by its `data.reason`; undefined when unknown. */
export function refusalCopy(error: { message: string; reason?: string }): string | undefined {
  if (error.reason === "unrouted_items") {
    return (
      unroutedCopy(error.message) ??
      "Hay productos sin estación en este local. Pide a un administrador que los asigne."
    );
  }
  return error.reason ? OFFLINE_ACTOR_COPY[error.reason] : undefined;
}
