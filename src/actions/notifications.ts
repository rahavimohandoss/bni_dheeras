"use server";

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
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

/** Opening a notification marks it read. */
export async function markNotificationRead(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertMember();
    await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(and(eq(notification.id, z.uuid().parse(id)), eq(notification.memberId, me.id), isNull(notification.readAt)));
    refresh();
    return null;
  });
}

export async function deleteNotification(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertMember();
    await db.delete(notification).where(and(eq(notification.id, z.uuid().parse(id)), eq(notification.memberId, me.id)));
    refresh();
    return null;
  });
}

/** Removes every notification the member has already read. */
export async function clearReadNotifications(): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertMember();
    await db.delete(notification).where(and(eq(notification.memberId, me.id), isNotNull(notification.readAt)));
    refresh();
    return null;
  });
}
