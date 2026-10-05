"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { danceCard } from "@/db/schema";
import { type ActionResult, runAction } from "@/lib/action";
import { templateKeys } from "@/lib/dance-card";
import { assertMember } from "@/lib/session";
import { getDanceCardTemplate } from "@/lib/settings";

export async function saveDanceCard(input: Record<string, string>): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertMember();
    const template = await getDanceCardTemplate();
    const allowed = new Set(templateKeys(template));
    const data = z.record(z.string(), z.string().max(2000)).parse(input);
    const clean = Object.fromEntries(
      Object.entries(data)
        .filter(([k]) => allowed.has(k))
        .map(([k, v]) => [k, v.trim()]),
    );
    await db
      .insert(danceCard)
      .values({ memberId: me.id, data: clean })
      .onConflictDoUpdate({ target: danceCard.memberId, set: { data: clean } });
    refresh();
    return null;
  });
}
