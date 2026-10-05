"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { memberLocation } from "@/db/schema";
import { type ActionResult, runAction } from "@/lib/action";
import { approximatePoint } from "@/lib/attendance/geo";
import { type NearbyMember, membersNearby } from "@/lib/nearby";
import { assertMember } from "@/lib/session";

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().trim().max(300).optional().transform((v) => v || null),
  area: z.string().trim().max(120).optional().nullable().transform((v) => v || null),
  city: z.string().trim().max(120).optional().nullable().transform((v) => v || null),
  precision: z.enum(["exact", "area"]),
  visible: z.boolean(),
});

export async function saveMyLocation(input: z.input<typeof locationSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertMember();
    const d = locationSchema.parse(input);
    const display = d.precision === "area" ? approximatePoint(d) : { lat: d.lat, lng: d.lng };
    const values = {
      lat: d.lat,
      lng: d.lng,
      displayLat: display.lat,
      displayLng: display.lng,
      // Area-only members never expose a street address.
      address: d.precision === "area" ? null : d.address,
      area: d.area,
      city: d.city,
      precision: d.precision,
      visible: d.visible,
    };
    await db
      .insert(memberLocation)
      .values({ memberId: me.id, ...values })
      .onConflictDoUpdate({ target: memberLocation.memberId, set: values });
    refresh();
    return null;
  });
}

export async function deleteMyLocation(): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertMember();
    await db.delete(memberLocation).where(eq(memberLocation.memberId, me.id));
    refresh();
    return null;
  });
}

const originSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

/** Nearest-first list from the phone's current position. The position is used once and never stored. */
export async function nearbyFromHere(input: z.input<typeof originSchema>): Promise<ActionResult<NearbyMember[]>> {
  return runAction(async () => {
    const me = await assertMember();
    return membersNearby(me.id, originSchema.parse(input));
  });
}
