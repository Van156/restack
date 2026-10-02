import { Button } from "@base-template/ui/components/button";
import { FieldSeparator } from "@base-template/ui/components/field";
import { Spinner } from "@base-template/ui/components/spinner";
import type { ComponentType } from "react";

import { SOCIAL_PROVIDER_LABELS, type SocialProviderId } from "../lib/social-providers";
import GoogleIcon from "./google-icon";

const PROVIDER_ICONS: Record<SocialProviderId, ComponentType<{ className?: string }>> = {
  google: GoogleIcon,
};

/**
 * "or" divider and a button per enabled provider (nothing for an empty list). While
 * a redirect is pending (R5.3) all buttons are disabled and the clicked one spins; `disabled` lets
 * the parent form disable them during its own submit.
 */
export default function SocialSignInButtons({
  providers,
  onSelect,
  pendingProvider = null,
  disabled = false,
}: {
  providers: readonly SocialProviderId[];
  onSelect: (provider: SocialProviderId) => void;
  pendingProvider?: SocialProviderId | null;
  disabled?: boolean;
}) {
  if (providers.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-4">
      <FieldSeparator>or</FieldSeparator>
      {providers.map((provider) => {
        const Icon = PROVIDER_ICONS[provider];
        const isPending = pendingProvider === provider;
        return (
          <Button
            key={provider}
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={disabled || pendingProvider !== null}
            onClick={() => onSelect(provider)}
          >
            {isPending ? <Spinner /> : <Icon className="size-4" />}
            Continue with {SOCIAL_PROVIDER_LABELS[provider]}
          </Button>
        );
      })}
    </div>
  );
}
