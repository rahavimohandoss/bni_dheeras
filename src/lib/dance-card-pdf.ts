import "server-only";
import { PDFDocument, type PDFFont, rgb, StandardFonts } from "pdf-lib";
import {
  CARD_MIN_FONT,
  CARD_RIGHT_EDGE,
  CARD_TEXT_INSET,
  type CardField,
  cleanAnswer,
  DANCE_CARD_FIELDS,
} from "@/lib/dance-card";
import { DANCE_CARD_TEMPLATE_PDF_BASE64 } from "@/lib/dance-card-template";

/** Text sits this far above its line, level with the card's own labels. */
const BASELINE_ABOVE_LINE: Record<CardField["kind"], number> = { bio: 2, prompt: 3, numbered: 2 };
const INK = rgb(0.07, 0.07, 0.07);
const ELLIPSIS = "…";
/** Common characters the card's font (Helvetica) can't print. */
const SUBSTITUTES: Record<string, string> = { "₹": "Rs.", "−": "-", " ": " " };

/** Writes the answers onto the chapter's blank dance card and returns the PDF. */
export async function renderDanceCardPdf(answers: Record<string, string>, name: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(Buffer.from(DANCE_CARD_TEMPLATE_PDF_BASE64, "base64"));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const printable = new Set(font.getCharacterSet());
  const pages = pdf.getPages();

  for (const field of DANCE_CARD_FIELDS) {
    const text = toPrintable(answers[field.key] ?? "", printable);
    if (!text) continue;
    const widths = field.lines.map((l) => CARD_RIGHT_EDGE - l.x - CARD_TEXT_INSET);
    const { size, rows } = fit(text, widths, field.maxFont, font);
    rows.forEach((row, i) => {
      const line = field.lines[i];
      const page = pages[line.page - 1];
      page.drawText(row, {
        x: line.x + CARD_TEXT_INSET,
        y: page.getHeight() - line.y + BASELINE_ABOVE_LINE[field.kind],
        size,
        font,
        color: INK,
      });
    });
  }

  pdf.setTitle(`${name} – 1-to-1 Dance Card`);
  pdf.setAuthor(name);
  pdf.setCreator("BNI Dheeras chapter app");
  pdf.setProducer("BNI Dheeras chapter app");
  return pdf.save();
}

function toPrintable(value: string, printable: Set<number>): string {
  let out = "";
  for (const ch of cleanAnswer(value)) {
    out += SUBSTITUTES[ch] ?? (printable.has(ch.codePointAt(0) ?? 0) ? ch : "?");
  }
  return out;
}

/** Largest font (down to the minimum) at which the text fits the field's lines; cut short if it never does. */
export function fit(text: string, widths: number[], maxFont: number, font: PDFFont): { size: number; rows: string[] } {
  for (let size = maxFont; size >= CARD_MIN_FONT; size -= 0.5) {
    const rows = wrap(text, widths, size, font);
    if (rows) return { size, rows };
  }
  return { size: CARD_MIN_FONT, rows: cutToFit(text, widths, CARD_MIN_FONT, font) };
}

/** Word-wraps onto the given lines; null when the text doesn't fit. */
function wrap(text: string, widths: number[], size: number, font: PDFFont): string[] | null {
  const rows: string[] = [];
  let row = "";
  for (const word of text.split(" ")) {
    const candidate = row ? `${row} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= widths[rows.length]) {
      row = candidate;
      continue;
    }
    if (!row) return null;
    rows.push(row);
    if (rows.length === widths.length || font.widthOfTextAtSize(word, size) > widths[rows.length]) return null;
    row = word;
  }
  rows.push(row);
  return rows;
}

/** Fills the lines character by character and ends the last one with "…". */
function cutToFit(text: string, widths: number[], size: number, font: PDFFont): string[] {
  const fits = (s: string, width: number) => font.widthOfTextAtSize(s, size) <= width;
  const rows: string[] = [];
  let rest = text;
  for (const [i, width] of widths.entries()) {
    if (!rest) break;
    if (i === widths.length - 1) {
      if (fits(rest, width)) {
        rows.push(rest);
      } else {
        let n = rest.length;
        while (n > 0 && !fits(rest.slice(0, n).trimEnd() + ELLIPSIS, width)) n--;
        rows.push(rest.slice(0, n).trimEnd() + ELLIPSIS);
      }
      break;
    }
    let n = rest.length;
    while (n > 0 && !fits(rest.slice(0, n), width)) n--;
    const space = rest.lastIndexOf(" ", n);
    if (n < rest.length && space > 0) n = space;
    rows.push(rest.slice(0, n).trimEnd());
    rest = rest.slice(n).trimStart();
  }
  return rows;
}
