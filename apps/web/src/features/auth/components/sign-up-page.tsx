import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { authClient } from "@/app/auth-client";
import Loader from "@/shared/components/feedback/loader";

import { authLinkSearch, type AuthSearch } from "../lib/auth-search";
import AuthCard from "./auth-card";
import CheckInboxScreen from "./check-inbox-screen";
import SignUpForm from "./sign-up-form";

/**
 * `/sign-up`: the sign-up form inside `AuthCard`. The "check your inbox" screen is a
 * state of this page (not its own route), so the pending email and the resend cooldown
 * live in one component and a reload returns to the form.
 */
export default function SignUpPage({ search }: { search?: AuthSearch }) {
  const navigate = useNavigate();
  const { isPending } = authClient.useSession();
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  if (pendingEmail !== null) {
    return (
      <AuthCard>
        <CheckInboxScreen
          email={pendingEmail}
          onBackToSignIn={() => navigate({ to: "/sign-in", search: authLinkSearch(search) })}
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account" description="Enter your details to get started">
      {isPending ? <Loader /> : <SignUpForm search={search} onSignedUp={setPendingEmail} />}
    </AuthCard>
  );
}
