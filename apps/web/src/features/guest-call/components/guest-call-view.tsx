import { Button } from "@base-template/ui/components/button";
import { cn } from "@base-template/ui/lib/utils";
import { BellRing, CircleCheck, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

import type { GuestReasonId } from "../lib/guest-client";
import type { GuestView } from "../lib/guest-view";

function Message({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" className="space-y-3 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      {title ? <h1 className="text-xl font-semibold">{title}</h1> : null}
      <p className="text-base text-muted-foreground">{children}</p>
    </div>
  );
}

/**
 * The public Waiter call page for one Table: the three reasons, or why calling is not possible.
 * It shows nothing besides the Table name and the call function.
 */
export default function GuestCallView({
  view,
  busy,
  onCall,
}: {
  view: GuestView;
  busy: boolean;
  onCall: (reason: GuestReasonId) => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <Body view={view} busy={busy} onCall={onCall} />
    </main>
  );
}

function Body({
  view,
  busy,
  onCall,
}: {
  view: GuestView;
  busy: boolean;
  onCall: (reason: GuestReasonId) => void;
}) {
  switch (view.kind) {
    case "loading":
      return (
        <p role="status" aria-live="polite" className="text-center text-muted-foreground">
          Cargando tu mesa...
        </p>
      );
    case "unreachable":
      return (
        <Message icon={<WifiOff aria-hidden />} title="No pudimos conectar">
          Revisa tu conexión a internet. Seguimos intentando.
        </Message>
      );
    case "offline":
      return <Message icon={<WifiOff aria-hidden />}>{view.message}</Message>;
    case "closed":
      return <Message icon={<CircleCheck aria-hidden />}>{view.message}</Message>;
    case "expired":
    case "invalid":
      return <Message icon={<BellRing aria-hidden />}>{view.message}</Message>;
    case "throttled":
      return (
        <Message icon={<WifiOff aria-hidden />} title="Demasiadas solicitudes">
          Vuelve a intentar en {view.seconds} s.
        </Message>
      );
    case "open":
      return <OpenBody view={view} busy={busy} onCall={onCall} />;
  }
}

function OpenBody({
  view,
  busy,
  onCall,
}: {
  view: Extract<GuestView, { kind: "open" }>;
  busy: boolean;
  onCall: (reason: GuestReasonId) => void;
}) {
  const disabled = !view.canCall || busy;
  return (
    <>
      <header className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">{view.tableName}</h1>
        <p className="text-muted-foreground">¿En qué te ayudamos?</p>
      </header>
      <div role="status" aria-live="polite" className="min-h-12 text-center">
        {view.call ? (
          <p className="font-medium">
            {view.call.onTheWay ? "Tu mesero va en camino" : "Avisamos a tu mesero"}
            <span className="block text-sm font-normal text-muted-foreground">
              {view.call.reasonLabel}
            </span>
          </p>
        ) : view.cooldownSeconds !== null ? (
          <p className="text-muted-foreground">
            Tu mesero ya te atendió. Podrás llamar de nuevo en {view.cooldownSeconds} s.
          </p>
        ) : null}
        {view.notice ? <p className="text-sm text-muted-foreground">{view.notice}</p> : null}
      </div>
      <ul className="space-y-3">
        {view.reasons.map((reason) => (
          <li key={reason.id}>
            <Button
              size="lg"
              variant={reason.id === "pay" ? "default" : "outline"}
              className={cn("h-14 w-full text-base")}
              disabled={disabled}
              onClick={() => onCall(reason.id)}
            >
              {reason.label}
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}
