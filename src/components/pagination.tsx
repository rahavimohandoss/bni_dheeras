import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { pageItems } from "@/lib/pagination";
import { cn } from "@/lib/utils";

/*
 * No "use client" on purpose: server pages pass `href` (a function), which
 * can't cross into a client component. Client lists use PaginationButtons
 * from this same file; it ends up in their client bundle.
 */

type PagerProps = {
  page: number;
  pageCount: number;
  /** With pageSize, shows "Showing 21–40 of 230". */
  total?: number;
  pageSize?: number;
  /** Shown instead of "Showing …", e.g. the months on this page. */
  summary?: React.ReactNode;
  className?: string;
};

type Target = { page: number; label: string; current?: boolean; disabled?: boolean; children: React.ReactNode };

function Pager({
  page,
  pageCount,
  total,
  pageSize,
  summary,
  className,
  target,
}: PagerProps & { target: (t: Target) => React.ReactNode }) {
  if (pageCount <= 1) return null;
  const from = pageSize ? (page - 1) * pageSize + 1 : 0;
  const to = pageSize && total !== undefined ? Math.min(page * pageSize, total) : 0;
  return (
    <nav aria-label="Pages" className={cn("mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2", className)}>
      {summary ? (
        <p className="text-sm text-muted-foreground">{summary}</p>
      ) : total !== undefined && pageSize ? (
        <p className="text-sm text-muted-foreground tabular-nums">
          Showing {from}–{to} of {total}
        </p>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap items-center gap-1">
        {target({ page: page - 1, label: "Previous page", disabled: page <= 1, children: <ChevronLeftIcon /> })}
        {pageItems(page, pageCount).map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} className="w-6 text-center text-muted-foreground" aria-hidden>
              …
            </span>
          ) : (
            <Fragment key={p}>{target({ page: p, label: `Page ${p}`, current: p === page, children: p })}</Fragment>
          ),
        )}
        {target({ page: page + 1, label: "Next page", disabled: page >= pageCount, children: <ChevronRightIcon /> })}
      </div>
    </nav>
  );
}

const pageButton = "min-w-8 justify-center px-2 tabular-nums";

/** Numbered page links for a server-rendered list (`?page=`). Hidden when everything fits on one page. */
export function Pagination({ href, ...props }: PagerProps & { href: (page: number) => string }) {
  return (
    <Pager
      {...props}
      target={(t) =>
        t.disabled ? (
          <Button variant="outline" className={pageButton} disabled aria-label={t.label}>
            {t.children}
          </Button>
        ) : (
          <Button asChild variant={t.current ? "default" : "outline"} className={pageButton}>
            <Link href={href(t.page)} aria-label={t.label} aria-current={t.current ? "page" : undefined}>
              {t.children}
            </Link>
          </Button>
        )
      }
    />
  );
}

/** The same control for a list paged in the browser. Scrolls back to the top on a page change. */
export function PaginationButtons({ onPageChange, ...props }: PagerProps & { onPageChange: (page: number) => void }) {
  return (
    <Pager
      {...props}
      target={(t) => (
        <Button
          type="button"
          variant={t.current ? "default" : "outline"}
          className={pageButton}
          disabled={t.disabled}
          aria-label={t.label}
          aria-current={t.current ? "page" : undefined}
          onClick={() => {
            onPageChange(t.page);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          {t.children}
        </Button>
      )}
    />
  );
}
