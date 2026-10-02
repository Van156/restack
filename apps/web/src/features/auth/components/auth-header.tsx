import type { ReactNode } from "react";

/** Auth screen heading: optional icon, 28px title, 14px muted description. Shared by forms and status notices. */
export default function AuthHeader({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      {icon ? (
        <span
          aria-hidden="true"
          className="mb-3 flex size-10 items-center justify-center rounded-md bg-muted text-foreground [&_svg:not([class*='size-'])]:size-5"
        >
          {icon}
        </span>
      ) : null}
      <h1 className="text-[28px] leading-9 font-semibold tracking-[-0.01em]">{title}</h1>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
