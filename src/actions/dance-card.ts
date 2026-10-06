"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { danceCard } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { cleanAnswer, DANCE_CARD_FIELDS, maxAnswerLength } from "@/lib/dance-card";
import { assertMember } from "@/lib/session";

export async function saveDanceCard(input: Record<string, string>): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertMember();
    const data = z.record(z.string(), z.string().max(2000)).parse(input);
    const clean: Record<string, string> = {};
    for (const field of DANCE_CARD_FIELDS) {
      const value = cleanAnswer(data[field.key] ?? "");
      if (!value) continue;
      const max = maxAnswerLength(field);
      if (value.length > max) {
        throw new UserError(`"${field.label}" is too long for the card: keep it under ${max} characters.`);
      }
      clean[field.key] = value;
    }
    await db
      .insert(danceCard)
      .values({ memberId: me.id, data: clean })
      .onConflictDoUpdate({ target: danceCard.memberId, set: { data: clean } });
    refresh();
    return null;
  });
}
