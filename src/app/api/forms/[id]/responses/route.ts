import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { form, formResponse, member } from "@/db/schema";
import { toCsv } from "@/lib/csv";
import { answerText } from "@/lib/forms";
import { getCurrentMember } from "@/lib/session";
import { formatDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/forms/[id]/responses">) {
  const me = await getCurrentMember();
  if (!me?.caps.has("forms.manage")) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const [f] = await db.select().from(form).where(eq(form.id, id));
  if (!f) return new Response("Not found", { status: 404 });
  const rows = await db
    .select({ response: formResponse, memberName: member.fullName })
    .from(formResponse)
    .leftJoin(member, eq(member.id, formResponse.memberId))
    .where(eq(formResponse.formId, f.id))
    .orderBy(asc(formResponse.createdAt));
  const csv = toCsv([
    ["Submitted", "Member", ...f.fields.map((q) => q.label)],
    ...rows.map(({ response: r, memberName }) => [
      formatDateTime(r.createdAt),
      memberName ?? "",
      ...f.fields.map((q) => answerText(r.data[q.id])),
    ]),
  ]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${f.slug}-responses.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
