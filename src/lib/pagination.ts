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

/** Builds a link to another page, keeping the other query parameters. */
export function pageHref(path: string, params: Record<string, string | undefined>, page: number): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  if (page > 1) qs.set("page", String(page));
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}
