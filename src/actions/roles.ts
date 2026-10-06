"use server";

import { and, eq, gte, lte, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { member, roleAssignment, term } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { isRole, type Role, roleConflict, ROLES } from "@/lib/permissions";
import { assertCap } from "@/lib/session";
import { toIstDateInput } from "@/lib/time";

const termSchema = z
  .object({
    name: z.string().trim().min(3).max(60),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((t) => t.endsOn > t.startsOn, { message: "The term must end after it starts." });

/** Terms mustn't overlap: on any day exactly one term (and so one President) applies. */
async function assertNoOverlap(data: { startsOn: string; endsOn: string }, exceptId?: string) {
  const [clash] = await db
    .select({ name: term.name })
    .from(term)
    .where(
      and(
        lte(term.startsOn, data.endsOn),
        gte(term.endsOn, data.startsOn),
        exceptId ? ne(term.id, exceptId) : undefined,
      ),
    )
    .limit(1);
  if (clash) throw new UserError(`These dates overlap with the term "${clash.name}".`);
}

export async function createTerm(input: z.input<typeof termSchema>, copyFromTermId?: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const me = await assertCap("roles.manage");
    const data = termSchema.parse(input);
    await assertNoOverlap(data);
    const [row] = await db.insert(term).values(data).returning({ id: term.id });
    if (copyFromTermId) {
      const previous = await db.select().from(roleAssignment).where(eq(roleAssignment.termId, copyFromTermId));
      if (previous.length) {
        await db
          .insert(roleAssignment)
          .values(previous.map((p) => ({ termId: row.id, memberId: p.memberId, role: p.role })))
          .onConflictDoNothing();
      }
    }
    await audit({ actorId: me.id, action: "term.create", entity: "term", entityId: row.id, after: data });
    refresh();
    return { id: row.id };
  });
}

export async function updateTerm(id: string, input: z.input<typeof termSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("roles.manage");
    const termId = z.uuid().parse(id);
    const data = termSchema.parse(input);
    const [before] = await db.select().from(term).where(eq(term.id, termId));
    if (!before) throw new UserError("Term not found.");
    await assertNoOverlap(data, termId);
    await db.update(term).set(data).where(eq(term.id, termId));
    await audit({ actorId: me.id, action: "term.update", entity: "term", entityId: termId, before, after: data });
    refresh();
    return null;
  });
}

/** Deletes a term and its role list. The term covering today can't be deleted (its President would lose access). */
export async function deleteTerm(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("roles.manage");
    const [row] = await db.select().from(term).where(eq(term.id, z.uuid().parse(id)));
    if (!row) throw new UserError("Term not found.");
    const today = toIstDateInput(new Date());
    if (row.startsOn <= today && row.endsOn >= today) {
      throw new UserError("This is the current term. Create and fill the next term instead of deleting this one.");
    }
    await db.delete(term).where(eq(term.id, row.id));
    await audit({ actorId: me.id, action: "term.delete", entity: "term", entityId: row.id, before: row });
    refresh();
    return null;
  });
}

export async function assignRole(termId: string, memberId: string, role: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("roles.manage");
    if (!isRole(role)) throw new UserError("Unknown role.");
    const existing = await db
      .select({ role: roleAssignment.role })
      .from(roleAssignment)
      .where(and(eq(roleAssignment.termId, termId), eq(roleAssignment.memberId, memberId)));
    const roles = [...existing.map((r) => r.role).filter(isRole), role] as Role[];
    const conflict = roleConflict(roles);
    if (conflict) throw new UserError(conflict);
    await db.insert(roleAssignment).values({ termId, memberId, role }).onConflictDoNothing();
    const [who] = await db.select({ fullName: member.fullName }).from(member).where(eq(member.id, memberId));
    await audit({
      actorId: me.id,
      action: "role.assign",
      entity: "role_assignment",
      entityId: termId,
      after: { member: who?.fullName, role: ROLES[role] },
    });
    refresh();
    return null;
  });
}

export async function removeRole(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("roles.manage");
    const [row] = await db.delete(roleAssignment).where(eq(roleAssignment.id, z.uuid().parse(id))).returning();
    if (row) {
      await audit({ actorId: me.id, action: "role.remove", entity: "role_assignment", entityId: row.termId, before: row });
    }
    refresh();
    return null;
  });
}

export async function setAdmin(memberId: string, isAdmin: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("roles.manage");
    if (memberId === me.id && !isAdmin) throw new UserError("You can't remove your own admin access.");
    await db.update(member).set({ isAdmin }).where(eq(member.id, memberId));
    await audit({ actorId: me.id, action: isAdmin ? "admin.grant" : "admin.revoke", entity: "member", entityId: memberId });
    refresh();
    return null;
  });
}
