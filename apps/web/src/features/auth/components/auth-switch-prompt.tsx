import { Link } from "@tanstack/react-router";

import type { AuthSearch } from "../lib/auth-search";

/** Bottom line of the auth forms: "Don't have an account? Sign up" / "Already have an account? Sign in". */
export default function AuthSwitchPrompt({
  prompt,
  to,
  label,
  search,
}: {
  prompt: string;
  to: "/sign-in" | "/sign-up";
  label: string;
  search?: AuthSearch;
}) {
  return (
    <p className="text-center text-sm">
      {prompt}{" "}
      <Link to={to} search={search ?? {}} className="underline underline-offset-4">
        {label}
      </Link>
    </p>
  );
}
