import { DiscountDialog, OverridePrompt } from "@/features/override-prompt";

import type { useCheckoutCommands } from "../hooks/use-checkout-commands";
import type { CheckoutPanel } from "../lib/checkout-panel";

type Commands = Pick<ReturnType<typeof useCheckoutCommands>, "discount" | "voidLine" | "reopen">;

/** The dialog open over a Bill, if any; each Override goes straight to the action it authorizes. */
export default function CheckoutDialogs({
  panel,
  locationId,
  sessionId,
  commands,
  onPanel,
}: {
  panel: CheckoutPanel;
  locationId: string;
  sessionId: string;
  commands: Commands;
  onPanel: (panel: CheckoutPanel) => void;
}) {
  const close = () => onPanel({ kind: "none" });
  switch (panel.kind) {
    case "none":
      return null;
    case "discount":
      return (
        <DiscountDialog
          onCancel={close}
          onSubmit={(discount) => onPanel({ kind: "discount_override", discount })}
        />
      );
    case "discount_override":
      return (
        <OverridePrompt
          locationId={locationId}
          action="discount"
          target={sessionId}
          onCancel={close}
          onGranted={(overrideId) => {
            void commands.discount(panel.discount, overrideId);
            close();
          }}
        />
      );
    case "void":
      return (
        <OverridePrompt
          locationId={locationId}
          action="void_line"
          target={panel.line.id}
          onCancel={close}
          onGranted={(overrideId) => {
            void commands.voidLine(panel.line.id, overrideId);
            close();
          }}
        />
      );
    case "reopen":
      return (
        <OverridePrompt
          locationId={locationId}
          action="reopen_bill"
          target={sessionId}
          onCancel={close}
          onGranted={(overrideId) => {
            void commands.reopen(overrideId);
            close();
          }}
        />
      );
  }
}
