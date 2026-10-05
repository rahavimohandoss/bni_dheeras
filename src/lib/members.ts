import "server-only";
import { z } from "zod";
import { type DBOrTx, db } from "@/db";
import { member, user } from "@/db/schema";
import { UserError } from "@/lib/action";
import { isUniqueViolation } from "@/lib/db-errors";
import { normalizePhone, parseLooseDate } from "@/lib/format";

export { normalizePhone, parseLooseDate, whatsappLink } from "@/lib/format";

export const memberInputSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the full name").max(120),
  email: z.email("Enter a valid email").transform((v) => v.trim().toLowerCase()),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => normalizePhone(v)),
  businessName: z.string().trim().max(160).optional().transform((v) => v || null),
  category: z.string().trim().max(120).optional().transform((v) => v || null),
  joinedOn: z
    .string()
    .optional()
    .transform((v) => parseLooseDate(v)),
});

export type MemberInput = z.output<typeof memberInputSchema>;

/** Creates the Better Auth user and the member row with the same id. */
export async function createMember(
  input: MemberInput & { isAdmin?: boolean },
  conn: DBOrTx = db,
): Promise<string> {
  const id = crypto.randomUUID();
  try {
    await conn.insert(user).values({ id, name: input.fullName, email: input.email, emailVerified: true });
    await conn.insert(member).values({
      id,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      businessName: input.businessName,
      category: input.category,
      joinedOn: input.joinedOn,
      isAdmin: input.isAdmin ?? false,
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserError(`A member with this email or phone already exists (${input.email}).`);
    throw error;
  }
  return id;
}

