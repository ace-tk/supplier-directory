import { useMemo, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";

/**
 * Generic client-side search + single-select filter for admin list pages.
 * `matches` decides whether a row satisfies the current search query;
 * `filterValue`/`getFilterKey` are optional and only needed when the page
 * also exposes a dropdown filter (status, category, channel, ...).
 */
export function useSearchFilter<T>(
  items: T[],
  matches: (item: T, query: string) => boolean,
  getFilterKey?: (item: T) => string
) {
  const [search, setSearch] = useState("");
  const [filterValue, setFilterValue] = useState<string>("all");
  const debouncedSearch = useDebounce(search, 250);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = debouncedSearch.trim() === "" || matches(item, debouncedSearch.trim().toLowerCase());
      const matchesFilter =
        !getFilterKey || filterValue === "all" || getFilterKey(item) === filterValue;
      return matchesSearch && matchesFilter;
    });
  }, [items, debouncedSearch, matches, getFilterKey, filterValue]);

  return { search, setSearch, filterValue, setFilterValue, filtered };
}
