import { brand } from "@/app/brand";

/**
 * Brand side of the auth screen: the sidebar's ink material (`sidebar-*` tokens, identical in both
 * themes). An ink strip with logo and name below `md`; from `md` a full-height panel with the
 * tagline and legal line as well.
 */
export default function AuthBrandPanel() {
  return (
    <aside className="flex flex-col bg-sidebar px-4 py-3 text-sidebar-foreground md:p-10">
      <div className="flex items-center gap-3">
        {/* The product name sits next to the logo, so the image is decorative. */}
        <img src={brand.logo.src} alt="" width={32} height={32} className="size-6 md:size-8" />
        <span className="text-sm font-semibold md:text-base">{brand.name}</span>
      </div>
      <p className="mt-auto hidden max-w-xs text-base/relaxed text-sidebar-foreground/80 md:block">
        {brand.tagline}
      </p>
      <p className="mt-10 hidden text-xs text-sidebar-foreground/60 md:block">
        © {new Date().getFullYear()} {brand.name}
      </p>
    </aside>
  );
}
