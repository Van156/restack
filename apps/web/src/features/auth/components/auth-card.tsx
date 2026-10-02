import type { ReactNode } from "react";

import AuthHeader from "./auth-header";

/**
 * Form column content of an auth screen: an optional `title`/`description` header above
 * `children`. Inputs and buttons inside opt into the large (h-10) size with `size="lg"`.
 */
export default function AuthCard({
  title,
  description,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8">
      {title || description ? <AuthHeader title={title} description={description} /> : null}
      {children}
    </div>
  );
}
