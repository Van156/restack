import { authClient } from "@/app/auth-client";
import Loader from "@/shared/components/feedback/loader";

import type { AuthSearch } from "../lib/auth-search";
import AuthCard from "./auth-card";
import SignInForm from "./sign-in-form";

/** `/sign-in`: the sign-in form inside the split `AuthCard`. */
export default function SignInPage({ search }: { search?: AuthSearch }) {
  const { isPending } = authClient.useSession();
  return (
    <AuthCard title="Welcome back" description="Sign in to your account">
      {isPending ? <Loader /> : <SignInForm search={search} />}
    </AuthCard>
  );
}
