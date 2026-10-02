import { useCallback, useState } from "react";
import type { z } from "zod";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

/**
 * The search state of a client-side table (no URL state): `search` starts at the schema's
 * defaults and `onSearchChange` (the table's complete next search, defaults omitted) replaces it
 * after the schema normalizes it. Plug both into `useDataTable`/`SimpleListTable`.
 */
export function useLocalTableSearch<TSearch>(schema: z.ZodType<TSearch>): {
  search: TSearch;
  onSearchChange: DataTableSearchChange;
} {
  const [search, setSearch] = useState(() => schema.parse({}));
  const onSearchChange = useCallback<DataTableSearchChange>(
    (next) => setSearch(schema.parse(next)),
    [schema],
  );
  return { search, onSearchChange };
}
