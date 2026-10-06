/** Reads `?page=` (1-based); anything invalid is page 1. */
export function pageFromParam(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/** Clamps the page to what exists and returns the SQL offset for it. */
export function paginate(page: number, total: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  return { page: current, pageCount, offset: (current - 1) * pageSize };
}

/**
 * Builds a link to another page, keeping the other query parameters. `key` is
 * the page parameter's name, for pages with two lists (e.g. `wp` and `ap`).
 */
export function pageHref(path: string, params: Record<string, string | undefined>, page: number, key = "page"): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v && k !== key) qs.set(k, v);
  if (page > 1) qs.set(key, String(page));
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

/**
 * The page buttons to show: all of them up to 7 pages, otherwise the first,
 * the last and the current page's neighbours, e.g. 1 … 4 5 6 … 12. A gap
 * always hides at least two pages.
 */
export function pageItems(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, "gap", pageCount];
  if (page >= pageCount - 3) return [1, "gap", pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
  return [1, "gap", page - 1, page, page + 1, "gap", pageCount];
}
