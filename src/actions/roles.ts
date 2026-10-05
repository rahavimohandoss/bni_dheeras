"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { member, roleAssignment, term } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { isRole, type Role, roleConflict, ROLES } from "@/lib/permissions";
import { assertCap } from "@/lib/session";

const termSchema = z
  .object({
    name: z.string().trim().min(3).max(60),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((t) => t.endsOn > t.startsOn, { message: "The term must end after it starts." });

export async function createTerm(input: z.input<typeof termSchema>, copyFromTermId?: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const me = await assertCap("roles.manage");
    const data = termSchema.parse(input);
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
