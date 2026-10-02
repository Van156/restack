import type { Meta, StoryObj } from "@storybook/react-vite";
import { HomeIcon, InboxIcon, SearchIcon, SettingsIcon } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@base-template/ui/components/sidebar";

const navItems = [
  { title: "Home", icon: HomeIcon, active: true },
  { title: "Inbox", icon: InboxIcon, badge: "12" },
  { title: "Search", icon: SearchIcon },
];

const settingsItems = [{ title: "Settings", icon: SettingsIcon }];

type SidebarProps = React.ComponentProps<typeof Sidebar>;

function AppSidebar(props: SidebarProps) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Acme Inc">
              <HomeIcon />
              <span>Acme Inc</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton isActive={item.active} tooltip={item.title}>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                  {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton tooltip={item.title}>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Ada Lovelace">
              <span>Ada Lovelace</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function Layout({ defaultOpen = true, ...props }: SidebarProps & { defaultOpen?: boolean }) {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar {...props} />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-3">
          <SidebarTrigger aria-label="Toggle sidebar" />
          <span className="text-xs font-medium">Dashboard</span>
        </header>
        <div className="p-4 text-xs text-muted-foreground">Page content</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

const meta = {
  title: "UI/Navigation/Sidebar",
  component: Sidebar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    // The sidebar is `position: fixed`; render docs in an iframe so it does not cover the docs page.
    docs: { story: { inline: false, iframeHeight: 420 } },
  },
  argTypes: {
    side: { control: "select", options: ["left", "right"] },
    variant: { control: "select", options: ["sidebar", "floating", "inset"] },
    collapsible: { control: "select", options: ["offcanvas", "icon", "none"] },
  },
  render: (args) => <Layout {...args} />,
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Collapsed: Story = {
  args: { collapsible: "icon" },
  render: (args) => <Layout {...args} defaultOpen={false} />,
};

export const IconCollapsible: Story = { args: { collapsible: "icon" } };

export const Right: Story = { args: { side: "right" } };

export const Floating: Story = { args: { variant: "floating" } };

export const Inset: Story = { args: { variant: "inset" } };

export const NotCollapsible: Story = { args: { collapsible: "none" } };
