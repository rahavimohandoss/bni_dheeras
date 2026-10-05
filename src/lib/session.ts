import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { member, roleAssignment, term } from "@/db/schema";
import { auth } from "@/lib/auth";
import { type Capability, capabilitiesFor, isRole, type Role } from "@/lib/permissions";
import { toIstDateInput } from "@/lib/time";

export type CurrentMember = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  photoKey: string | null;
  businessName: string | null;
  category: string | null;
  isAdmin: boolean;
  roles: Role[];
  caps: Set<Capability>;
};

export class AuthError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "AuthError";
  }
}

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Roles held in the term that covers today (IST). */
export async function getCurrentRoles(memberId: string): Promise<Role[]> {
  const today = toIstDateInput(new Date());
  const rows = await db
    .select({ role: roleAssignment.role })
    .from(roleAssignment)
    .innerJoin(term, eq(term.id, roleAssignment.termId))
    .where(
      and(
        eq(roleAssignment.memberId, memberId),
        lte(term.startsOn, today),
        gte(term.endsOn, today),
      ),
    );
  return rows.map((r) => r.role).filter(isRole);
}

/** The signed-in, active member for this request, or null. Cached per request. */
export const getCurrentMember = cache(async (): Promise<CurrentMember | null> => {
  const session = await getSession();
  if (!session) return null;
  const [m] = await db.select().from(member).where(eq(member.id, session.user.id));
  if (!m || m.status !== "active") return null;
  const roles = await getCurrentRoles(m.id);
  return {
    id: m.id,
    fullName: m.fullName,
    email: m.email,
    phone: m.phone,
    photoKey: m.photoKey,
    businessName: m.businessName,
    category: m.category,
    isAdmin: m.isAdmin,
    roles,
    caps: capabilitiesFor(roles, m.isAdmin),
  };
});

/** For pages: redirect to login when signed out. */
export async function requireMember(): Promise<CurrentMember> {
  const m = await getCurrentMember();
  if (!m) redirect("/login");
  return m;
}

/** For pages: redirect home when the member lacks a capability. */
export async function requireCapPage(cap: Capability): Promise<CurrentMember> {
  const m = await requireMember();
  if (!m.caps.has(cap)) redirect("/?denied=1");
  return m;
}

/** For server actions and route handlers: throw instead of redirecting. */
export async function assertMember(): Promise<CurrentMember> {
  const m = await getCurrentMember();
  if (!m) throw new AuthError("Please sign in again.");
  return m;
}

export async function assertCap(cap: Capability): Promise<CurrentMember> {
  const m = await assertMember();
  if (!m.caps.has(cap)) throw new AuthError();
  return m;
}

export async function assertAnyCap(caps: Capability[]): Promise<CurrentMember> {
  const m = await assertMember();
  if (!caps.some((c) => m.caps.has(c))) throw new AuthError();
  return m;
}
