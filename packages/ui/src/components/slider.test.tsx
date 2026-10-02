import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { Slider } from "./slider";

function countThumbs(html: string): number {
  return html.split('data-slot="slider-thumb"').length - 1;
}

describe("Slider", () => {
  test("renders one thumb for a scalar value", () => {
    expect(countThumbs(renderToStaticMarkup(<Slider aria-label="Volume" value={40} />))).toBe(1);
    expect(
      countThumbs(renderToStaticMarkup(<Slider aria-label="Volume" defaultValue={40} />)),
    ).toBe(1);
  });

  test("renders one thumb when no value is given", () => {
    expect(countThumbs(renderToStaticMarkup(<Slider aria-label="Volume" />))).toBe(1);
  });

  test("renders one thumb per entry of a range value", () => {
    expect(
      countThumbs(renderToStaticMarkup(<Slider aria-label="Price" defaultValue={[25, 75]} />)),
    ).toBe(2);
    expect(
      countThumbs(renderToStaticMarkup(<Slider aria-label="Price" value={[10, 50, 90]} />)),
    ).toBe(3);
  });

  test("renders no thumbs for an empty range value", () => {
    expect(countThumbs(renderToStaticMarkup(<Slider aria-label="Price" value={[]} />))).toBe(0);
  });

  test("labels the thumb input with the slider aria-label", () => {
    const html = renderToStaticMarkup(<Slider aria-label="Volume" defaultValue={40} />);
    expect(html).toContain('type="range"');
    expect(html).toMatch(/<input[^>]*aria-label="Volume"/);
  });

  test("gives each range thumb a distinguishable name", () => {
    const html = renderToStaticMarkup(<Slider aria-label="Price" defaultValue={[25, 75]} />);
    expect(html).toMatch(/<input[^>]*aria-label="Price start"/);
    expect(html).toMatch(/<input[^>]*aria-label="Price end"/);
  });

  test("numbers thumbs when a range has more than two", () => {
    const html = renderToStaticMarkup(<Slider aria-label="Mix" defaultValue={[10, 50, 90]} />);
    expect(html).toMatch(/<input[^>]*aria-label="Mix 3"/);
  });
});
