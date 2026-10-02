import type { Meta, StoryObj } from "@storybook/react-vite";

import { DirectionProvider } from "@base-template/ui/components/direction";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@base-template/ui/components/tabs";

const meta = {
  title: "UI/Layout/Direction",
  component: DirectionProvider,
  tags: ["autodocs"],
  args: { direction: "ltr", children: null },
  argTypes: { direction: { control: "inline-radio", options: ["ltr", "rtl"] } },
  render: ({ direction }) => (
    <div dir={direction} lang={direction === "rtl" ? "ar" : "en"}>
      <DirectionProvider direction={direction}>
        <Tabs defaultValue="account" className="w-72">
          <TabsList>
            <TabsTrigger value="account">{direction === "rtl" ? "الحساب" : "Account"}</TabsTrigger>
            <TabsTrigger value="password">
              {direction === "rtl" ? "كلمة المرور" : "Password"}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="account" className="text-sm">
            {direction === "rtl" ? "إدارة إعدادات حسابك." : "Manage your account settings."}
          </TabsContent>
          <TabsContent value="password" className="text-sm">
            {direction === "rtl" ? "غيّر كلمة المرور." : "Change your password."}
          </TabsContent>
        </Tabs>
      </DirectionProvider>
    </div>
  ),
} satisfies Meta<typeof DirectionProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LeftToRight: Story = {};

export const RightToLeft: Story = { args: { direction: "rtl" } };
