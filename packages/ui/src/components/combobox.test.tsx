import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { Combobox, ComboboxInput } from "./combobox";

describe("ComboboxInput", () => {
  test("names the icon-only trigger button by default", () => {
    const html = renderToStaticMarkup(
      <Combobox>
        <ComboboxInput placeholder="Pick" />
      </Combobox>,
    );
    expect(html).toMatch(/<button[^>]*role="combobox"[^>]*aria-label="Open"/);
  });

  test("names the clear button by default", () => {
    const html = renderToStaticMarkup(
      <Combobox defaultValue="a">
        <ComboboxInput placeholder="Pick" showClear />
      </Combobox>,
    );
    expect(html).toContain('aria-label="Clear"');
  });
});
