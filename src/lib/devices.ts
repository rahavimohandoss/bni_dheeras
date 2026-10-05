import "server-only";
import { desc, eq } from "drizzle-orm";
import type { DeviceSummary } from "@/components/device-card";
import { db } from "@/db";
import { device } from "@/db/schema";

export async function getMemberDevices(memberId: string): Promise<DeviceSummary[]> {
  const rows = await db
    .select({
      id: device.id,
      thumbprint: device.keyThumbprint,
      status: device.status,
      label: device.label,
      approvalCode: device.approvalCode,
    })
    .from(device)
    .where(eq(device.memberId, memberId))
    .orderBy(desc(device.createdAt));
  return rows;
}
