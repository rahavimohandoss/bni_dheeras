"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { type ActionResult, runAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { setDefaultPassword } from "@/lib/passwords";
import { assertCap } from "@/lib/session";
import { attendanceSettingsSchema, editableAttendanceSchema, getAttendanceSettings, writeSetting } from "@/lib/settings";

export async function saveAttendanceSettings(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("settings.manage");
    const before = await getAttendanceSettings();
    const data = attendanceSettingsSchema.parse({ ...before, ...editableAttendanceSchema.parse(input) });
    await writeSetting("attendance", data, me.id);
    await audit({ actorId: me.id, action: "settings.attendance", entity: "setting", entityId: "attendance", before, after: data });
    refresh();
    return null;
  });
}

/** The shared first-time password. Members still on the old default move to the new one. */
export async function saveDefaultPassword(value: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("settings.manage");
    await setDefaultPassword(z.string().parse(value), me.id);
    // The password itself stays out of the audit log.
    await audit({ actorId: me.id, action: "settings.default_password", entity: "setting", entityId: "defaultPassword" });
    refresh();
    return null;
  });
}
