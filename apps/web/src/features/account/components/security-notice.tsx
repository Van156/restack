import { Alert, AlertDescription } from "@base-template/ui/components/alert";
import { CircleCheckIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Inline positive confirmation shown under a security form (`role="status"`, announced politely). */
export default function SecurityNotice({ children }: { children: ReactNode }) {
  return (
    <Alert role="status">
      <CircleCheckIcon />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
