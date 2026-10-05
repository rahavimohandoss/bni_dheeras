"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { notification } from "@/db/schema";
import { type ActionResult, runAction } from "@/lib/action";
import { assertMember } from "@/lib/session";

export async function markAllNotificationsRead(): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertMember();
    await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(and(eq(notification.memberId, me.id), isNull(notification.readAt)));
    refresh();
    return null;
  });
}
