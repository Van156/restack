import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { PinPad } from "./pin-pad";

describe("PinPad", () => {
  test("starts empty with the confirm action disabled", () => {
    const html = renderToStaticMarkup(<PinPad onSubmit={() => {}} />);
    expect(html).toContain("0 de 6 dígitos");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Confirmar/);
  });

  test("announces an error through an alert", () => {
    const html = renderToStaticMarkup(<PinPad onSubmit={() => {}} status="error" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("PIN incorrecto");
  });

  test("disables every key when locked and shows the lock message", () => {
    const html = renderToStaticMarkup(
      <PinPad onSubmit={() => {}} status="locked" message="Bloqueado 5 min" />,
    );
    expect(html).toContain("Bloqueado 5 min");
    expect(html.match(/<button/g)?.length).toBe(html.match(/<button[^>]*disabled/g)?.length);
  });
});
