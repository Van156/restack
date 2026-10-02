import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import EmptyState from "./empty-state";

describe("EmptyState", () => {
  test("renders only the title when nothing optional is given", () => {
    const html = renderToStaticMarkup(<EmptyState title="Nothing here" />);
    expect(html).toContain("Nothing here");
    expect(html).not.toContain('data-slot="empty-icon"');
    expect(html).not.toContain('data-slot="empty-content"');
    expect(html).not.toContain('data-slot="empty-description"');
  });

  test("renders the optional description, icon and action when given", () => {
    const html = renderToStaticMarkup(
      <EmptyState
        title="No members"
        description="Invite someone to get started."
        icon={<svg data-testid="icon" />}
        action={<button type="button">Invite</button>}
      />,
    );
    expect(html).toContain("Invite someone to get started.");
    expect(html).toContain('data-testid="icon"');
    expect(html).toContain('data-slot="empty-icon"');
    expect(html).toContain(">Invite</button>");
  });
});
