import "server-only";
import { randomInt } from "node:crypto";
import { and, count, eq, gte, inArray, lt } from "drizzle-orm";
import { type DBOrTx, db } from "@/db";
import { account, loginAttempt, member, setting } from "@/db/schema";
import { UserError } from "@/lib/action";
import { auth } from "@/lib/auth";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/format";

const DEFAULT_PASSWORD_KEY = "defaultPassword";

function isValidDefault(value: unknown): value is string {
  return typeof value === "string" && value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH;
}

/**
 * The chapter's shared first-time password. Generated on first use; admins
 * can change it in Settings. The Head Table tells it to new members.
 */
export async function getDefaultPassword(): Promise<string> {
  const [row] = await db.select({ value: setting.value }).from(setting).where(eq(setting.key, DEFAULT_PASSWORD_KEY));
  if (isValidDefault(row?.value)) return row.value;
  await db
    .insert(setting)
    .values({ key: DEFAULT_PASSWORD_KEY, value: `Dheeras@${randomInt(100_000, 1_000_000)}` })
    .onConflictDoNothing();
  const [stored] = await db.select({ value: setting.value }).from(setting).where(eq(setting.key, DEFAULT_PASSWORD_KEY));
  if (!isValidDefault(stored?.value)) throw new Error("Default password setting is invalid.");
  return stored.value;
}

/**
 * Changes the default. Members who haven't chosen their own password yet move
 * to the new default too, so "the default password" always means one thing.
 */
export async function setDefaultPassword(value: string, actorId: string): Promise<void> {
  if (!isValidDefault(value)) throw new UserError(`Use ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters.`);
  const hash = await hashPassword(value);
  await db.transaction(async (tx) => {
    await tx
      .insert(setting)
      .values({ key: DEFAULT_PASSWORD_KEY, value, updatedById: actorId })
      .onConflictDoUpdate({ target: setting.key, set: { value, updatedById: actorId, updatedAt: new Date() } });
    const onDefault = tx.select({ id: member.id }).from(member).where(eq(member.mustChangePassword, true));
    await tx
      .update(account)
      .set({ password: hash })
      .where(and(eq(account.providerId, "credential"), inArray(account.userId, onDefault)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  return (await auth.$context).password.hash(password);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return (await auth.$context).password.verify({ hash, password });
}

/** Saves a member's password hash, creating their password account if needed. */
export async function storePassword(memberId: string, hash: string, mustChange: boolean, conn: DBOrTx = db) {
  const [existing] = await conn
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, memberId), eq(account.providerId, "credential")));
  if (existing) {
    await conn.update(account).set({ password: hash }).where(eq(account.id, existing.id));
  } else {
    await conn
      .insert(account)
      .values({ id: crypto.randomUUID(), userId: memberId, accountId: memberId, providerId: "credential", password: hash });
  }
  await conn.update(member).set({ mustChangePassword: mustChange }).where(eq(member.id, memberId));
}

export async function storedPasswordHash(memberId: string): Promise<string | null> {
  const [row] = await db
    .select({ password: account.password })
    .from(account)
    .where(and(eq(account.userId, memberId), eq(account.providerId, "credential")));
  return row?.password ?? null;
}

/** Rules for a password a member chooses themselves. */
export async function assertNewPassword(next: string, confirm: string): Promise<void> {
  if (next.length < PASSWORD_MIN_LENGTH) throw new UserError(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  if (next.length > PASSWORD_MAX_LENGTH) throw new UserError("That password is too long.");
  if (next !== confirm) throw new UserError("The two passwords don't match.");
  if (next === (await getDefaultPassword())) throw new UserError("Choose a password that's different from the default one.");
}

/* Guessing limits: wrong passwords per login ID and per IP in 15 minutes. */
const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES_PER_ID = 8;
const MAX_FAILURES_PER_IP = 30;

export async function tooManyFailures(identifier: string, ip: string | null): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const failures = (where: ReturnType<typeof eq>) =>
    db
      .select({ n: count() })
      .from(loginAttempt)
      .where(and(where, eq(loginAttempt.ok, false), gte(loginAttempt.createdAt, since)))
      .then(([r]) => r.n);
  if ((await failures(eq(loginAttempt.identifier, identifier))) >= MAX_FAILURES_PER_ID) return true;
  return ip ? (await failures(eq(loginAttempt.ip, ip))) >= MAX_FAILURES_PER_IP : false;
}

export async function recordLoginAttempt(identifier: string, ip: string | null, ok: boolean): Promise<void> {
  await db.insert(loginAttempt).values({ identifier, ip, ok });
}

export async function pruneLoginAttempts(): Promise<void> {
  await db.delete(loginAttempt).where(lt(loginAttempt.createdAt, new Date(Date.now() - 30 * 86_400_000)));
}
