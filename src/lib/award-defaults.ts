/** The weekly recognitions, and which of them take a note and/or a value. */
export const DEFAULT_AWARDS: { name: string; noteEnabled: boolean; valueEnabled: boolean; valueHint: string | null }[] = [
  { name: "Highest Referral Giver", noteEnabled: true, valueEnabled: true, valueHint: "e.g. 4 referrals" },
  { name: "Top Business Giver", noteEnabled: true, valueEnabled: true, valueHint: "e.g. Rs 20 lakh" },
  { name: "Best Attire", noteEnabled: false, valueEnabled: false, valueHint: null },
  { name: "Best 30-Second Presentation", noteEnabled: true, valueEnabled: false, valueHint: null },
  { name: "Star of the Week", noteEnabled: false, valueEnabled: true, valueHint: "e.g. 3 visitors" },
];
