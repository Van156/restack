import { createAuthEndpoint } from "@better-auth/core/api";
import { APIError } from "@better-auth/core/error";
import type { BetterAuthPlugin } from "better-auth";
import { setSessionCookie } from "better-auth/cookies";
import * as z from "zod";

import { extractRequestMeta } from "../audit/request-context";
import type { AuditLogger } from "../audit/types";
import {
  hashInvitationToken,
  invitationSignUpIdentifier,
  invitationTokensMatch,
} from "../invitation-token";

/** Subset of the `invitation` row, read through better-auth's adapter like the rest of the file. */
type InvitationRow = {
  id: string;
  organizationId: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: Date;
};

const invitationExpiredOrGoneError = () =>
  new APIError("BAD_REQUEST", {
    code: "INVITATION_NOT_FOUND",
    message: "This invitation is no longer valid. Ask the organization for a new one.",
  });

// Identical for missing, mismatched and expired tokens so the reason is never revealed (R2.4).
const invalidInvitationTokenError = () =>
  new APIError("BAD_REQUEST", {
    code: "INVALID_INVITATION_TOKEN",
    message: "This invitation link is invalid or has expired. Ask the organization for a new one.",
  });

/**
 * `POST /invitation/sign-up` (R2.4): sign up through an invitation link in one validated step. The
 * email comes from the invitation, never the client; the account is created verified.
 * See docs/architecture/auth.md#invitation-sign-up-flow
 */
export function invitationSignUpPlugin(auditLogger: AuditLogger) {
  return {
    id: "invitation-sign-up",
    endpoints: {
      signUpViaInvitation: createAuthEndpoint(
        "/invitation/sign-up",
        {
          method: "POST",
          body: z.object({
            invitationId: z.string().meta({ description: "The invitation being redeemed." }),
            token: z
              .string()
              .meta({ description: "The token embedded in the invitation accept link." }),
            name: z.string().min(1).meta({ description: "The new user's display name." }),
            password: z.string().meta({ description: "The new user's password." }),
          }),
        },
        async (ctx) => {
          const { invitationId, token, name, password } = ctx.body;

          // Verified first so the existing-account check cannot leak whether an email is registered.
          const verificationIdentifier = invitationSignUpIdentifier(invitationId);
          const verification =
            await ctx.context.internalAdapter.findVerificationValue(verificationIdentifier);
          const tokenIsValid =
            verification !== null &&
            verification.expiresAt.getTime() >= Date.now() &&
            invitationTokensMatch(hashInvitationToken(token), verification.value);
          if (!tokenIsValid) {
            throw invalidInvitationTokenError();
          }

          const invitation = await ctx.context.adapter.findOne<InvitationRow>({
            model: "invitation",
            where: [{ field: "id", value: invitationId }],
          });
          if (
            !invitation ||
            invitation.status !== "pending" ||
            invitation.expiresAt.getTime() < Date.now()
          ) {
            throw invitationExpiredOrGoneError();
          }

          // Never from the request body: the link proves inbox ownership (R2.4).
          const email = invitation.email;

          const existingUser = await ctx.context.internalAdapter.findUserByEmail(email);
          if (existingUser) {
            throw new APIError("CONFLICT", {
              code: "INVITATION_EMAIL_ALREADY_REGISTERED",
              message: "An account with this email already exists. Please sign in instead.",
            });
          }

          const { minPasswordLength, maxPasswordLength } = ctx.context.password.config;
          if (password.length < minPasswordLength) {
            throw new APIError("BAD_REQUEST", {
              code: "PASSWORD_TOO_SHORT",
              message: `Password must be at least ${minPasswordLength} characters.`,
            });
          }
          if (password.length > maxPasswordLength) {
            throw new APIError("BAD_REQUEST", {
              code: "PASSWORD_TOO_LONG",
              message: `Password must be at most ${maxPasswordLength} characters.`,
            });
          }

          // Hash before claiming: it has no side effects, so a throw leaves no stuck "accepted" invitation.
          const hash = await ctx.context.password.hash(password);

          // Atomic guarded update (`pending` to `accepted`) so a concurrent accept or cancel loses.
          const claimed = await ctx.context.adapter.update<InvitationRow>({
            model: "invitation",
            where: [
              { field: "id", value: invitationId },
              { field: "status", value: "pending" },
            ],
            update: { status: "accepted" },
          });
          if (!claimed) {
            throw invitationExpiredOrGoneError();
          }

          let createdUser:
            | Awaited<ReturnType<typeof ctx.context.internalAdapter.createUser>>
            | undefined;
          try {
            createdUser = await ctx.context.internalAdapter.createUser(
              { email, name, emailVerified: true },
              { method: "email-password" },
            );
            await ctx.context.internalAdapter.linkAccount({
              userId: createdUser.id,
              providerId: "credential",
              accountId: createdUser.id,
              password: hash,
            });
            await ctx.context.adapter.create({
              model: "member",
              data: {
                organizationId: invitation.organizationId,
                userId: createdUser.id,
                role: invitation.role ?? "member",
                createdAt: new Date(),
              },
            });
          } catch (error) {
            // Compensate: revert the claim and delete any half-created user. Failures are logged, never
            // masking `error`, which is always rethrown.
            try {
              await ctx.context.adapter.update({
                model: "invitation",
                where: [
                  { field: "id", value: invitationId },
                  { field: "status", value: "accepted" },
                ],
                update: { status: "pending" },
              });
            } catch (revertError) {
              console.error(
                "[invitation-sign-up] failed to revert the invitation claim after a sign-up failure; it will stay stuck as accepted with no member",
                { invitationId, revertError },
              );
            }
            if (createdUser) {
              const userId = createdUser.id;
              await ctx.context.internalAdapter.deleteUser(userId).catch((deleteError: unknown) => {
                console.error(
                  "[invitation-sign-up] failed to delete the half-created user after a sign-up failure",
                  { userId, deleteError },
                );
              });
            }
            throw error;
          }

          // No verification email: the invitation link already proved inbox ownership (R2.4).
          const session = await ctx.context.internalAdapter.createSession(createdUser.id, false, {
            activeOrganizationId: invitation.organizationId,
          });
          await setSessionCookie(ctx, { session, user: createdUser });

          // Single-use; consumed only on full success so a reverted attempt can retry.
          await ctx.context.internalAdapter.deleteVerificationByIdentifier(verificationIdentifier);

          // No native hook fires here; recorded directly so each acceptance path logs exactly one entry.
          const organization = await ctx.context.adapter.findOne<{ name: string }>({
            model: "organization",
            where: [{ field: "id", value: invitation.organizationId }],
          });
          const { ip, userAgent } = extractRequestMeta(ctx.headers ?? null);
          await auditLogger.record({
            scope: "organization",
            organizationId: invitation.organizationId,
            actorUserId: createdUser.id,
            action: "invitation.accepted",
            targetType: "invitation",
            targetId: invitation.id,
            metadata: {
              organizationName: organization?.name,
              actorEmail: createdUser.email,
              role: invitation.role ?? "member",
            },
            ip,
            userAgent,
          });

          return ctx.json({ token: session.token, user: createdUser });
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
