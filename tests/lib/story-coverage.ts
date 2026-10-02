/**
 * Given the file names in `packages/ui/src/components`, returns the names of
 * components (`<name>.tsx`, excluding stories and tests) that have no sibling
 * `<name>.stories.tsx`. Pure so it can be tested with fixtures.
 */
export function findUiComponentsWithoutStories(fileNames: readonly string[]): string[] {
  const files = new Set(fileNames);
  return fileNames
    .filter((file) => file.endsWith(".tsx") && !/\.(stories|test)\.tsx$/.test(file))
    .map((file) => file.slice(0, -".tsx".length))
    .filter((name) => !files.has(`${name}.stories.tsx`))
    .sort();
}

/**
 * Given registered app component paths (`.../<name>.tsx`), returns those whose file
 * is missing, that are not a plain `.tsx` component (such entries would never match a
 * story), or that have no sibling `<name>.stories.tsx`. `exists` is injected so the
 * check stays pure.
 */
export function findAppComponentsWithoutStories(
  registered: readonly string[],
  exists: (path: string) => boolean,
): string[] {
  return registered
    .filter(
      (path) =>
        !path.endsWith(".tsx") ||
        /\.(stories|test)\.tsx$/.test(path) ||
        !exists(path) ||
        !exists(path.replace(/\.tsx$/, ".stories.tsx")),
    )
    .toSorted();
}
