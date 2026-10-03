import type { Meta, StoryObj } from "@storybook/react-vite";

import InviteStaffForm from "./invite-staff-form";

const meta = {
  title: "App/Staff/InviteStaffForm",
  component: InviteStaffForm,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[36rem]">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "centered" },
  args: {
    values: { email: "", role: "", locationIds: [] },
    errors: {},
    roles: [{ name: "admin" }, { name: "cashier" }, { name: "waiter" }],
    locations: [
      { id: "l1", name: "Centro" },
      { id: "l2", name: "Norte" },
    ],
    isPending: false,
    onChange: () => {},
    onSubmit: () => {},
  },
} satisfies Meta<typeof InviteStaffForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithErrors: Story = {
  args: {
    errors: {
      email: "Escribe un correo válido.",
      role: "Elige un rol.",
      locationIds: "Elige al menos un local.",
    },
  },
};

/** The caller cannot assign any Role. */
export const NoAssignableRoles: Story = { args: { roles: [] } };
