import { z } from "zod";

export const danceCardFieldSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/),
  label: z.string().min(1),
  type: z.enum(["short", "long"]),
  placeholder: z.string().optional(),
});

export const danceCardTemplateSchema = z.object({
  sections: z
    .array(
      z.object({
        title: z.string().min(1),
        fields: z.array(danceCardFieldSchema).min(1),
      }),
    )
    .min(1),
});

export type DanceCardTemplate = z.infer<typeof danceCardTemplateSchema>;
export type DanceCardField = z.infer<typeof danceCardFieldSchema>;

/**
 * Default 1-to-1 dance card. Name, business, category and contact details come
 * from the member's profile, so they are not repeated here. Admins can replace
 * this with the chapter's own card in Settings.
 */
export const DEFAULT_DANCE_CARD_TEMPLATE: DanceCardTemplate = {
  sections: [
    {
      title: "About me",
      fields: [
        { key: "years_in_business", label: "Years in business", type: "short" },
        { key: "previous_jobs", label: "Previous types of jobs", type: "short" },
        { key: "family", label: "Family", type: "short" },
        { key: "city_of_residence", label: "City of residence (how long?)", type: "short" },
        { key: "hobbies", label: "Hobbies and interests", type: "long" },
        { key: "burning_desire", label: "My burning desire is…", type: "long" },
        { key: "unknown_fact", label: "Something no one knows about me", type: "long" },
        { key: "key_to_success", label: "My key to success", type: "long" },
      ],
    },
    {
      title: "GAINS",
      fields: [
        { key: "goals", label: "Goals", type: "long" },
        { key: "accomplishments", label: "Accomplishments", type: "long" },
        { key: "interests", label: "Interests", type: "long" },
        { key: "networks", label: "Networks", type: "long" },
        { key: "skills", label: "Skills", type: "long" },
      ],
    },
    {
      title: "Referrals",
      fields: [
        { key: "ideal_referral", label: "My ideal referral", type: "long" },
        { key: "top_product", label: "My top product / service", type: "long" },
        { key: "top_problem_solved", label: "The top problem I solve", type: "long" },
        { key: "referral_partners", label: "My ideal referral partners", type: "long" },
        { key: "target_market", label: "My target market", type: "long" },
      ],
    },
  ],
};

export function templateKeys(template: DanceCardTemplate): string[] {
  return template.sections.flatMap((s) => s.fields.map((f) => f.key));
}
