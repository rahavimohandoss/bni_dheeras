import { z } from "zod";
import { FORM_FIELD_TYPES, type FormField, type FormFieldType } from "@/db/schema";

export const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  short_text: "Short answer",
  long_text: "Paragraph",
  number: "Number",
  email: "Email",
  phone: "Phone",
  single_choice: "One choice",
  multi_choice: "Multiple choices",
  dropdown: "Dropdown",
  rating: "Rating 1–5",
  date: "Date",
  yes_no: "Yes / No",
};

export const CHOICE_TYPES: FormFieldType[] = ["single_choice", "multi_choice", "dropdown"];

export const formFieldSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]{1,40}$/),
  type: z.enum(FORM_FIELD_TYPES),
  label: z.string().trim().min(1, "Every question needs a label").max(200),
  help: z.string().trim().max(300).optional(),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
});

const f = (id: string, type: FormFieldType, label: string, required = true, options?: string[]): FormField => ({
  id,
  type,
  label,
  required,
  ...(options ? { options } : {}),
});

export const FORM_TEMPLATES = {
  visitor_registration: {
    title: "Visitor registration",
    description: "Welcome to BNI Dheeras! Tell us a little about you.",
    visibility: "public" as const,
    fields: [
      f("name", "short_text", "Your name"),
      f("phone", "phone", "Mobile number"),
      f("email", "email", "Email", false),
      f("business", "short_text", "Business name"),
      f("category", "short_text", "What does your business do?"),
      f("invited_by", "short_text", "Who invited you?", false),
    ],
  },
  visitor_feedback: {
    title: "Visitor feedback",
    description: "Thank you for visiting BNI Dheeras. Your feedback helps us improve.",
    visibility: "public" as const,
    fields: [
      f("name", "short_text", "Your name"),
      f("phone", "phone", "Mobile number"),
      f("rating", "rating", "How was the meeting?"),
      f("liked", "long_text", "What did you like most?", false),
      f("join", "single_choice", "Would you like to know about membership?", true, ["Yes, call me", "Maybe later", "No, thanks"]),
    ],
  },
  event_registration: {
    title: "Event registration",
    description: "",
    visibility: "public" as const,
    fields: [
      f("name", "short_text", "Name"),
      f("phone", "phone", "Mobile number"),
      f("email", "email", "Email", false),
      f("guests", "number", "Number of guests", false),
    ],
  },
  survey: {
    title: "Member survey",
    description: "",
    visibility: "members" as const,
    fields: [
      f("rating", "rating", "How useful are our weekly meetings?"),
      f("improve", "long_text", "What should we improve?", false),
    ],
  },
} satisfies Record<string, { title: string; description: string; visibility: "public" | "members"; fields: FormField[] }>;

export type FormTemplateKey = keyof typeof FORM_TEMPLATES;

type Answer = string | string[];

/** Validates submitted answers against the form's own field list. */
export function validateAnswers(fields: FormField[], raw: Record<string, unknown>): { data: Record<string, Answer> } | { error: string } {
  const data: Record<string, Answer> = {};
  for (const field of fields) {
    const value = raw[field.id];
    const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
    if (empty) {
      if (field.required) return { error: `"${field.label}" is required.` };
      continue;
    }
    const str = Array.isArray(value) ? "" : String(value).trim();
    const bad = (why: string) => ({ error: `"${field.label}": ${why}` });
    switch (field.type) {
      case "short_text":
        if (str.length > 300) return bad("too long");
        data[field.id] = str;
        break;
      case "long_text":
        if (str.length > 4000) return bad("too long");
        data[field.id] = str;
        break;
      case "number":
        if (!/^-?\d+(\.\d+)?$/.test(str) || str.length > 15) return bad("enter a number");
        data[field.id] = str;
        break;
      case "email":
        if (!z.email().safeParse(str).success) return bad("enter a valid email");
        data[field.id] = str.toLowerCase();
        break;
      case "phone":
        if (!/^\+?[\d\s-]{8,16}$/.test(str)) return bad("enter a valid phone number");
        data[field.id] = str.replace(/[\s-]/g, "");
        break;
      case "date":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return bad("pick a date");
        data[field.id] = str;
        break;
      case "rating":
        if (!/^[1-5]$/.test(str)) return bad("choose 1 to 5");
        data[field.id] = str;
        break;
      case "yes_no":
        if (str !== "yes" && str !== "no") return bad("choose yes or no");
        data[field.id] = str;
        break;
      case "single_choice":
      case "dropdown":
        if (!field.options?.includes(str)) return bad("choose one of the options");
        data[field.id] = str;
        break;
      case "multi_choice": {
        const list = (Array.isArray(value) ? value : [value]).map(String);
        if (!list.every((v) => field.options?.includes(v))) return bad("choose from the options");
        data[field.id] = list;
        break;
      }
    }
  }
  return { data };
}

export function answerText(value: Answer | undefined): string {
  if (value === undefined) return "";
  return Array.isArray(value) ? value.join(", ") : value;
}
