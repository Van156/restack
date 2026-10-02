# Prototype lab

A dev-only, login-free playground for comparing several structurally different UI variants of an idea before specifying it. Variants use `@base-template/ui` components and in-memory mock data (no API, no auth). In production builds `/prototype` resolves to not-found and the switcher renders nothing.

## Run it

```sh
pnpm dev:web
```

Open `/prototype` for the catalog, or `/prototype/example?variant=B` directly. Use the bottom pill or the left/right arrow keys to cycle variants; the choice lives in the `?variant=` search param.

## Add a prototype

1. Copy `example.tsx` and the `-example-*` files to `<name>.tsx` and `-<name>-*` files (files starting with `-` are ignored by the router).
2. Write 3 variants (never more than 5) that differ in layout, information hierarchy and primary affordance, not just colour. Export each as a named component (`VariantA`, ...).
3. Put mock data in `-<name>-mock-data.ts`. Actions are local stubs (for example a `sonner` toast); never call oRPC or auth.
4. Define the variants (`{ key, name }`), pass them to `variantSearch(...)` in `validateSearch`, and render `<PrototypeSwitcher variants={...} current={variant} />`.
5. Register the prototype in `-registry.ts` so it shows up in the catalog.

## Throwaway rule

- Each idea's prototype lives on its own `prototype/<name>` branch. Do not merge it into `main`.
- When a variant wins, rewrite it properly into the real feature code (prototype code has no tests or error handling), then keep the full variant set on the throwaway branch.
- `main` keeps only the lab infrastructure and the example.

## Logic-only questions

If the question is about state or logic rather than looks, do not build a UI variant. Use a standalone HTML prototype as described in `.claude/skills/prototype/LOGIC.md`.
