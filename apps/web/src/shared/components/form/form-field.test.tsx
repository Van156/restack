import { describe, expect, test } from "bun:test";
import type { AnyFieldApi } from "@tanstack/react-form";
import { renderToStaticMarkup } from "react-dom/server";

import FormField from "./form-field";

function fakeField(errors: unknown[], value = ""): AnyFieldApi {
  return {
    name: "slug",
    state: { value, meta: { errors } },
    handleBlur: () => {},
    handleChange: () => {},
  } as unknown as AnyFieldApi;
}

function render(errors: unknown[], description?: string) {
  return renderToStaticMarkup(
    <FormField field={fakeField(errors)} label="Slug" description={description}>
      {(control) => <input {...control} />}
    </FormField>,
  );
}

describe("FormField", () => {
  test("renders the label bound to the control and no error when valid", () => {
    const html = render([]);
    expect(html).toContain('for="slug"');
    expect(html).toContain('id="slug"');
    expect(html).not.toContain("aria-invalid");
    expect(html).not.toContain('role="alert"');
  });

  test("shows the first error, marks the control invalid and points aria-describedby at it", () => {
    const html = render([{ message: "Too short" }, { message: "Bad chars" }]);
    expect(html).toContain("Too short");
    expect(html).not.toContain("Bad chars");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="slug-error"');
    expect(html).toContain('id="slug-error"');
  });

  test("handles string errors and skips empty gaps", () => {
    const html = render([undefined, "Required"]);
    expect(html).toContain("Required");
  });

  test("dedupes repeated messages so a single error renders as text, not a list", () => {
    const html = render(["Too short", { message: "Too short" }]);
    expect(html).toContain("Too short");
    expect(html).not.toContain("<ul");
  });

  test("references both description and error in aria-describedby", () => {
    const html = render(["Required"], "Lowercase only");
    expect(html).toContain("Lowercase only");
    expect(html).toContain('aria-describedby="slug-description slug-error"');
  });

  test("references only the description when valid", () => {
    const html = render([], "Lowercase only");
    expect(html).toContain('aria-describedby="slug-description"');
  });
});
