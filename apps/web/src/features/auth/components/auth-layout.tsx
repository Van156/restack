import type { ReactNode } from "react";

import AuthBrandPanel from "./auth-brand-panel";

/**
 * Split auth screen. From `md` the ink brand panel takes ~40% and the form column ~60% (form
 * left-aligned, vertically centered); below `md` the panel collapses to a strip above the form.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh grid-cols-1 grid-rows-[auto_1fr] bg-background md:grid-cols-[2fr_3fr] md:grid-rows-1">
      <AuthBrandPanel />
      <main className="flex items-start px-4 py-8 md:items-center md:px-12 md:py-10 lg:px-20">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
