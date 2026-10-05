"use server";

import { refresh } from "next/cache";
import { type ActionResult, runAction } from "@/lib/action";
import { audit } from "@/lib/audit";
import { danceCardTemplateSchema } from "@/lib/dance-card";
import { assertCap } from "@/lib/session";
import { attendanceSettingsSchema, getAttendanceSettings, writeSetting } from "@/lib/settings";

export async function saveAttendanceSettings(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("settings.manage");
    const data = attendanceSettingsSchema.parse(input);
    const before = await getAttendanceSettings();
    await writeSetting("attendance", data, me.id);
    await audit({ actorId: me.id, action: "settings.attendance", entity: "setting", entityId: "attendance", before, after: data });
    refresh();
    return null;
  });
}

export async function saveDanceCardTemplate(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("settings.manage");
    const data = danceCardTemplateSchema.parse(input);
    const keys = data.sections.flatMap((s) => s.fields.map((f) => f.key));
    if (new Set(keys).size !== keys.length) throw new Error("Duplicate field keys in the template.");
    await writeSetting("danceCardTemplate", data, me.id);
    await audit({ actorId: me.id, action: "settings.dance_card_template", entity: "setting", entityId: "danceCardTemplate", after: data });
    refresh();
    return null;
  });
}
