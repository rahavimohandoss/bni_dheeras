/**
 * The chapter's 1-to-1 dance card, question for question as printed on the
 * card (docs/dance-card-template.pdf). The PDF download writes each answer on
 * that card's own lines, so every field records where its line is: the page,
 * the line's y (PDF points from the top of the page) and where it starts (x).
 * Every line ends at the right margin.
 */

export const CARD_RIGHT_EDGE = 550.3;
/** Long answers shrink down to this font size before they're cut short. */
export const CARD_MIN_FONT = 7;
/** Gap between where a line starts and where the answer starts. */
export const CARD_TEXT_INSET = 3;

export type CardLine = { page: 1 | 2 | 3; y: number; x: number };

export type CardField = {
  key: string;
  label: string;
  /** Grey help text printed under the question. */
  hint?: string;
  /** bio: "Label: ____" · prompt: "– prompt ____" · numbered: "1. ____" */
  kind: "bio" | "prompt" | "numbered";
  /** Where the answer goes; a second line takes what doesn't fit on the first. */
  lines: CardLine[];
  /** Largest font that fits between the card's lines. */
  maxFont: number;
};

export type CardSection = {
  title: string;
  /** Italic note under the title on the card. */
  note?: string;
  groups: { title?: string; fields: CardField[] }[];
};

const bio = (key: string, label: string, hint: string, ...lines: [y: number, x: number][]): CardField => ({
  key,
  label,
  hint,
  kind: "bio",
  maxFont: 10,
  lines: lines.map(([y, x]) => ({ page: 1, y, x })),
});

const prompts = (page: CardLine["page"], maxFont: number, prefix: string, rows: [label: string, y: number, x: number][]) =>
  rows.map(([label, y, x], i): CardField => ({
    key: `${prefix}_${i + 1}`,
    label,
    kind: "prompt",
    maxFont,
    lines: [{ page, y, x }],
  }));

const numbered = (page: CardLine["page"], prefix: string, x: number, ys: number[]) =>
  ys.map((y, i): CardField => ({
    key: `${prefix}_${i + 1}`,
    label: `${i + 1}.`,
    kind: "numbered",
    maxFont: 10,
    lines: [{ page, y, x }],
  }));

export const DANCE_CARD: CardSection[] = [
  {
    title: "Biography sheet",
    groups: [
      {
        fields: [
          bio("name", "Name", "Your full name as you'd like to be introduced", [137, 83.6]),
          bio("company", "Company Name", "Registered business name or brand name", [173, 131.9]),
          bio("profession", "Profession", "Your BNI classification / professional category", [209, 108]),
          bio("location", "Location", "Office or business address / area of operation", [245, 98]),
          bio("years_in_business", "Years in Business", "How long you've been in this profession", [281, 142.5]),
          bio(
            "previous_jobs",
            "Previous Types of Jobs",
            "Past careers or industries — helps find unexpected referral connections",
            [317, 168.6],
            [343, 45],
          ),
          bio("spouse", "Spouse", "Partner's name — builds personal rapport", [363, 92.4]),
          bio("children", "Children", "Names and ages — great conversation starters", [399, 96.9], [425, 45]),
          bio("pets", "Pets", "Type and name — pet owners connect instantly", [445, 77.4]),
          bio("hobbies", "Hobbies", "What you do outside work — sports, arts, travel, etc.", [481, 95.8], [507, 45]),
          bio(
            "bio_interests",
            "Interests",
            "Topics you're passionate about — tech, books, fitness, cooking, etc.",
            [527, 98],
            [553, 45],
          ),
          bio("city_of_residence", "City of Residence", "Where you currently live", [573, 140.2]),
          bio("how_long", "How Long", "Years in current city — shows local network depth", [609, 104.7]),
          bio(
            "burning_desire",
            "Burning Desire",
            "The one big thing you want to achieve in the next 1–2 years",
            [645, 128],
            [671, 45],
          ),
          bio("unknown_fact", "Something No One Knows About Me", "A fun or surprising fact — makes you memorable", [691, 230.2]),
          bio("key_to_success", "Key to Success", "Your personal philosophy or business mantra", [727, 130.2], [753, 45]),
        ],
      },
    ],
  },
  {
    title: "GAINS worksheet",
    groups: [
      {
        title: "Goals",
        fields: prompts(2, 9, "goals", [
          ["Short-term business revenue or growth target", 111, 241.1],
          ["Number of new clients you want this quarter", 127, 235.4],
          ["Personal development or certification goal", 143, 228.4],
          ["Networking goal (e.g., 1-to-1s per week, visitors invited)", 159, 279.4],
        ]),
      },
      {
        title: "Accomplishments",
        fields: prompts(2, 9, "accomplishments", [
          ["Major projects completed or awards received", 195, 239.2],
          ["Key clients served or deals closed", 211, 198.6],
          ["Certifications, degrees, or training completed", 227, 238.7],
          ["Business milestones (revenue, expansion, team growth)", 243, 281.3],
        ]),
      },
      {
        title: "Interests",
        fields: prompts(2, 9, "interests", [
          ["Hobbies or personal passions outside of work", 279, 241.6],
          ["Industry topics or trends you follow closely", 295, 229.3],
          ["Causes, charities, or community work you support", 311, 258.1],
          ["Sports, travel, cultural, or lifestyle interests", 327, 229.8],
        ]),
      },
      {
        title: "Networks",
        fields: prompts(2, 9, "networks", [
          ["Professional associations or industry groups", 363, 236.4],
          ["Other networking groups or business circles", 379, 235.4],
          ["Alumni networks, clubs, or community organisations", 395, 265.6],
          ["Key connectors or influencers you know personally", 411, 261.4],
        ]),
      },
      {
        title: "Skills",
        fields: prompts(2, 9, "skills", [
          ["Core professional skills that define your expertise", 447, 255.3],
          ["Specialised or niche capabilities others don't have", 463, 257.9],
          ["Soft skills — negotiation, public speaking, leadership", 479, 268],
          ["Technical tools, languages, or platforms you master", 495, 264.7],
        ]),
      },
    ],
  },
  {
    title: "Contact sphere",
    note: "List professions/businesses that are natural referral partners for you",
    groups: [{ fields: numbered(2, "contact_sphere", 63, [580, 602, 624, 646, 668, 690, 712]) }],
  },
  {
    title: "Last 10 customers",
    note: "Name & Location of your recent clients — helps members spot referral patterns",
    groups: [{ fields: numbered(3, "customer", 67, [106, 128, 150, 172, 194, 216, 238, 260, 282, 304]) }],
  },
  {
    title: "Ideal referral",
    note: "Describe the perfect referral for your business",
    groups: [
      {
        fields: prompts(3, 8.5, "ideal_referral", [
          ["Type of person or business (e.g., homeowner, startup founder, retailer)", 397, 326.5],
          ["Industry or sector they belong to", 411, 181.5],
          ["Trigger event (e.g., just got married, expanding office, filing taxes)", 425, 307.2],
          ["Geography or location preference", 439, 186.7],
          ["Budget range or project size", 453, 166.4],
        ]),
      },
    ],
  },
  {
    title: "Top problem I solve",
    groups: [
      {
        fields: prompts(3, 8.5, "top_problem", [
          ["The #1 pain point your clients come to you with", 521, 237.3],
          ["How you solve it differently from competitors", 535, 226.8],
          ["The result or transformation your clients experience", 549, 253.8],
          ["A one-liner your BNI members can use to refer you", 563, 251.9],
        ]),
      },
    ],
  },
];

export const DANCE_CARD_FIELDS: CardField[] = DANCE_CARD.flatMap((s) => s.groups.flatMap((g) => g.fields));

/** Roughly what fits on the field's lines at the smallest font (Helvetica averages ~half an em per character). */
export function maxAnswerLength(field: CardField): number {
  const width = field.lines.reduce((sum, l) => sum + CARD_RIGHT_EDGE - l.x - CARD_TEXT_INSET, 0);
  return Math.floor(width / (CARD_MIN_FONT * 0.5));
}

/** Answers are single lines on the card. */
export function cleanAnswer(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
