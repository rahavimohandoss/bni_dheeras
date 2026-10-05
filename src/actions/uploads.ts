"use server";

import { z } from "zod";
import { type ActionResult, runAction } from "@/lib/action";
import { assertMember } from "@/lib/session";
import { createUploadTarget, IMAGE_TYPES, MAX_IMAGE_BYTES, type UploadTarget } from "@/lib/storage";

const uploadSchema = z.object({
  kind: z.enum(["photo", "logo"]),
  contentType: z.enum(Object.keys(IMAGE_TYPES) as [keyof typeof IMAGE_TYPES, ...(keyof typeof IMAGE_TYPES)[]]),
  size: z.number().int().min(100).max(MAX_IMAGE_BYTES, "Image must be under 3 MB"),
});

/** A short-lived URL the browser PUTs the (already compressed) image to. */
export async function requestImageUpload(input: z.input<typeof uploadSchema>): Promise<ActionResult<UploadTarget>> {
  return runAction(async () => {
    const me = await assertMember();
    const data = uploadSchema.parse(input);
    const key = `members/${me.id}/${data.kind}-${crypto.randomUUID()}.${IMAGE_TYPES[data.contentType]}`;
    return createUploadTarget(key, data.contentType, data.size);
  });
}
