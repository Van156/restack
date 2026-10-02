import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ItemGroup, ItemSeparator } from "./item";

describe("ItemSeparator", () => {
  test("is decorative so it does not break the list role's required children", () => {
    const html = renderToStaticMarkup(
      <ItemGroup>
        <ItemSeparator />
      </ItemGroup>,
    );
    expect(html).not.toContain('role="separator"');
    expect(html).toContain('role="none"');
  });

  test("does not carry aria-orientation, which role=none disallows", () => {
    const html = renderToStaticMarkup(<ItemSeparator />);
    expect(html).not.toContain("aria-orientation");
  });
});
