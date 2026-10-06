import { loadDanceCard } from "@/lib/dance-card-data";
import { renderDanceCardPdf } from "@/lib/dance-card-pdf";
import { getCurrentMember } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The member's answers written onto the chapter's printed dance card. */
export async function GET(_req: Request, ctx: RouteContext<"/api/dance-card/[memberId]/pdf">) {
  if (!(await getCurrentMember())) return new Response("Unauthorized", { status: 401 });
  const { memberId } = await ctx.params;
  const card = await loadDanceCard(memberId);
  if (!card) return new Response("Not found", { status: 404 });

  const pdf = await renderDanceCardPdf(card.answers, card.member.name);
  const filename = `dance-card-${card.member.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
