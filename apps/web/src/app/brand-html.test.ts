import { describe, expect, test } from "bun:test";

import { injectBrandTitle } from "./brand-html";

describe("injectBrandTitle", () => {
  test("fills the empty title with the brand name", () => {
    expect(injectBrandTitle("<head><title></title></head>", "Acme")).toBe(
      "<head><title>Acme</title></head>",
    );
  });

  test("escapes HTML in the brand name", () => {
    expect(injectBrandTitle("<title></title>", `A&B <"x"> 'y'`)).toBe(
      "<title>A&amp;B &lt;&quot;x&quot;&gt; &#39;y&#39;</title>",
    );
  });

  test("does not interpret replacement patterns in the name", () => {
    expect(injectBrandTitle("<title></title>", "$& Co")).toBe("<title>$&amp; Co</title>");
  });

  test("throws when the title sentinel is missing", () => {
    expect(() => injectBrandTitle("<title>Already set</title>", "Acme")).toThrow(/brand-html/);
  });
});
