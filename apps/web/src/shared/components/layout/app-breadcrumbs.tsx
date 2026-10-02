import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@base-template/ui/components/breadcrumb";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";

import type { Breadcrumb as BreadcrumbItemData } from "@/shared/lib/navigation";

/**
 * Header breadcrumb trail. Earlier crumbs are hidden below `md` (like the
 * reference dashboard); the last crumb is the current page. Renders nothing for
 * an empty trail.
 */
export default function AppBreadcrumbs({ items }: { items: readonly BreadcrumbItemData[] }) {
  if (items.length === 0) {
    return null;
  }
  const lastIndex = items.length - 1;
  return (
    <Breadcrumb>
      <BreadcrumbList className="text-[13px]">
        {items.map((item, index) => {
          const isLast = index === lastIndex;
          return (
            <Fragment key={`${item.label}-${index}`}>
              <BreadcrumbItem className={isLast ? undefined : "hidden md:block"}>
                {isLast || !item.to ? (
                  isLast ? (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  ) : (
                    <span>{item.label}</span>
                  )
                ) : (
                  <BreadcrumbLink render={<Link to={item.to} />}>{item.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {isLast ? null : <BreadcrumbSeparator className="hidden md:block" />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
