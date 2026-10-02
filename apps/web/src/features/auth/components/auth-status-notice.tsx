import type { ReactNode } from "react";

import AuthHeader from "./auth-header";

/** Icon + title + description with an optional action slot (`children`), for terminal auth states (link sent, link invalid, password updated). Same type scale as the form header. */
export default function AuthStatusNotice({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  description: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <AuthHeader icon={icon} title={title} description={description} />
      {children ? <div className="flex flex-col items-start gap-3">{children}</div> : null}
    </div>
  );
}
