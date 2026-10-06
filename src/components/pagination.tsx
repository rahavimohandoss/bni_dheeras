import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Previous / next links for a server-rendered list (`?page=`). Hidden when everything fits on one page. */
export function Pagination({ page, pageCount, href }: { page: number; pageCount: number; href: (page: number) => string }) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-2 text-sm">
      {page > 1 ? (
        <Button asChild variant="outline" size="sm">
          <Link href={href(page - 1)}>
            <ChevronLeftIcon /> Previous
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground tabular-nums">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Button asChild variant="outline" size="sm">
          <Link href={href(page + 1)}>
            Next <ChevronRightIcon />
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}
