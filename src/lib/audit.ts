import "server-only";
import { type DBOrTx, db } from "@/db";
import { auditLog } from "@/db/schema";

type AuditEntry = {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
};

/** Append-only record of who changed what. Pass `tx` inside transactions. */
export async function audit(entry: AuditEntry, conn: DBOrTx = db): Promise<void> {
  await conn.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    reason: entry.reason ?? null,
  });
}
