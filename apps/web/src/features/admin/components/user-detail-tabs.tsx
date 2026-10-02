import { Tabs, TabsContent, TabsList, TabsTrigger } from "@base-template/ui/components/tabs";
import type { ReactNode } from "react";

import { USER_DETAIL_TABS, type UserDetailTab } from "../lib/user-detail-search";

const TAB_LABELS: Record<UserDetailTab, string> = { details: "Details", activity: "Activity" };

/**
 * Tab frame of the admin user page. The selected tab is controlled by the caller (it lives in the
 * URL) and only the selected panel is mounted, so the Activity query runs only when it is open.
 */
export default function UserDetailTabs({
  tab,
  onTabChange,
  details,
  activity,
}: {
  tab: UserDetailTab;
  onTabChange: (tab: UserDetailTab) => void;
  details: ReactNode;
  activity: ReactNode;
}) {
  const panels: Record<UserDetailTab, ReactNode> = { details, activity };
  return (
    <Tabs
      value={tab}
      onValueChange={(next) => {
        if (USER_DETAIL_TABS.some((candidate) => candidate === next)) {
          onTabChange(next as UserDetailTab);
        }
      }}
    >
      <TabsList>
        {USER_DETAIL_TABS.map((value) => (
          <TabsTrigger key={value} value={value}>
            {TAB_LABELS[value]}
          </TabsTrigger>
        ))}
      </TabsList>
      {USER_DETAIL_TABS.map((value) => (
        <TabsContent key={value} value={value} className="pt-4">
          {panels[value]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
