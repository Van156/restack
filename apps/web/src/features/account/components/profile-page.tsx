import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { betterAuthErrorMessage } from "@/features/auth";
import Loader from "@/shared/components/feedback/loader";

import ProfileForm from "./profile-form";

/**
 * `/account/profile` (R1.3, container). `updateUser` makes the client refresh the shared session
 * atom (`/update-user` is a session-signal path), so the user menu and this form re-render with
 * the new name.
 */
export default function ProfilePage() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Loader />;
  }
  if (!session) {
    return null;
  }

  async function saveName(name: string) {
    const { error } = await authClient.updateUser({ name });
    if (error) {
      throw new Error(betterAuthErrorMessage(error, "Could not update your name."));
    }
    toast.success("Profile updated");
  }

  const { user } = session;
  return <ProfileForm key={user.id} name={user.name} email={user.email} onSave={saveName} />;
}
