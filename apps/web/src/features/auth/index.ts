/** Public API of the auth feature (spec §4.4). Everything else is internal. */
export { default as AuthCard } from "./components/auth-card";
export { default as AuthFormError } from "./components/auth-form-error";
export { default as AuthStatusNotice } from "./components/auth-status-notice";
export { default as AuthLayout } from "./components/auth-layout";
export { default as ForgotPasswordPage } from "./components/forgot-password-page";
export { default as ResetPasswordPage } from "./components/reset-password-page";
export { default as SocialSignInButtons } from "./components/social-sign-in-buttons";
export { default as SignInPage } from "./components/sign-in-page";
export { default as SignUpPage } from "./components/sign-up-page";
export { default as UserMenu } from "./components/user-menu";
export { default as VerifyEmailPage } from "./components/verify-email-page";
export { handleSignOut } from "./lib/sign-out";
export { useSocialSignIn } from "./hooks/use-social-sign-in";
export { oauthErrorMessage } from "./lib/oauth-error";
export {
  betterAuthErrorBody,
  betterAuthErrorCode,
  betterAuthErrorMessage,
  isInvitationRecipientMismatchError,
} from "./lib/auth-errors";
export {
  authSearchSchema,
  signInRedirect,
  socialSignInTargets,
  type AuthSearch,
} from "./lib/auth-search";
export { nameSchema, newPasswordSchema } from "./lib/auth-form-schemas";
export { resetPasswordSearchSchema } from "./lib/reset-password-search";
