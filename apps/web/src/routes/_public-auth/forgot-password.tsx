import { createFileRoute } from "@tanstack/react-router";

import { ForgotPasswordPage } from "@/features/auth";

export const Route = createFileRoute("/_public-auth/forgot-password")({
  component: ForgotPasswordPage,
});
