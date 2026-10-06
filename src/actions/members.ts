"use server";

import { eq } from "drizzle-orm";
import Papa from "papaparse";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { member, session, user } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { isUniqueViolation } from "@/lib/db-errors";
import { createMember, memberInputSchema } from "@/lib/members";
import { getDefaultPassword, hashPassword } from "@/lib/passwords";
import { assertCap } from "@/lib/session";

export async function addMember(
  input: z.input<typeof memberInputSchema>,
  isChapterMember = true,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const me = await assertCap("members.manage");
    const data = memberInputSchema.parse(input);
    const id = await createMember({ ...data, isChapterMember: z.boolean().parse(isChapterMember) });
    await audit({ actorId: me.id, action: "member.create", entity: "member", entityId: id, after: data });
    refresh();
    return { id };
  });
}

export async function updateMember(
  id: string,
  input: z.input<typeof memberInputSchema>,
  isChapterMember?: boolean,
): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("members.manage");
    const data = memberInputSchema.parse(input);
    const chapterMember = z.boolean().optional().parse(isChapterMember);
    const [before] = await db.select().from(member).where(eq(member.id, id));
    if (!before) throw new UserError("Member not found.");
    try {
      await db.transaction(async (tx) => {
        await tx
          .update(member)
          .set({
            fullName: data.fullName,
            email: data.email,
            phone: data.phone,
            businessName: data.businessName,
            category: data.category,
            joinedOn: data.joinedOn,
            ...(chapterMember === undefined ? {} : { isChapterMember: chapterMember }),
          })
          .where(eq(member.id, id));
        await tx.update(user).set({ name: data.fullName, email: data.email }).where(eq(user.id, id));
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new UserError("Another member already uses this email or phone.");
      throw error;
    }
    await audit({
      actorId: me.id,
      action: "member.update",
      entity: "member",
      entityId: id,
      before: { fullName: before.fullName, email: before.email, phone: before.phone, isChapterMember: before.isChapterMember },
      after: { ...data, isChapterMember: chapterMember },
    });
    refresh();
    return null;
  });
}

/** Deactivated members can't sign in and are no longer expected at meetings. */
export async function setMemberStatus(id: string, status: "active" | "inactive"): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("members.manage");
    if (id === me.id) throw new UserError("You can't change your own status.");
    await db.update(member).set({ status }).where(eq(member.id, id));
    if (status === "inactive") await db.delete(session).where(eq(session.userId, id));
    await audit({ actorId: me.id, action: `member.${status}`, entity: "member", entityId: id });
    refresh();
    return null;
  });
}

const HEADER_ALIASES: Record<string, keyof z.input<typeof memberInputSchema>> = {
  name: "fullName",
  "full name": "fullName",
  fullname: "fullName",
  "member name": "fullName",
  email: "email",
  "email address": "email",
  phone: "phone",
  mobile: "phone",
  "mobile number": "phone",
  "phone number": "phone",
  company: "businessName",
  business: "businessName",
  "business name": "businessName",
  "company name": "businessName",
  category: "category",
  classification: "category",
  profession: "category",
  "joined on": "joinedOn",
  joined: "joinedOn",
};

export type ImportReport = { created: number; skipped: { row: number; reason: string }[] };

/**
 * Imports members from CSV (BNI Connect roster export saved as CSV works).
 * Recognised headers: name, email, phone/mobile, company/business, category/
 * classification, joined on. Existing emails are skipped, not overwritten.
 */
export async function importMembersCsv(csv: string): Promise<ActionResult<ImportReport>> {
  return runAction(async () => {
    const me = await assertCap("members.manage");
    if (csv.length > 500_000) throw new UserError("That file is too large.");
    const parsed = Papa.parse<Record<string, string>>(csv.replace(/^﻿/, ""), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });
    const fields = parsed.meta.fields ?? [];
    if (!fields.some((f) => HEADER_ALIASES[f] === "email") || !fields.some((f) => HEADER_ALIASES[f] === "fullName")) {
      throw new UserError("The CSV needs at least a Name column and an Email column.");
    }
    const report: ImportReport = { created: 0, skipped: [] };
    // Everyone starts on the default password: hash it once for the whole file.
    const passwordHash = await hashPassword(await getDefaultPassword());
    for (const [i, raw] of parsed.data.entries()) {
      const mapped: Record<string, string> = {};
      for (const [key, value] of Object.entries(raw)) {
        const target = HEADER_ALIASES[key];
        if (target && value?.trim()) mapped[target] = value.trim();
      }
      const result = memberInputSchema.safeParse(mapped);
      if (!result.success) {
        report.skipped.push({ row: i + 2, reason: result.error.issues[0]?.message ?? "invalid row" });
        continue;
      }
      try {
        await createMember(result.data, { passwordHash });
        report.created++;
      } catch (error) {
        report.skipped.push({ row: i + 2, reason: error instanceof UserError ? "already exists" : "could not save" });
      }
    }
    await audit({ actorId: me.id, action: "member.import_csv", entity: "member", after: report });
    refresh();
    return report;
  });
}
