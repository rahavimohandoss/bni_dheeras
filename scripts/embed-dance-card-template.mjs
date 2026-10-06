/**
 * Embeds docs/dance-card-template.pdf into src/lib/dance-card-template.ts.
 * Run after replacing the PDF. If the new card's lines move, update the
 * positions in src/lib/dance-card.ts too.
 *
 *   node scripts/embed-dance-card-template.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const b64 = readFileSync("docs/dance-card-template.pdf").toString("base64");
const chunks = b64.match(/.{1,120}/g).map((line) => `  "${line}"`);
writeFileSync(
  "src/lib/dance-card-template.ts",
  `/**
 * The chapter's blank 1-to-1 dance card (3 pages, A4): docs/dance-card-template.pdf,
 * embedded so the PDF route needs no file access. Regenerate after replacing that
 * file: node scripts/embed-dance-card-template.mjs
 */
export const DANCE_CARD_TEMPLATE_PDF_BASE64 =
${chunks.join(" +\n")};
`,
);
console.log(`Embedded ${b64.length} base64 characters.`);
