import { Alert, AlertTitle } from "@base-template/ui/components/alert";
import { OctagonAlertIcon } from "lucide-react";

/** Inline destructive alert for server errors, rendered above the submit button (`role="alert"` comes from `Alert`). */
export default function AuthFormError({ message }: { message: string }) {
  return (
    <Alert variant="destructive" className="border-none bg-destructive/10">
      <OctagonAlertIcon />
      <AlertTitle>{message}</AlertTitle>
    </Alert>
  );
}
