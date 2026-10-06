import { writeFileSync } from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { CARD_MIN_FONT, DANCE_CARD_FIELDS, maxAnswerLength } from "@/lib/dance-card";
import { fit, renderDanceCardPdf } from "@/lib/dance-card-pdf";

const sample: Record<string, string> = {
  name: "Rahavi Mohandoss",
  company: "Dheeras Digital Studio",
  profession: "Digital Marketing",
  location: "Anna Nagar, Madurai",
  years_in_business: "8 years",
  previous_jobs:
    "Software tester at an IT company, then a content writer for travel blogs, and later a social media manager for two restaurants in Madurai before starting the studio",
  children: "Aadhya (9), Nila (5)",
  burning_desire: "Grow the studio to a 20-member team serving 100 Tamil Nadu businesses by 2027",
  key_to_success: "Givers Gain® – show up, follow up, and keep every promise",
  goals_4: "Two 1-to-1s every week and one visitor every month, plus a feature presentation each quarter",
  contact_sphere_1: "Web developers",
  customer_10: "Kumar Dental Clinic – Thirunagar",
  ideal_referral_5: "₹50,000 – ₹2 lakh per year",
  top_problem_4: "தமிழ் If they need more customers from Instagram, call Rahavi",
};

describe("dance card", () => {
  it("has every question from the printed card, each with a unique key", () => {
    const keys = DANCE_CARD_FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(16 + 20 + 7 + 10 + 5 + 4);
    for (const f of DANCE_CARD_FIELDS) expect(maxAnswerLength(f)).toBeGreaterThan(40);
  });

  it("fits answers onto the card's lines, shrinking and wrapping as needed", async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    expect(fit("8 years", [400], 10, font)).toEqual({ size: 10, rows: ["8 years"] });
    const long = fit("word ".repeat(40).trim(), [200, 400], 10, font);
    expect(long.rows).toHaveLength(2);
    expect(long.size).toBeLessThanOrEqual(10);
    const tooLong = fit("x".repeat(500), [100], 9, font);
    expect(tooLong.size).toBe(CARD_MIN_FONT);
    expect(tooLong.rows[0].endsWith("…")).toBe(true);
  });

  it("writes the answers onto the 3-page card", async () => {
    const bytes = await renderDanceCardPdf(sample, sample.name);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(3);
    expect(pdf.getTitle()).toContain("Rahavi Mohandoss");
    // Set DANCE_CARD_SAMPLE=/path/to/file.pdf to look at the result.
    if (process.env.DANCE_CARD_SAMPLE) writeFileSync(process.env.DANCE_CARD_SAMPLE, bytes);
  });
});
