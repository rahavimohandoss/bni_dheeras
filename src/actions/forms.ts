"use server";

import { createHash } from "node:crypto";
import { and, count, eq, gte } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { FORM_KINDS, FORM_VISIBILITIES, form, formResponse } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { CHOICE_TYPES, FORM_TEMPLATES, type FormTemplateKey, formFieldSchema, validateAnswers } from "@/lib/forms";
import { requestMeta } from "@/lib/request-meta";
import { assertCap, getCurrentMember } from "@/lib/session";
import { istToDate } from "@/lib/time";

const slugify = (title: string) =>
  `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "form"}-${Math.random().toString(36).slice(2, 6)}`;

export async function createForm(template: FormTemplateKey | "blank"): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const me = await assertCap("forms.manage");
    const t =
      template === "blank"
        ? { title: "Untitled form", description: "", visibility: "members" as const, fields: [] }
        : FORM_TEMPLATES[template];
    const [row] = await db
      .insert(form)
      .values({
        slug: slugify(t.title),
        title: t.title,
        description: t.description || null,
        kind: template === "blank" ? "custom" : template,
        visibility: t.visibility,
        fields: t.fields,
        createdById: me.id,
      })
      .returning({ id: form.id });
    await audit({ actorId: me.id, action: "form.create", entity: "form", entityId: row.id, after: { template } });
    refresh();
    return { id: row.id };
  });
}

const dateOrNull = z
  .string()
  .optional()
  .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null));

const formSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional().transform((v) => v || null),
  kind: z.enum(FORM_KINDS),
  visibility: z.enum(FORM_VISIBILITIES),
  opensOn: dateOrNull,
  closesOn: dateOrNull,
  maxResponses: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .pipe(z.number().int().min(1).max(100000).nullable()),
  onePerMember: z.boolean(),
  isActive: z.boolean(),
  fields: z.array(formFieldSchema).min(1, "Add at least one question").max(40),
});

export async function saveForm(id: string, input: z.input<typeof formSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("forms.manage");
    const d = formSchema.parse(input);
    const ids = d.fields.map((f) => f.id);
    if (new Set(ids).size !== ids.length) throw new UserError("Two questions have the same id.");
    for (const f of d.fields) {
      if (CHOICE_TYPES.includes(f.type) && (!f.options || f.options.length < 2)) {
        throw new UserError(`"${f.label}" needs at least two options.`);
      }
    }
    if (d.onePerMember && d.visibility === "public") {
      throw new UserError("'One response per member' needs a members-only form (public visitors aren't signed in).");
    }
    await db
      .update(form)
      .set({
        title: d.title,
        description: d.description,
        kind: d.kind,
        visibility: d.visibility,
        opensAt: d.opensOn ? istToDate(d.opensOn) : null,
        // Closes at the end of the chosen day.
        closesAt: d.closesOn ? new Date(istToDate(d.closesOn).getTime() + 86_399_000) : null,
        maxResponses: d.maxResponses,
        onePerMember: d.onePerMember,
        isActive: d.isActive,
        fields: d.fields.map((f) => (CHOICE_TYPES.includes(f.type) ? f : { ...f, options: undefined })),
      })
      .where(eq(form.id, z.uuid().parse(id)));
    await audit({ actorId: me.id, action: "form.update", entity: "form", entityId: id });
    refresh();
    return null;
  });
}

export async function deleteForm(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("forms.manage");
    await db.delete(form).where(eq(form.id, z.uuid().parse(id)));
    await audit({ actorId: me.id, action: "form.delete", entity: "form", entityId: id });
    refresh();
    return null;
  });
}

async function verifyTurnstile(token: string | undefined, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
  }).catch(() => null);
  const data = (await res?.json().catch(() => null)) as { success?: boolean } | null;
  return !!data?.success;
}

/** Public and members-only submissions. Answers are validated against the form's own questions. */
export async function submitForm(
  slug: string,
  answers: Record<string, unknown>,
  turnstileToken?: string,
): Promise<ActionResult> {
  return runAction(async () => {
    const [f] = await db.select().from(form).where(eq(form.slug, z.string().max(80).parse(slug)));
    if (!f || !f.isActive) throw new UserError("This form isn't accepting responses.");
    const now = new Date();
    if (f.opensAt && now < f.opensAt) throw new UserError("This form isn't open yet.");
    if (f.closesAt && now > f.closesAt) throw new UserError("This form has closed.");

    const me = await getCurrentMember();
    if (f.visibility === "members" && !me) throw new UserError("Please sign in to fill this form.");

    const meta = await requestMeta();
    const ipHash = meta.ip
      ? createHash("sha256").update(`${process.env.BETTER_AUTH_SECRET ?? ""}|${meta.ip}`).digest("base64url").slice(0, 32)
      : null;

    if (f.visibility === "public" && !me) {
      if (!(await verifyTurnstile(turnstileToken, meta.ip))) throw new UserError("Please complete the spam check.");
      if (ipHash) {
        const [{ n }] = await db
          .select({ n: count() })
          .from(formResponse)
          .where(
            and(eq(formResponse.formId, f.id), eq(formResponse.ipHash, ipHash), gte(formResponse.createdAt, new Date(now.getTime() - 10 * 60_000))),
          );
        if (n >= 5) throw new UserError("Too many submissions from this network. Try again later.");
      }
    }
    if (f.maxResponses) {
      const [{ n }] = await db.select({ n: count() }).from(formResponse).where(eq(formResponse.formId, f.id));
      if (n >= f.maxResponses) throw new UserError("Sorry, this form is full.");
    }
    if (f.onePerMember && me) {
      const [{ n }] = await db
        .select({ n: count() })
        .from(formResponse)
        .where(and(eq(formResponse.formId, f.id), eq(formResponse.memberId, me.id)));
      if (n > 0) throw new UserError("You've already responded to this form.");
    }

    const result = validateAnswers(f.fields, answers);
    if ("error" in result) throw new UserError(result.error);
    await db.insert(formResponse).values({ formId: f.id, memberId: me?.id ?? null, data: result.data, ipHash });
    return null;
  });
}
