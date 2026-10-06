"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { member, memberProfile } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { normalizePhone } from "@/lib/members";
import { assertMember } from "@/lib/session";
import { isSafeKey } from "@/lib/storage";

/** Accepts "example.com" or a full URL; stores https URLs only. */
const url = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try {
      const u = new URL(withScheme);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
      return u.toString();
    } catch {
      ctx.addIssue({ code: "custom", message: `"${v}" is not a valid link` });
      return z.NEVER;
    }
  });

/** YYYY-MM-DD from a date input; empty clears it. Never in the future. */
const pastDate = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const d = new Date(`${v}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(d.getTime()) || d.getUTCFullYear() < 1900) {
        ctx.addIssue({ code: "custom", message: `${label} is not a valid date` });
        return z.NEVER;
      }
      if (d > new Date()) {
        ctx.addIssue({ code: "custom", message: `${label} can't be in the future` });
        return z.NEVER;
      }
      return v;
    });

const profileSchema = z.object({
  businessName: z.string().trim().max(160).optional().transform((v) => v || null),
  about: z.string().trim().max(1200).optional().transform((v) => v || null),
  website: url,
  whatsapp: z.string().trim().max(20).optional().transform((v) => normalizePhone(v)),
  videoUrl: url,
  instagram: url,
  facebook: url,
  linkedin: url,
  youtube: url,
  x: url,
  dateOfBirth: pastDate("Date of birth"),
  anniversaryDate: pastDate("Anniversary"),
});

export async function saveProfile(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertMember();
    const d = profileSchema.parse(input);
    const socials = Object.fromEntries(
      (["instagram", "facebook", "linkedin", "youtube", "x"] as const).filter((k) => d[k]).map((k) => [k, d[k]!]),
    );
    const values = {
      about: d.about,
      website: d.website,
      whatsapp: d.whatsapp,
      videoUrl: d.videoUrl,
      socials,
      dateOfBirth: d.dateOfBirth,
      anniversaryDate: d.anniversaryDate,
    };
    await db
      .insert(memberProfile)
      .values({ memberId: me.id, ...values })
      .onConflictDoUpdate({ target: memberProfile.memberId, set: values });
    await db.update(member).set({ businessName: d.businessName }).where(eq(member.id, me.id));
    refresh();
    return null;
  });
}

export async function setMyImage(kind: "photo" | "logo", key: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertMember();
    if (!isSafeKey(key) || !key.startsWith(`members/${me.id}/${kind}-`)) throw new UserError("Invalid image.");
    if (kind === "photo") {
      await db.update(member).set({ photoKey: key }).where(eq(member.id, me.id));
    } else {
      await db
        .insert(memberProfile)
        .values({ memberId: me.id, logoKey: key })
        .onConflictDoUpdate({ target: memberProfile.memberId, set: { logoKey: key } });
    }
    refresh();
    return null;
  });
}
