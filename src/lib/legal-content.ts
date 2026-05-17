/**
 * Pure parser that turns a RAJLO policy's raw text into a structured
 * block list the `/legal/[slug]` page renders.
 *
 * The text is the legal source of truth and is rendered verbatim —
 * this parser only adds STRUCTURE (which lines are headings, which are
 * list items), it never rewrites wording.
 *
 * It is pure (no filesystem, no DB) so it works identically whether
 * the body came from the committed `policies/*.txt` baseline or from
 * an admin's edit stored in the `legal_documents` table.
 *
 * Line-format heuristics (the policies follow a consistent shape):
 *   - a line equal to the document title  → skipped
 *   - "Effective Date: …"                 → skipped
 *   - the trailing "RAJLO — …" tagline    → skipped
 *   - "N. Heading"                        → top-level section heading
 *   - "N.N Heading"                       → sub-section heading
 *   - a line ending ":"                   → a list lead-in; lines under
 *                                           it become a bulleted list
 *                                           until the next heading
 *   - anything before section "1."        → intro paragraphs
 */

export type LegalBlock =
  | { type: "section"; text: string }
  | { type: "subsection"; text: string }
  | { type: "lead"; text: string }
  | { type: "para"; text: string }
  | { type: "list"; items: string[] };

export type ParsedLegalContent = {
  /** Paragraphs before section "1." — the document preamble. */
  intro: string[];
  /** The structured body. */
  blocks: LegalBlock[];
};

const SECTION_RE = /^\d+\.\s/; // "1. ", "12. "
const SUBSECTION_RE = /^\d+\.\d+\s/; // "2.1 ", "6.3 "

/**
 * Parse raw policy text into renderable blocks.
 *
 * @param raw   the full policy body text
 * @param title the document title — any line exactly matching it is
 *              skipped (the .txt baseline files carry the title as
 *              their first line; admin-edited bodies may not)
 */
export function parseLegalText(raw: string, title = ""): ParsedLegalContent {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const intro: string[] = [];
  const blocks: LegalBlock[] = [];
  let pendingList: string[] = [];
  let inList = false;
  let reachedBody = false;

  const flushList = () => {
    if (pendingList.length > 0) {
      blocks.push({ type: "list", items: pendingList });
      pendingList = [];
    }
    inList = false;
  };

  for (const line of lines) {
    if (title && line === title) continue;
    if (/^effective date:/i.test(line)) continue;
    // Trailing brand tagline — "RAJLO — Jamaica's … Platform".
    if (/^RAJLO\s+[—-]/.test(line)) continue;

    const isSubsection = SUBSECTION_RE.test(line);
    const isSection = !isSubsection && SECTION_RE.test(line);

    if (!reachedBody) {
      if (isSection || isSubsection) {
        reachedBody = true;
      } else {
        intro.push(line);
        continue;
      }
    }

    if (isSection) {
      flushList();
      blocks.push({ type: "section", text: line });
      continue;
    }
    if (isSubsection) {
      flushList();
      blocks.push({ type: "subsection", text: line });
      continue;
    }
    if (line.endsWith(":")) {
      flushList();
      blocks.push({ type: "lead", text: line });
      inList = true;
      continue;
    }
    if (inList) {
      pendingList.push(line);
    } else {
      blocks.push({ type: "para", text: line });
    }
  }
  flushList();

  return { intro, blocks };
}
